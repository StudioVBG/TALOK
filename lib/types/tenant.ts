/**
 * Types composites pour l'espace Locataire
 *
 * Ces types représentent les données telles qu'elles sont consommées
 * par les pages tenant, souvent le résultat de jointures Supabase.
 *
 * Les types de base (rows) sont dans @/lib/supabase/database.types.ts
 */

import type { LucideIcon } from "lucide-react";
import type {
  EDLRow,
  EDLItemRow,
  EDLMediaRow,
  EDLSignatureRow,
  PropertyRow,
  LeaseRow,
  ProfileRow,
  LeaseSignerRow,
  MeterRow,
  MeterReadingRow,
  EDLMeterReadingRow,
} from "@/lib/supabase/database.types";

// ============================================
// INSPECTIONS / EDL
// ============================================

/** Résultat de la requête edl_signatures avec relations imbriquées */
export interface TenantEDLSignatureWithDetails extends EDLSignatureRow {
  edl: (EDLRow & {
    lease?: (LeaseRow & { property?: PropertyRow | null }) | null;
    property_details?: PropertyRow | null;
  }) | null;
  invitation_token?: string;
  signer_profile_id?: string;
  signer_user_id?: string;
}

/** Item formaté pour la liste des EDL tenant */
export interface TenantEDLListItem {
  id: string;
  type: "entree" | "sortie";
  status: string;
  scheduled_at: string | null;
  created_at: string;
  invitation_token?: string;
  property: PropertyRow | null;
  isSigned: boolean;
  needsMySignature: boolean;
}

/** Signature EDL enrichie pour le détail */
export interface TenantEDLSignatureDisplay {
  id: string;
  signer_role: string;
  signed_at: string | null;
  signature_image_path: string | null;
  signature_image_url?: string;
  signer_profile_id?: string;
  signer_user_id?: string;
  signer_user?: string;
}

/** Relevé de compteur fusionné pour l'affichage EDL */
export interface TenantEDLMeterDisplay {
  id: string;
  type: string;
  meter_number: string | null;
  unit: string;
  reading_value?: number | null;
  reading_date?: string | null;
  photo_url?: string | null;
}

/** Pièce dans un EDL avec statistiques */
export interface TenantEDLRoom {
  name: string;
  items: EDLItemRow[];
  media: (EDLMediaRow & { signed_url?: string })[];
  stats: {
    total: number;
    good: number;
    bad: number;
  };
}

/** Props du composant TenantEDLDetailClient */
export interface TenantEDLDetailProps {
  edl: EDLRow & {
    lease?: (LeaseRow & { property?: PropertyRow }) | null;
    property_id?: string;
  };
  raw: EDLRow;
  mySignature: TenantEDLSignatureDisplay | null;
  rooms: TenantEDLRoom[];
  signatures: TenantEDLSignatureDisplay[];
  media: (EDLMediaRow & { signed_url?: string })[];
  meterReadings: TenantEDLMeterDisplay[];
  allPropertyMeters: TenantEDLMeterDisplay[];
  ownerProfile: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
  } | null;
}

// ============================================
// METERS / COMPTEURS
// ============================================

export interface MeterConfig {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
}

export interface TenantMeterDisplay extends MeterRow {
  last_reading?: number;
  last_reading_date?: string;
  estimated_monthly?: number | null;
}

// ============================================
// COLOCATION
// ============================================

export interface TenantRoommate {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  avatar_url: string | null;
  role: LeaseSignerRow["role"];
  share_percentage: number;
}

/** Données de bail pour la page colocation */
export interface TenantColocationLease {
  id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  statut: string;
  date_debut: string;
  date_fin: string | null;
  property: PropertyRow;
}

// ============================================
// APPLICATIONS / CANDIDATURES
// ============================================

export interface TenantApplication {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  rejection_reason: string | null;
  property: {
    id: string;
    adresse_complete: string | null;
    ville: string | null;
    type: string | null;
  } | null;
}

// ============================================
// MARKETPLACE
// ============================================

export interface MarketplaceOffer {
  id: number;
  category: string;
  provider: string;
  title: string;
  description: string;
  discount: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  url: string;
}

// ============================================
// NOTIFICATIONS
// ============================================

export type { Notification as TenantNotification } from "@/features/tenant/services/notifications.service";

// ============================================
// REWARDS
// ============================================

export type { RewardTransaction } from "@/lib/services/rewards.service";

// ============================================
// IDENTITY / CNI
// ============================================

export interface TenantProfileCNI {
  cni_recto_path: string | null;
  cni_verso_path: string | null;
  cni_verified_at: string | null;
  cni_verification_method: string | null;
  cni_number: string | null;
  cni_expiry_date: string | null;
  identity_data: Record<string, unknown> | null;
  kyc_status: string | null;
}

export interface CNIDocument {
  id: string;
  type: string;
  storage_path: string;
  expiry_date: string | null;
  verification_status: string | null;
  is_archived: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
  lease_id: string | null;
}

export interface TenantLeaseWithCNI {
  lease_id: string;
  lease_type: string;
  lease_status: string;
  property_address: string | null;
  property_city: string | null;
  documents: CNIDocument[];
}

// ============================================
// ONBOARDING
// ============================================

export interface OnboardingProgressStep {
  step: string;
}

export type OnboardingDraftData = Record<string, unknown>;

export type TenantOnboardingRole = "locataire_principal" | "colocataire" | "garant";

export type PaymentMethod = "sepa_sdd" | "carte_wallet" | "virement_sct" | "virement_inst";
