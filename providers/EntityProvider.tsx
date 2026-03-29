"use client";

/**
 * EntityProvider — Initialise le store entité au mount du dashboard owner
 *
 * Wrap le layout owner pour charger les entités et synchroniser l'entité active.
 * Si aucune entité n'est trouvée après le fetch, appelle ensureDefaultEntity()
 * pour auto-provisionner une entité "particulier" par défaut.
 *
 * Utilise un module-level promise pour dédupliquer les appels concurrents
 * (React strict mode, onglets multiples).
 */

import { useEffect, type ReactNode } from "react";
import { useEntityStore } from "@/stores/useEntityStore";
import { useAuth } from "@/lib/hooks/use-auth";

interface EntityProviderProps {
  children: ReactNode;
}

// Module-level deduplication: prevents concurrent ensureDefaultEntity() calls
let ensureDefaultPromise: Promise<void> | null = null;

export function EntityProvider({ children }: EntityProviderProps) {
  const { profile } = useAuth();
  const fetchEntities = useEntityStore((s) => s.fetchEntities);

  useEffect(() => {
    if (!profile?.id) return;

    // owner_profiles.profile_id === profiles.id === legal_entities.owner_profile_id
    // No intermediate query needed — profile.id is the owner_profile_id FK value.
    const loadEntities = async () => {
      try {
        const { entities, lastFetchedAt } = useEntityStore.getState();
        const isStale =
          !lastFetchedAt || Date.now() - lastFetchedAt > 5 * 60 * 1000;
        if (entities.length === 0 || isStale) {
          await fetchEntities(profile.id);
        }

        // Auto-sélectionner la première entité si aucune n'est active
        const { entities: freshEntities, activeEntityId } = useEntityStore.getState();
        if (!activeEntityId && freshEntities.length > 0) {
          useEntityStore.getState().setActiveEntity(freshEntities[0].id);
        }

        // Si toujours vide après fetch, auto-créer l'entité par défaut
        const currentEntities = useEntityStore.getState().entities;
        if (currentEntities.length === 0) {
          // Dédupliquer les appels concurrents (strict mode, multi-tab)
          if (ensureDefaultPromise) {
            await ensureDefaultPromise;
          } else {
            ensureDefaultPromise = (async () => {
              try {
                const { ensureDefaultEntity } = await import(
                  "@/app/owner/entities/actions"
                );
                const result = await ensureDefaultEntity();
                if (result.success) {
                  await fetchEntities(profile.id);
                  // Auto-sélectionner la nouvelle entité
                  const { entities: newEntities, activeEntityId: currentId } = useEntityStore.getState();
                  if (!currentId && newEntities.length > 0) {
                    useEntityStore.getState().setActiveEntity(newEntities[0].id);
                  }
                }
              } finally {
                ensureDefaultPromise = null;
              }
            })();
            await ensureDefaultPromise;
          }
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities]);

  return <>{children}</>;
}
