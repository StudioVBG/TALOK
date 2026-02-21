"use client";

/**
 * Store Zustand pour la gestion des entités juridiques
 * Gère l'entité active et la liste des entités du propriétaire
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";

// ============================================
// TYPES
// ============================================

export interface LegalEntitySummary {
  id: string;
  nom: string;
  entityType: string;
  legalForm: string | null;
  fiscalRegime: string | null;
  siret: string | null;
  codePostalSiege: string | null;
  villeSiege: string | null;
  isDefault: boolean;
  isActive: boolean;
  couleur: string | null;
  propertyCount: number;
  activeLeaseCount: number;
  hasIban: boolean;
}

interface EntityState {
  entities: LegalEntitySummary[];
  activeEntityId: string | null;
  isLoading: boolean;
  lastFetchedAt: number | null;

  // Actions
  fetchEntities: (ownerProfileId: string) => Promise<void>;
  setActiveEntity: (id: string | null) => void;
  addEntity: (entity: LegalEntitySummary) => void;
  updateEntity: (id: string, data: Partial<LegalEntitySummary>) => void;
  removeEntity: (id: string) => void;
  reset: () => void;

  // Helpers
  getActiveEntity: () => LegalEntitySummary | null;
  getDefaultEntity: () => LegalEntitySummary | undefined;
}

// ============================================
// STORE
// ============================================

// Mutex to prevent concurrent fetchEntities calls
let _fetchEntitiesMutex: Promise<void> | null = null;

export const useEntityStore = create<EntityState>()(
  persist(
    (set, get) => ({
      entities: [],
      activeEntityId: null,
      isLoading: false,
      lastFetchedAt: null,

      fetchEntities: async (ownerProfileId: string) => {
        // Prevent concurrent fetches - reuse existing promise if one is in-flight
        if (_fetchEntitiesMutex) {
          await _fetchEntitiesMutex;
          return;
        }

        set({ isLoading: true });

        _fetchEntitiesMutex = (async () => {
        try {
          const supabase = createClient();

          const { data: entities, error } = await supabase
            .from("legal_entities")
            .select("*")
            .eq("owner_profile_id", ownerProfileId)
            .eq("is_active", true)
            .order("nom");

          if (error) {
            console.error("[EntityStore] Error fetching entities:", error);
            set({ isLoading: false });
            return;
          }

          // Fetch property and lease counts per entity
          const entityIds = (entities || []).map((e: Record<string, unknown>) => e.id as string);
          const propertyCounts: Record<string, number> = {};
          const leaseCounts: Record<string, number> = {};

          // Trouver l'entité "particulier" pour y rattacher les biens sans entité
          const particulierEntity = (entities || []).find(
            (e: Record<string, unknown>) => e.entity_type === "particulier"
          );

          if (entityIds.length > 0) {
            // Fetch ALL properties to count both entity-assigned and personal
            const { data: props } = await supabase
              .from("properties")
              .select("legal_entity_id")
              .eq("owner_id", ownerProfileId)
              .is("deleted_at", null);
            if (props) {
              for (const p of props as any[]) {
                if (p.legal_entity_id && entityIds.includes(p.legal_entity_id)) {
                  // Bien affecté à une entité connue
                  propertyCounts[p.legal_entity_id] = (propertyCounts[p.legal_entity_id] || 0) + 1;
                } else if (!p.legal_entity_id && particulierEntity) {
                  // Bien sans entité → compter dans l'entité "particulier" (nom propre)
                  const pId = particulierEntity.id as string;
                  propertyCounts[pId] = (propertyCounts[pId] || 0) + 1;
                }
              }
            }

            const { data: leases } = await supabase
              .from("leases")
              .select("signatory_entity_id")
              .in("signatory_entity_id", entityIds)
              .in("statut", ["active", "pending_signature", "fully_signed"]);
            if (leases) {
              for (const l of leases as any[]) {
                if (l.signatory_entity_id) leaseCounts[l.signatory_entity_id] = (leaseCounts[l.signatory_entity_id] || 0) + 1;
              }
            }
          }

          const entitySummaries: LegalEntitySummary[] = (entities || []).map(
            (e: Record<string, unknown>) => ({
              id: e.id as string,
              nom: (e.nom as string) || "",
              entityType: (e.entity_type as string) || "particulier",
              legalForm: (e.forme_juridique as string) || null,
              fiscalRegime: (e.regime_fiscal as string) || null,
              siret: (e.siret as string) || null,
              codePostalSiege: (e.code_postal_siege as string) || null,
              villeSiege: (e.ville_siege as string) || null,
              isDefault: false, // Will be computed
              isActive: (e.is_active as boolean) ?? true,
              couleur: (e.couleur as string) || null,
              propertyCount: propertyCounts[e.id as string] || 0,
              activeLeaseCount: leaseCounts[e.id as string] || 0,
              hasIban: !!(e.iban as string),
            })
          );

          // Mark first entity as default if none set
          if (entitySummaries.length > 0 && !entitySummaries.some((e) => e.isDefault)) {
            entitySummaries[0].isDefault = true;
          }

          set({
            entities: entitySummaries,
            isLoading: false,
            lastFetchedAt: Date.now(),
          });
        } catch (err) {
          console.error("[EntityStore] Unexpected error:", err);
          set({ isLoading: false });
        } finally {
          _fetchEntitiesMutex = null;
        }
        })();

        await _fetchEntitiesMutex;
      },

      setActiveEntity: (id: string | null) => {
        set({ activeEntityId: id });
      },

      addEntity: (entity: LegalEntitySummary) => {
        set((state) => ({
          entities: [...state.entities, entity],
        }));
      },

      updateEntity: (id: string, data: Partial<LegalEntitySummary>) => {
        set((state) => ({
          entities: state.entities.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        }));
      },

      removeEntity: (id: string) => {
        set((state) => ({
          entities: state.entities.filter((e) => e.id !== id),
          activeEntityId:
            state.activeEntityId === id ? null : state.activeEntityId,
        }));
      },

      reset: () => {
        set({
          entities: [],
          activeEntityId: null,
          isLoading: false,
          lastFetchedAt: null,
        });
      },

      getActiveEntity: () => {
        const { entities, activeEntityId } = get();
        if (!activeEntityId) return null;
        return entities.find((e) => e.id === activeEntityId) || null;
      },

      getDefaultEntity: () => {
        const { entities } = get();
        return entities.find((e) => e.isDefault);
      },
    }),
    {
      name: "talok-entity-store",
      partialize: (state) => ({
        activeEntityId: state.activeEntityId,
      }),
    }
  )
);
