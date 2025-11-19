"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Mode = "FAST" | "FULL";
type Step = "TYPE" | "ADDRESS" | "DETAILS" | "ROOMS" | "PHOTOS" | "FEATURES" | "PUBLISH" | "SUMMARY";

interface Address {
  adresse_complete?: string;
  complement_adresse?: string;
  code_postal?: string;
  ville?: string;
  departement?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Details {
  surface_m2?: number | null;
  rooms_count?: number | null;
  floor?: number | null;
  elevator?: boolean;
  dpe_classe_energie?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_classe_climat?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_consommation?: number | null;
  dpe_emissions?: number | null;
  permis_louer_requis?: boolean;
  permis_louer_numero?: string | null;
  permis_louer_date?: string | null;
}

interface Photo {
  id: string;
  file?: File;
  preview: string;
  isCover?: boolean;
  uploadProgress?: number;
  uploaded?: boolean;
  error?: string;
}

interface Room {
  id: string;
  room_type: string;
  name?: string;
  is_private?: boolean;
  sort_order: number;
}

interface Draft {
  kind?: "APARTMENT" | "HOUSE" | "STUDIO" | "COLOCATION" | "PARKING" | "BOX" | "RETAIL" | "OFFICE" | "WAREHOUSE" | "MIXED";
  address?: Address;
  details?: Details;
  rooms?: Room[];
  photos?: Photo[];
  features?: string[];
  is_published?: boolean;
  visibility?: "public" | "private";
  available_from?: string;
  property_id?: string;
  unit_id?: string;
  [key: string]: unknown;
}

interface NewPropertyState {
  mode: Mode;
  step: Step;
  draft: Draft;
  setMode: (mode: Mode) => void;
  setStep: (step: Step) => void;
  patch: (updates: Partial<Draft>) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
}

const FAST_FLOW: Step[] = ["TYPE", "ADDRESS", "PHOTOS", "SUMMARY"];
const FULL_FLOW: Step[] = ["TYPE", "ADDRESS", "DETAILS", "ROOMS", "PHOTOS", "FEATURES", "PUBLISH", "SUMMARY"];

export const useNewProperty = create<NewPropertyState>()(
  persist(
    (set, get) => ({
      mode: "FULL",
      step: "TYPE",
      draft: {},

      setMode: (mode) => {
        const { step } = get();
        const flow = mode === "FAST" ? FAST_FLOW : FULL_FLOW;
        // Si l'étape actuelle n'existe pas dans le nouveau flow, revenir à TYPE
        const newStep = flow.includes(step) ? step : "TYPE";
        set({ mode, step: newStep });
      },

      setStep: (step) => set({ step }),

      patch: (updates) => {
        set((state) => ({
          draft: { ...state.draft, ...updates },
        }));
      },

      next: () => {
        const { mode, step } = get();
        const flow = mode === "FAST" ? FAST_FLOW : FULL_FLOW;
        const currentIdx = flow.indexOf(step);
        if (currentIdx < flow.length - 1) {
          set({ step: flow[currentIdx + 1] });
        }
      },

      prev: () => {
        const { mode, step } = get();
        const flow = mode === "FAST" ? FAST_FLOW : FULL_FLOW;
        const currentIdx = flow.indexOf(step);
        if (currentIdx > 0) {
          set({ step: flow[currentIdx - 1] });
        }
      },

      reset: () => {
        set({ mode: "FULL", step: "TYPE", draft: {} });
      },
    }),
    {
      name: "new-property-storage",
      partialize: (state) => ({ mode: state.mode, step: state.step, draft: state.draft }),
    }
  )
);

