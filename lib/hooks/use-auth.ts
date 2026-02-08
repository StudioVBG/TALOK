"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import type { ProfileRow } from "@/lib/supabase/typed-client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(Profile | ProfileRow) | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Récupère l'utilisateur actuel
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      // Si erreur de refresh token, nettoyer et rediriger
      if (error && (
        error.message?.includes('refresh_token') ||
        error.message?.includes('Invalid Refresh Token') ||
        error.message?.includes('Refresh Token Not Found')
      )) {
        console.error('[useAuth] Refresh token invalide, nettoyage de la session');
        supabase.auth.signOut().finally(() => {
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
            window.location.href = '/auth/signin?error=session_expired';
          }
        });
        setLoading(false);
        return;
      }

      setUser(user);
      if (user) {
        fetchProfile(user.id);
      } else {
        setLoading(false);
      }
    });

    // Écoute les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        // Si erreur de récursion RLS, utiliser la route API en fallback
        if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
          console.warn("RLS recursion detected, using API fallback");
          try {
            const response = await fetch("/api/me/profile", {
              credentials: "include",
            });
            if (response.ok) {
              const profile = await response.json();
              setProfile(profile as Profile);
              setLoading(false);
              return;
            }
          } catch (apiError) {
            console.error("Error fetching profile from API:", apiError);
          }
        }
        throw error;
      }
      setProfile(data as Profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Déconnexion SOTA 2026
   * Note: Préférez useSignOut() pour une redirection garantie
   */
  const signOut = async () => {
    try {
      // Nettoyer l'état local immédiatement
      setUser(null);
      setProfile(null);

      // Déconnecter de Supabase
      await supabase.auth.signOut();

      // Nettoyer le cache local
      if (typeof window !== "undefined") {
        try {
          const keysToRemove = Object.keys(localStorage).filter(
            (key) => key.startsWith("sb-") || key.includes("supabase")
          );
          keysToRemove.forEach((key) => localStorage.removeItem(key));
        } catch (e) {
          console.warn("[useAuth] Erreur nettoyage localStorage:", e);
        }
      }
    } catch (error) {
      console.error("[useAuth] Erreur signOut:", error);
      // Ne pas throw, on veut que la redirection se fasse quand même
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  return {
    user,
    profile,
    loading,
    signOut,
    isAuthenticated: !!user,
    refreshProfile,
  };
}

