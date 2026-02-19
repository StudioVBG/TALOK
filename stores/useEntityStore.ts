"use client";

/**
 * Store Zustand pour la gestion des entités juridiques
 * Gère l'entité active et la liste des entités du propriétaire
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export const useEntityStore = create<EntityState>()(
  persist(
    (set, get) => ({
      entities: [],
      activeEntityId: null,
      isLoading: false,
      lastFetchedAt: null,

      fetchEntities: async (_ownerProfileId: string) => {
        set({ isLoading: true });

        try {
          // Passer par l'API route qui utilise service_role (bypass RLS)
          // au lieu de requêtes Supabase directes bloquées par les policies
          // sur legal_entities (dépendance à owner_profiles).
          const res = await fetch("/api/owner/legal-entities?stats=true");

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            console.error("[EntityStore] API error:", res.status, body?.error);
            set({ isLoading: false });
            return;
          }

          const { entities: rawEntities } = await res.json();

          const entitySummaries: LegalEntitySummary[] = (rawEntities || []).map(
            (e: Record<string, unknown>) => ({
              id: e.id as string,
              nom: (e.nom as string) || "",
              entityType: (e.entity_type as string) || "particulier",
              legalForm: (e.forme_juridique as string) || null,
              fiscalRegime: (e.regime_fiscal as string) || null,
              siret: (e.siret as string) || null,
              codePostalSiege: (e.code_postal_siege as string) || null,
              villeSiege: (e.ville_siege as string) || null,
              isDefault: false,
              isActive: (e.is_active as boolean) ?? true,
              couleur: (e.couleur as string) || null,
              propertyCount: (e.property_count as number) || 0,
              activeLeaseCount: (e.lease_count as number) || 0,
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
        }
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
