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

import { useEffect, useRef, type ReactNode } from "react";
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
  const setActiveEntity = useEntityStore((s) => s.setActiveEntity);
  const hasAutoSelected = useRef(false);

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
                }
              } finally {
                ensureDefaultPromise = null;
              }
            })();
            await ensureDefaultPromise;
          }
        }

        // FIX 1: Auto-sélectionner la première entité si aucune n'est active
        const { activeEntityId, entities: finalEntities } = useEntityStore.getState();
        if (!activeEntityId && finalEntities.length > 0 && !hasAutoSelected.current) {
          hasAutoSelected.current = true;
          setActiveEntity(finalEntities[0].id);
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities, setActiveEntity]);

  // FIX 1: Réagir aussi quand entities change dans le store (ex: après ensureDefaultEntity)
  const entities = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);

  useEffect(() => {
    if (!activeEntityId && entities.length > 0) {
      setActiveEntity(entities[0].id);
    }
  }, [entities, activeEntityId, setActiveEntity]);

  return <>{children}</>;
}
