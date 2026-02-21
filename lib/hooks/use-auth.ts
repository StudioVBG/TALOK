"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import type { ProfileRow } from "@/lib/supabase/typed-client";

// ======================================================================
// Types for auth state machine
// ======================================================================
export type AuthStatus =
  | "initializing"      // App just started, checking session
  | "unauthenticated"   // No session found
  | "loading_profile"   // Session OK, loading profile
  | "authenticated"     // Session + profile OK
  | "profile_error";    // Session OK but profile load/creation failed

export interface AuthError {
  type:
    | "PROFILE_NOT_FOUND"
    | "FETCH_ERROR"
    | "CREATION_FAILED"
    | "SESSION_EXPIRED"
    | "NETWORK_ERROR";
  message: string;
  retryable: boolean;
}

// ======================================================================
// Structured logger for auth events
// ======================================================================
const authLogger = {
  info: (event: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Auth] ${event}`, data ?? "");
    }
  },
  warn: (event: string, data?: Record<string, unknown>) => {
    console.warn(`[Auth] ${event}`, data ?? "");
  },
  error: (event: string, error: unknown, data?: Record<string, unknown>) => {
    console.error(`[Auth] ${event}`, error, data ?? "");
  },
};

// ======================================================================
// Global guards (module-level) — shared across all instances of useAuth()
// to prevent duplicate calls when layout + page both mount the hook.
// ======================================================================
let _globalProfilePromise: Promise<Profile | null> | null = null;
let _globalFetchedUserId: string | null = null;
// Anti-retry guard: prevents infinite profile creation attempts
let _globalCreateAttempted = false;

/**
 * Reset all global guards. Called on sign-out and user change.
 */
function resetGlobalGuards() {
  _globalFetchedUserId = null;
  _globalProfilePromise = null;
  _globalCreateAttempted = false;
}

// ======================================================================
// Retry helper with exponential backoff
// ======================================================================
async function fetchWithRetry<T>(
  fn: () => PromiseLike<T> | Promise<T>,
  { maxRetries = 2, baseDelay = 1000, maxDelay = 5000 } = {}
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Only retry on network errors, not on logical errors
      if (
        error instanceof TypeError &&
        error.message.includes("fetch")
      ) {
        const delay = Math.min(
          baseDelay * 2 ** attempt + Math.random() * 500,
          maxDelay
        );
        authLogger.warn("Retrying after network error", {
          attempt: attempt + 1,
          maxRetries,
          delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error("Unreachable");
}

// ======================================================================
// Main hook
// ======================================================================
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(Profile | ProfileRow) | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<AuthError | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const supabase = createClient();

  // Ref to track current user_id (avoids re-renders on User object changes)
  const currentUserIdRef = useRef<string | null>(null);
  // Local concurrency lock to prevent concurrent fetches within this instance
  const fetchingRef = useRef(false);
  // Track whether this instance has been unmounted
  const mountedRef = useRef(true);

  // Safe state setters that check mount status
  const safeSetProfile = useCallback(
    (p: (Profile | ProfileRow) | null) => {
      if (mountedRef.current) setProfile(p);
    },
    []
  );
  const safeSetLoading = useCallback(
    (l: boolean) => {
      if (mountedRef.current) setLoading(l);
    },
    []
  );
  const safeSetProfileError = useCallback(
    (e: AuthError | null) => {
      if (mountedRef.current) setProfileError(e);
    },
    []
  );
  const safeSetStatus = useCallback(
    (s: AuthStatus) => {
      if (mountedRef.current) setStatus(s);
    },
    []
  );
  const safeSetUser = useCallback(
    (u: User | null) => {
      if (mountedRef.current) setUser(u);
    },
    []
  );

  const fetchProfile = useCallback(
    async (userId: string, force = false) => {
      // If another instance already fetched this user, reuse the cached promise
      if (!force && _globalFetchedUserId === userId && _globalProfilePromise) {
        // Capture promise reference before awaiting to detect invalidation
        const promiseRef = _globalProfilePromise;
        try {
          const cachedProfile = await promiseRef;
          // Check if the promise was invalidated while we were awaiting
          if (_globalProfilePromise !== promiseRef) {
            // Another fetch started — let it handle state updates
            return;
          }
          safeSetProfile(cachedProfile);
          if (!cachedProfile && _globalCreateAttempted) {
            safeSetProfileError({
              type: "PROFILE_NOT_FOUND",
              message: "Profil introuvable et creation automatique echouee",
              retryable: false,
            });
            safeSetStatus("profile_error");
          } else if (cachedProfile) {
            safeSetStatus("authenticated");
            safeSetProfileError(null);
          }
        } catch {
          safeSetProfile(null);
          safeSetStatus("profile_error");
        } finally {
          safeSetLoading(false);
        }
        return;
      }

      // Prevent concurrent fetches within this instance
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      // Reset error at the start of a real fetch
      safeSetProfileError(null);
      safeSetStatus("loading_profile");

      // Mark user_id BEFORE creating the promise to block other instances immediately
      _globalFetchedUserId = userId;

      // Create global promise for deduplication across instances
      _globalProfilePromise = (async (): Promise<Profile | null> => {
        try {
          // Step 1: Fetch profile via API route (service role, bypasses RLS)
          // This is the most reliable method — avoids all RLS configuration issues
          const response = await fetchWithRetry(() =>
            fetch("/api/me/profile", { credentials: "include" })
          );

          if (response.ok) {
            const profileData = (await response.json()) as Profile;
            authLogger.info("Profile loaded via API", { userId });
            return profileData;
          }

          // 404 = profile doesn't exist yet
          if (response.status === 404) {
            authLogger.warn("Profile not found (404), attempting auto-creation", { userId });

            // Step 2: Profile doesn't exist — attempt creation ONCE
            if (_globalCreateAttempted) {
              authLogger.warn("Profile creation already attempted, giving up", { userId });
              return null;
            }
            _globalCreateAttempted = true;

            try {
              const createResponse = await fetchWithRetry(() =>
                fetch("/api/me/profile", {
                  method: "POST",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ user_id: userId }),
                })
              );
              if (createResponse.ok) {
                const created = (await createResponse.json()) as Profile;
                authLogger.info("Profile auto-created successfully", { userId });
                return created;
              }
              authLogger.error(
                "Profile auto-creation failed",
                new Error(`HTTP ${createResponse.status}`),
                { userId }
              );
            } catch (apiError) {
              authLogger.error("Profile auto-creation error", apiError, { userId });
            }
            return null;
          }

          // 401 = session expired or invalid
          if (response.status === 401) {
            authLogger.warn("Session expired during profile fetch", { userId });
            return null;
          }

          // Other error
          authLogger.error(
            "Profile API returned unexpected status",
            new Error(`HTTP ${response.status}`),
            { userId }
          );
          return null;
        } catch (err) {
          authLogger.error("Profile fetch error", err, { userId });
          return null;
        }
      })();

      try {
        const result = await _globalProfilePromise;
        safeSetProfile(result);
        if (!result) {
          safeSetProfileError({
            type: "PROFILE_NOT_FOUND",
            message: "Profil introuvable et creation automatique echouee",
            retryable: false,
          });
          safeSetStatus("profile_error");
        } else {
          safeSetProfileError(null);
          safeSetStatus("authenticated");
        }
      } catch {
        safeSetProfile(null);
        safeSetProfileError({
          type: "FETCH_ERROR",
          message: "Erreur lors du chargement du profil",
          retryable: true,
        });
        safeSetStatus("profile_error");
      } finally {
        safeSetLoading(false);
        fetchingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    mountedRef.current = true;

    // Get current user on mount
    supabase.auth
      .getUser()
      .then(({ data: { user: currentUser }, error }) => {
        // Invalid refresh token — clean up and redirect
        if (
          error &&
          (error.message?.includes("refresh_token") ||
            error.message?.includes("Invalid Refresh Token") ||
            error.message?.includes("Refresh Token Not Found"))
        ) {
          authLogger.error("Invalid refresh token, cleaning session", error);
          supabase.auth.signOut().finally(() => {
            if (
              typeof window !== "undefined" &&
              !window.location.pathname.includes("/auth")
            ) {
              window.location.href = "/auth/signin?error=session_expired";
            }
          });
          safeSetLoading(false);
          safeSetStatus("unauthenticated");
          return;
        }

        if (currentUser) {
          const isNewUser = currentUserIdRef.current !== currentUser.id;
          if (isNewUser) {
            // New user — reset guards for fresh fetch
            resetGlobalGuards();
            currentUserIdRef.current = currentUser.id;
            safeSetUser(currentUser);
          }
          // Always call fetchProfile — global deduplication handles the rest.
          // If onAuthStateChange already started a fetch for this user,
          // fetchProfile will reuse the cached promise.
          fetchProfile(currentUser.id);
        } else {
          currentUserIdRef.current = null;
          safeSetUser(null);
          safeSetLoading(false);
          safeSetStatus("unauthenticated");
        }
      });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      const newUserId = newUser?.id ?? null;

      // Only update user state if user_id actually changed
      // (avoids re-renders from new User objects on TOKEN_REFRESHED)
      const isNewUser = newUserId !== currentUserIdRef.current;
      if (isNewUser) {
        currentUserIdRef.current = newUserId;
        safeSetUser(newUser);
      }

      if (newUser) {
        // Only re-fetch on SIGNED_IN (not INITIAL_SESSION, which is handled by getUser above).
        // Ignore TOKEN_REFRESHED to prevent infinite loop.
        // For INITIAL_SESSION, only fetch if not already fetched by getUser().
        if (event === "SIGNED_IN") {
          resetGlobalGuards();
          setTimeout(() => fetchProfile(newUser.id), 0);
        } else if (event === "INITIAL_SESSION" && isNewUser) {
          // Only fetch if getUser() hasn't already started a fetch for this user
          setTimeout(() => fetchProfile(newUser.id), 0);
        }
      } else if (event === "SIGNED_OUT") {
        // Sign-out — clean everything
        safeSetProfile(null);
        safeSetProfileError(null);
        safeSetLoading(false);
        safeSetStatus("unauthenticated");
        currentUserIdRef.current = null;
        resetGlobalGuards();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Sign out — SOTA 2026
   * Note: Prefer useSignOut() for guaranteed redirection
   */
  const signOut = async () => {
    try {
      // Clean local state and global guards immediately
      safeSetUser(null);
      safeSetProfile(null);
      safeSetProfileError(null);
      safeSetStatus("unauthenticated");
      currentUserIdRef.current = null;
      resetGlobalGuards();

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clean local cache
      if (typeof window !== "undefined") {
        try {
          const keysToRemove = Object.keys(localStorage).filter(
            (key) => key.startsWith("sb-") || key.includes("supabase")
          );
          keysToRemove.forEach((key) => localStorage.removeItem(key));
        } catch (e) {
          authLogger.warn("localStorage cleanup error", {
            error: String(e),
          });
        }
      }
    } catch (error) {
      authLogger.error("signOut error", error);
      // Don't throw — we want the redirect to happen regardless
    }
  };

  /**
   * Force-refresh the profile (e.g., after profile update)
   */
  const refreshProfile = async () => {
    if (user?.id) {
      resetGlobalGuards();
      safeSetProfileError(null);
      await fetchProfile(user.id, true);
    }
  };

  /**
   * Retry profile fetch after a profile_error.
   * Resets the creation guard so auto-creation can be attempted again.
   */
  const retryProfile = async () => {
    if (user?.id) {
      authLogger.info("Manual profile retry triggered", { userId: user.id });
      resetGlobalGuards();
      safeSetProfileError(null);
      safeSetStatus("loading_profile");
      safeSetLoading(true);
      await fetchProfile(user.id, true);
    }
  };

  return {
    user,
    profile,
    loading,
    /** @deprecated Use error.message instead */
    profileError: profileError?.message ?? null,
    error: profileError,
    status,
    signOut,
    isAuthenticated: !!user && !!profile,
    initialized: status !== "initializing",
    refreshProfile,
    retryProfile,
  };
}
