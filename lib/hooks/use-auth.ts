"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";
import type { ProfileRow } from "@/lib/supabase/typed-client";

// ======================================================================
// Guards GLOBAUX (au niveau module) — partagés entre toutes les instances
// de useAuth() pour éviter les doubles appels (layout + page).
// ======================================================================
let _globalProfilePromise: Promise<Profile | null> | null = null;
let _globalFetchedUserId: string | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<(Profile | ProfileRow) | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Ref locale pour le lock de concurrence intra-instance
  const fetchingRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, force = false) => {
    // Si une autre instance a déjà fetch ou est en train de fetch ce user,
    // réutiliser la même promesse globale
    if (!force && _globalFetchedUserId === userId && _globalProfilePromise) {
      try {
        const cachedProfile = await _globalProfilePromise;
        setProfile(cachedProfile);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Empêcher les appels concurrents au sein de cette instance
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    // Créer la promesse globale pour dédupliquer entre les instances
    _globalProfilePromise = (async (): Promise<Profile | null> => {
      try {
        // Utiliser maybeSingle() au lieu de single() pour éviter l'erreur 406
        // quand le profil n'existe pas encore (trigger handle_new_user non exécuté)
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          // Si erreur de récursion RLS, utiliser la route API en fallback
          if (error.code === '42P17' || error.message?.includes('infinite recursion')) {
            console.warn("RLS recursion detected, using API fallback");
            try {
              const response = await fetch("/api/me/profile", {
                credentials: "include",
              });
              if (response.ok) {
                return (await response.json()) as Profile;
              }
            } catch (apiError) {
              console.error("Error fetching profile from API:", apiError);
            }
          }
          throw error;
        }

        if (!data) {
          // Profil introuvable — le trigger handle_new_user n'a pas fonctionné.
          // Tenter de créer le profil via la route API (service role)
          console.warn("[useAuth] Profil introuvable pour user_id:", userId, "— tentative de création automatique");
          try {
            const response = await fetch("/api/me/profile", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: userId }),
            });
            if (response.ok) {
              return (await response.json()) as Profile;
            }
            console.error("[useAuth] Échec création profil automatique, status:", response.status);
          } catch (apiError) {
            console.error("[useAuth] Erreur création profil automatique:", apiError);
          }
          return null;
        }

        return data as Profile;
      } catch (err) {
        console.error("Error fetching profile:", err);
        return null;
      }
    })();

    // Marquer le user_id immédiatement pour bloquer les autres instances
    _globalFetchedUserId = userId;

    try {
      const result = await _globalProfilePromise;
      setProfile(result);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Récupère l'utilisateur actuel
    supabase.auth.getUser().then(({ data: { user: currentUser }, error }) => {
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

      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    });

    // Écoute les changements d'authentification
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser) {
        // Ne re-fetch que si c'est un nouvel utilisateur (SIGNED_IN)
        // ou le premier chargement (INITIAL_SESSION).
        // Ignorer TOKEN_REFRESHED pour éviter la boucle infinie.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          fetchProfile(newUser.id);
        }
      } else {
        // Déconnexion
        setProfile(null);
        setLoading(false);
        _globalFetchedUserId = null;
        _globalProfilePromise = null;
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonction publique pour forcer un refresh du profil (ex: après mise à jour)

  /**
   * Déconnexion SOTA 2026
   * Note: Préférez useSignOut() pour une redirection garantie
   */
  const signOut = async () => {
    try {
      // Nettoyer l'état local et les guards globaux immédiatement
      setUser(null);
      setProfile(null);
      _globalFetchedUserId = null;
      _globalProfilePromise = null;

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
      // Réinitialiser le guard global pour forcer un nouveau fetch
      _globalFetchedUserId = null;
      _globalProfilePromise = null;
      await fetchProfile(user.id, true);
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

