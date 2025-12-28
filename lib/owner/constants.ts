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
  bail: "Bail de location",
  avenant: "Avenant au bail",
  EDL_entree: "État des lieux d'entrée",
  EDL_sortie: "État des lieux de sortie",
  quittance: "Quittance de loyer",
  facture: "Facture",
  attestation_assurance: "Attestation d'assurance",
  justificatif_revenus: "Justificatif de revenus",
  piece_identite: "Pièce d'identité",
  cni_recto: "Carte d'Identité (Recto)",
  cni_verso: "Carte d'Identité (Verso)",
  passeport: "Passeport",
  rib: "RIB / Coordonnées bancaires",
  avis_imposition: "Avis d'imposition",
  bulletin_paie: "Bulletin de paie",
  attestation_loyer: "Attestation de loyer",
  diagnostic: "Dossier Diagnostic Technique (DDT)",
  dpe: "DPE (Diagnostic Performance Énergétique)",
  diagnostic_gaz: "Diagnostic Gaz",
  diagnostic_electricite: "Diagnostic Électricité",
  diagnostic_plomb: "Diagnostic Plomb (CREP)",
  diagnostic_amiante: "Diagnostic Amiante",
  diagnostic_termites: "Diagnostic Termites",
  erp: "ERP (État des Risques et Pollutions)",
  taxe_fonciere: "Taxe foncière",
  taxe_sejour: "Taxe de séjour",
  copropriete: "Règlement de copropriété",
  proces_verbal: "Procès-verbal d'AG",
  appel_fonds: "Appel de fonds",
  devis: "Devis",
  ordre_mission: "Ordre de mission",
  rapport_intervention: "Rapport d'intervention",
  engagement_garant: "Acte de cautionnement",
  consentement: "Consentement RGPD",
  courrier: "Courrier",
  photo: "Photo / Justificatif visuel",
  autres: "Autre document",
} as const;

export const DOCUMENT_STATUS_LABELS = {
  active: "Actif",
  expiring_soon: "Bientôt expiré",
  expired: "Expiré",
  archived: "Archivé",
} as const;

