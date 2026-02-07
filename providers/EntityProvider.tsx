"use client";

/**
 * EntityProvider — Initialise le store entité au mount du dashboard owner
 *
 * Wrap le layout owner pour charger les entités et synchroniser l'entité active.
 */

import { useEffect, type ReactNode } from "react";
import { useEntityStore } from "@/stores/useEntityStore";
import { useAuth } from "@/lib/hooks/use-auth";

interface EntityProviderProps {
  children: ReactNode;
}

export function EntityProvider({ children }: EntityProviderProps) {
  const { profile } = useAuth();
  const { fetchEntities, entities, lastFetchedAt } = useEntityStore();

  useEffect(() => {
    if (!profile?.id) return;

    // owner_profiles.profile_id === profiles.id === legal_entities.owner_profile_id
    // No intermediate query needed — profile.id is the owner_profile_id FK value.
    const loadEntities = async () => {
      try {
        const isStale =
          !lastFetchedAt || Date.now() - lastFetchedAt > 5 * 60 * 1000;
        if (entities.length === 0 || isStale) {
          await fetchEntities(profile.id);
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities, entities.length, lastFetchedAt]);

  return <>{children}</>;
}
