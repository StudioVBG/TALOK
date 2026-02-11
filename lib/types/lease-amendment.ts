/**
 * Types TypeScript pour les Avenants au Bail
 * SOTA 2026
 */

export type AmendmentType =
  | "loyer"
  | "charges"
  | "duree"
  | "occupant_ajout"
  | "occupant_retrait"
  | "clause_ajout"
  | "clause_modification"
  | "clause_suppression"
  | "depot_garantie"
  | "usage"
  | "travaux"
  | "autre";

export type AmendmentStatus =
  | "draft"
  | "pending_signature"
  | "partially_signed"
  | "signed"
  | "cancelled"
  | "refused";

export interface LeaseAmendment {
  id: string;
  lease_id: string;
  amendment_type: AmendmentType;
  description: string;
  motif: string | null;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  effective_date: string;
  amendment_number: number;
  signed_by_owner: boolean;
  signed_by_tenant: boolean;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  status: AmendmentStatus;
  document_path: string | null;
  sealed_at: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAmendmentDTO {
  lease_id: string;
  amendment_type: AmendmentType;
  description: string;
  motif?: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  effective_date: string;
  notes?: string;
}

export const AMENDMENT_TYPE_LABELS: Record<AmendmentType, string> = {
  loyer: "Modification du loyer",
  charges: "Modification des charges",
  duree: "Modification de la durée",
  occupant_ajout: "Ajout d'un occupant",
  occupant_retrait: "Retrait d'un occupant",
  clause_ajout: "Ajout d'une clause",
  clause_modification: "Modification d'une clause",
  clause_suppression: "Suppression d'une clause",
  depot_garantie: "Modification du dépôt de garantie",
  usage: "Changement d'usage",
  travaux: "Accord de travaux",
  autre: "Autre modification",
};

export const AMENDMENT_STATUS_LABELS: Record<AmendmentStatus, string> = {
  draft: "Brouillon",
  pending_signature: "En attente de signature",
  partially_signed: "Partiellement signé",
  signed: "Signé",
  cancelled: "Annulé",
  refused: "Refusé",
};
