"use client";

/**
 * EntityProvider — Initialise le store entité au mount du dashboard owner
 *
 * Wrap le layout owner pour charger les entités et synchroniser l'entité active.
 */

import { useEffect, type ReactNode } from "react";
import { useEntityStore } from "@/stores/useEntityStore";
import { useAuth } from "@/lib/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

interface EntityProviderProps {
  children: ReactNode;
}

export function EntityProvider({ children }: EntityProviderProps) {
  const { profile } = useAuth();
  const { fetchEntities, entities, lastFetchedAt } = useEntityStore();

  useEffect(() => {
    if (!profile?.id) return;

    // Fetch owner_profile_id from profile
    const loadEntities = async () => {
      try {
        const supabase = createClient();
        const { data: ownerProfile } = await supabase
          .from("owner_profiles")
          .select("id")
          .eq("profile_id", profile.id)
          .single();

        if (ownerProfile?.id) {
          // Only re-fetch if stale (> 5 min) or empty
          const isStale =
            !lastFetchedAt || Date.now() - lastFetchedAt > 5 * 60 * 1000;
          if (entities.length === 0 || isStale) {
            await fetchEntities(ownerProfile.id as string);
          }
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities, entities.length, lastFetchedAt]);

  return <>{children}</>;
}
