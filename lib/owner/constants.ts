/**
 * Constantes pour le Compte Propriétaire
 */

import type { OwnerModuleKey } from "./types";

export const OWNER_MODULES: Record<OwnerModuleKey, { label: string; icon: string }> = {
  habitation: {
    label: "Habitation",
    icon: "Home",
  },
  lcd: {
    label: "Location courte durée",
    icon: "Calendar",
  },
  pro: {
    label: "Professionnel",
    icon: "Building2",
  },
  parking: {
    label: "Parking",
    icon: "Car",
  },
};

export const PROPERTY_TYPES = {
  appartement: "Appartement",
  maison: "Maison",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  local_commercial: "Local commercial",
  bureau: "Bureau",
  parking: "Parking",
  box: "Box",
  entrepot: "Entrepôt",
} as const;

export const PROPERTY_STATUS_LABELS = {
  loue: "Loué",
  en_preavis: "En préavis",
  vacant: "Vacant",
  a_completer: "À compléter",
} as const;

export const LEASE_STATUS_LABELS = {
  draft: "Brouillon",
  pending_signature: "En attente de signature",
  active: "Actif",
  terminated: "Terminé",
} as const;

export const INVOICE_STATUS_LABELS = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  late: "En retard",
} as const;

export const DOCUMENT_TYPES = {
  bail: "Bail",
  avenant: "Avenant",
  EDL_entree: "État des lieux d'entrée",
  EDL_sortie: "État des lieux de sortie",
  quittance: "Quittance de loyer",
  attestation_assurance: "Attestation d'assurance",
  diagnostic: "Diagnostic",
  consentement: "Consentement",
  taxe_sejour: "Taxe de séjour",
  rapport_charges: "Rapport de charges",
  autres: "Autres",
} as const;

export const DOCUMENT_STATUS_LABELS = {
  active: "Actif",
  expiring_soon: "Bientôt expiré",
  expired: "Expiré",
  archived: "Archivé",
} as const;

