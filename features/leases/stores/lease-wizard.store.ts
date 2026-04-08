/**
 * SOTA 2026 — Store Zustand pour le LeaseWizard
 *
 * Centralise les ~30 useState du wizard monolithique.
 * Le wizard ne conserve que l'orchestration des etapes et les appels au store.
 */

import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import type { ColocationConfigData } from "@/app/owner/leases/new/ColocationConfig";
import type { Invitee } from "@/app/owner/leases/new/MultiTenantInvite";
import type { Garant } from "@/app/owner/leases/new/GarantForm";
import type { FurnitureInventoryData } from "@/app/owner/leases/new/FurnitureInventoryStep";
import type { TaxRegimeData } from "@/app/owner/leases/new/TaxRegimeSelector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeaseType =
  | "nu"
  | "meuble"
  | "colocation"
  | "saisonnier"
  | "bail_mobilite"
  | "etudiant"
  | "commercial_3_6_9"
  | "commercial_derogatoire"
  | "professionnel"
  | "location_gerance";

export type ChargesType = "forfait" | "provisions";
export type CreationMode = "invite" | "manual";
export type PreviewTab = "bail" | "edl";

export interface CustomClause {
  id: string;
  text: string;
  isCustom: boolean;
}

export interface LeaseWizardState {
  // Navigation
  step: number;
  previewTab: PreviewTab;

  // Step 1: Type
  typeBail: LeaseType | null;

  // Step 2: Property + Entity
  propertyId: string | null;
  entityId: string | null;

  // Step 3: Financials
  loyer: number;
  charges: number;
  depot: number;
  propertyLoyer: number;
  chargesType: ChargesType;
  jourPaiement: number;
  dateDebut: string;

  // Tenant
  tenantEmail: string;
  tenantName: string;
  creationMode: CreationMode;

  // Colocation
  colocConfig: ColocationConfigData | null;
  invitees: Invitee[];

  // Garant
  hasGarant: boolean;
  garant: Garant | null;

  // Clauses
  customClauses: CustomClause[];

  // Meuble/BIC
  furnitureInventory: FurnitureInventoryData | null;
  taxRegime: TaxRegimeData | null;

  // Commercial
  destinationBail: string;
  activiteAutorisee: string;
  indexationType: "ILC" | "ILAT" | "IRL" | "";
  sousLocationAutorisee: boolean;
  droitPreference: boolean;

  // Location-gerance
  redevanceGerance: number;
  fondsDescription: string;

  // Acces
  wizardDigicode: string;
  wizardInterphone: string;

  // Submission
  isSubmitting: boolean;
}

export interface LeaseWizardActions {
  setStep: (step: number) => void;
  setPreviewTab: (tab: PreviewTab) => void;
  setTypeBail: (type: LeaseType | null) => void;
  setPropertyId: (id: string | null) => void;
  setEntityId: (id: string | null) => void;

  setFinancials: (data: Partial<Pick<LeaseWizardState, "loyer" | "charges" | "depot" | "chargesType" | "jourPaiement" | "dateDebut" | "propertyLoyer">>) => void;

  setTenant: (data: Partial<Pick<LeaseWizardState, "tenantEmail" | "tenantName" | "creationMode">>) => void;

  setColocation: (data: Partial<Pick<LeaseWizardState, "colocConfig" | "invitees">>) => void;
  setGarant: (hasGarant: boolean, garant: Garant | null) => void;
  setCustomClauses: (clauses: CustomClause[]) => void;

  setFurnished: (data: Partial<Pick<LeaseWizardState, "furnitureInventory" | "taxRegime">>) => void;
  setCommercial: (data: Partial<Pick<LeaseWizardState, "destinationBail" | "activiteAutorisee" | "indexationType" | "sousLocationAutorisee" | "droitPreference">>) => void;
  setGerance: (data: Partial<Pick<LeaseWizardState, "redevanceGerance" | "fondsDescription">>) => void;
  setAccess: (data: Partial<Pick<LeaseWizardState, "wizardDigicode" | "wizardInterphone">>) => void;

  setIsSubmitting: (v: boolean) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultDate(): string {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return first.toISOString().split("T")[0];
}

const initialState: LeaseWizardState = {
  step: 1,
  previewTab: "bail",
  typeBail: null,
  propertyId: null,
  entityId: null,
  loyer: 0,
  charges: 0,
  depot: 0,
  propertyLoyer: 0,
  chargesType: "forfait",
  jourPaiement: 5,
  dateDebut: defaultDate(),
  tenantEmail: "",
  tenantName: "",
  creationMode: "invite",
  colocConfig: null,
  invitees: [],
  hasGarant: false,
  garant: null,
  customClauses: [],
  furnitureInventory: null,
  taxRegime: null,
  destinationBail: "",
  activiteAutorisee: "",
  indexationType: "",
  sousLocationAutorisee: false,
  droitPreference: true,
  redevanceGerance: 0,
  fondsDescription: "",
  wizardDigicode: "",
  wizardInterphone: "",
  isSubmitting: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useLeaseWizardStore = create<LeaseWizardState & LeaseWizardActions>()(
  devtools(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ step }),
      setPreviewTab: (previewTab) => set({ previewTab }),
      setTypeBail: (typeBail) => set({ typeBail }),
      setPropertyId: (propertyId) => set({ propertyId }),
      setEntityId: (entityId) => set({ entityId }),

      setFinancials: (data) => set(data),
      setTenant: (data) => set(data),
      setColocation: (data) => set(data),
      setGarant: (hasGarant, garant) => set({ hasGarant, garant }),
      setCustomClauses: (customClauses) => set({ customClauses }),
      setFurnished: (data) => set(data),
      setCommercial: (data) => set(data),
      setGerance: (data) => set(data),
      setAccess: (data) => set(data),
      setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

      reset: () => set({ ...initialState, dateDebut: defaultDate() }),
    }),
    {
      name: "lease-wizard-draft",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isSubmitting, step, previewTab, ...rest } = state;
        return rest;
      },
    }
  ),
  { name: "LeaseWizardStore", enabled: process.env.NODE_ENV === "development" }
  )
);

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

export const selectIsColocation = (s: LeaseWizardState) => s.typeBail === "colocation";
export const selectIsFurnished = (s: LeaseWizardState) => ["meuble", "bail_mobilite", "etudiant"].includes(s.typeBail || "");
export const selectIsCommercial = (s: LeaseWizardState) => ["commercial_3_6_9", "commercial_derogatoire"].includes(s.typeBail || "");
export const selectIsProfessional = (s: LeaseWizardState) => s.typeBail === "professionnel";
export const selectIsGerance = (s: LeaseWizardState) => s.typeBail === "location_gerance";
