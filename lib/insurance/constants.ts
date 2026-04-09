/**
 * Constantes du module assurances Talok
 */

import type { InsuranceType } from "./types";

/** Labels FR pour les types d'assurance */
export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  pno: "Assurance PNO",
  multirisques: "Multirisques habitation",
  rc_pro: "RC Professionnelle",
  decennale: "Garantie decennale",
  garantie_financiere: "Garantie financiere",
  gli: "Garantie loyers impayes",
};

/** Description courte pour chaque type */
export const INSURANCE_TYPE_DESCRIPTIONS: Record<InsuranceType, string> = {
  pno: "Proprietaire Non Occupant — obligatoire en copropriete",
  multirisques: "Couvre les risques du logement — obligatoire pour le locataire",
  rc_pro: "Responsabilite civile professionnelle — obligatoire pour les prestataires",
  decennale: "Garantie decennale — obligatoire 10 ans apres travaux",
  garantie_financiere: "Garantie financiere — obligatoire pour les agences (loi Hoguet)",
  gli: "Garantie loyers impayes — protege le proprietaire",
};

/** Types d'assurance par role */
export const INSURANCE_TYPES_BY_ROLE: Record<string, { type: InsuranceType; required: boolean; label: string }[]> = {
  owner: [
    { type: "pno", required: true, label: "PNO (obligatoire en copropriete)" },
    { type: "gli", required: false, label: "Garantie loyers impayes" },
  ],
  tenant: [
    { type: "multirisques", required: true, label: "Multirisques habitation (obligatoire)" },
  ],
  provider: [
    { type: "rc_pro", required: true, label: "RC Professionnelle (obligatoire)" },
    { type: "decennale", required: false, label: "Garantie decennale (si travaux)" },
  ],
  agency: [
    { type: "rc_pro", required: true, label: "RC Professionnelle (obligatoire)" },
    { type: "garantie_financiere", required: true, label: "Garantie financiere (loi Hoguet)" },
  ],
};

/** Couleurs pour les badges d'expiration */
export const EXPIRY_STATUS_CONFIG = {
  ok: { label: "Valide", color: "text-green-600", bg: "bg-green-50", border: "border-green-200", icon: "check-circle" },
  warning: { label: "Expire bientot", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", icon: "alert-triangle" },
  critical: { label: "Expire dans 7 jours", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: "alert-circle" },
  expired: { label: "Expiree", color: "text-red-700", bg: "bg-red-100", border: "border-red-300", icon: "x-circle" },
} as const;

/** Mapping type d'assurance -> type de document GED */
export const INSURANCE_TO_DOCUMENT_TYPE: Record<InsuranceType, string> = {
  pno: "assurance_pno",
  multirisques: "attestation_assurance",
  rc_pro: "assurance_rc_pro",
  decennale: "assurance_decennale",
  garantie_financiere: "assurance_garantie_financiere",
  gli: "assurance_gli",
};
