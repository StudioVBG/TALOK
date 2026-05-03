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
import { useToast } from "@/components/ui/use-toast";

interface EntityProviderProps {
  children: ReactNode;
}

// Module-level deduplication: prevents concurrent ensureDefaultEntity() calls
let ensureDefaultPromise: Promise<void> | null = null;

export function EntityProvider({ children }: EntityProviderProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
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
        const { entities: freshEntities, activeEntityId: initialActiveEntityId } = useEntityStore.getState();
        if (!initialActiveEntityId && freshEntities.length > 0) {
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
                } else {
                  toast({
                    title: "Configuration incomplète",
                    description:
                      "Impossible de créer votre entité par défaut. Créez-en une manuellement depuis Mes entités.",
                    variant: "destructive",
                  });
                }
              } finally {
                ensureDefaultPromise = null;
              }
            })();
            await ensureDefaultPromise;
          }
        }

        // Auto-sélectionner l'entité si aucune n'est active ou si l'entité
        // active n'existe plus dans la liste (supprimée, archivée, etc.)
        const state = useEntityStore.getState();
        const { activeEntityId, setActiveEntity } = state;
        const finalEntities = state.entities;

        if (finalEntities.length > 0) {
          const activeStillExists =
            activeEntityId &&
            finalEntities.some((e) => e.id === activeEntityId);

          if (!activeStillExists) {
            // Stratégie : sélectionner l'entité avec le plus de biens actifs,
            // puis de baux actifs. À propriétés égales, prendre la default.
            const best = [...finalEntities].sort((a, b) => {
              if (b.propertyCount !== a.propertyCount)
                return b.propertyCount - a.propertyCount;
              if (b.activeLeaseCount !== a.activeLeaseCount)
                return b.activeLeaseCount - a.activeLeaseCount;
              if (b.isDefault !== a.isDefault) return b.isDefault ? 1 : -1;
              return 0;
            })[0];

            setActiveEntity(best.id);
          }
        }
      } catch (err) {
        console.error("[EntityProvider] Error loading entities:", err);
        toast({
          title: "Erreur de chargement",
          description:
            "Impossible de charger vos entités juridiques. Rafraîchissez la page.",
          variant: "destructive",
        });
      }
    };

    loadEntities();
  }, [profile?.id, fetchEntities, setActiveEntity, toast]);

  // Reactive guard: if entities arrive after initial render and activeEntityId is still null
  const entities = useEntityStore((s) => s.entities);
  const activeEntityId = useEntityStore((s) => s.activeEntityId);

  useEffect(() => {
    if (!activeEntityId && entities.length > 0) {
      setActiveEntity(entities[0].id);
    }
  }, [entities, activeEntityId, setActiveEntity]);

  return <>{children}</>;
}
