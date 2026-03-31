"use client";

/**
 * Hook React Query pour /api/me/profile
 *
 * Centralise TOUS les appels GET /api/me/profile dans un cache partagé.
 * Utiliser ce hook au lieu de fetch('/api/me/profile') directement.
 *
 * Le QueryClient (via QueryProvider) déduplique automatiquement :
 * - Appels concurrents identiques → 1 seul fetch
 * - staleTime 5 min → pas de re-fetch inutile
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "@/lib/types";

export const PROFILE_QUERY_KEY = ["me", "profile"] as const;

async function fetchProfile(): Promise<Profile | null> {
  const res = await fetch("/api/me/profile", { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(`Profile fetch failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Hook pour récupérer le profil utilisateur avec cache React Query.
 *
 * @param enabled - Activer/désactiver le fetch (ex: attendre que l'user soit authentifié)
 */
export function useProfileQuery(enabled = true) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes — profil change rarement
    gcTime: 10 * 60 * 1000,
    enabled,
    retry: 1,
  });
}

/**
 * Invalider le cache profil (après update, après sign-in, etc.)
 */
export function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
}
