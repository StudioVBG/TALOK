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
  const autoSelectDoneRef = useRef(false);

  useEffect(() => {
    if (!profile?.id) return;

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

        // FIX 1: Auto-select first entity if activeEntityId is null
        const state = useEntityStore.getState();
        if (!state.activeEntityId && state.entities.length > 0 && !autoSelectDoneRef.current) {
          autoSelectDoneRef.current = true;
          const defaultEntity = state.entities.find((e) => e.isDefault);
          setActiveEntity(defaultEntity?.id ?? state.entities[0].id);
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities, setActiveEntity]);

  return <>{children}</>;
}
