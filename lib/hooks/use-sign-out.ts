"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UseSignOutOptions {
  redirectTo?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook SOTA 2026 pour la déconnexion
 * - État de chargement
 * - Nettoyage complet du cache
 * - Redirection forcée garantie
 * - Protection contre double-clic (avec useRef)
 */
export function useSignOut(options: UseSignOutOptions = {}) {
  const { redirectTo = "/auth/signin", onSuccess, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  
  // ✅ FIX: Utiliser une ref pour éviter le problème de closure stale
  const isSigningOutRef = useRef(false);

  const signOut = useCallback(async () => {
    // Protection contre double-clic avec ref (pas de problème de closure)
    if (isSigningOutRef.current) {
      console.log("[useSignOut] Déjà en cours de déconnexion, ignoré");
      return;
    }

    isSigningOutRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log("[useSignOut] Déconnexion en cours...");

      const supabase = createClient();

      // 1. Déconnecter de Supabase
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error("[useSignOut] Erreur Supabase signOut:", signOutError);
        // On continue quand même pour nettoyer le client
      }

      // 2. Nettoyer le localStorage (tokens Supabase)
      if (typeof window !== "undefined") {
        try {
          const keysToRemove = Object.keys(localStorage).filter(
            (key) =>
              key.startsWith("sb-") ||
              key.includes("supabase") ||
              key.includes("auth")
          );
          keysToRemove.forEach((key) => {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              // Ignorer les erreurs individuelles
            }
          });

          // 3. Nettoyer sessionStorage également
          const sessionKeys = Object.keys(sessionStorage).filter(
            (key) =>
              key.startsWith("sb-") ||
              key.includes("supabase") ||
              key.includes("auth")
          );
          sessionKeys.forEach((key) => {
            try {
              sessionStorage.removeItem(key);
            } catch (e) {
              // Ignorer les erreurs individuelles
            }
          });

          console.log("[useSignOut] Cache local nettoyé");
        } catch (storageError) {
          console.warn("[useSignOut] Erreur nettoyage storage:", storageError);
        }
      }

      console.log("[useSignOut] Déconnexion réussie");
      onSuccess?.();
    } catch (err) {
      const error = err as Error;
      console.error("[useSignOut] Erreur:", error);
      setError(error);
      onError?.(error);
    } finally {
      // TOUJOURS rediriger, même en cas d'erreur
      // Utiliser window.location.href pour forcer un refresh complet
      // Cela garantit que tous les états React sont réinitialisés
      if (typeof window !== "undefined") {
        console.log("[useSignOut] Redirection forcée vers:", redirectTo);
        window.location.href = redirectTo;
      } else {
        router.push(redirectTo);
      }
    }
  }, [onSuccess, onError, redirectTo, router]); // ✅ isLoading retiré des dépendances

  return {
    signOut,
    isLoading,
    error,
  };
}
