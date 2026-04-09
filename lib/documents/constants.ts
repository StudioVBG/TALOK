/**
 * Source unique de verite pour la gestion documentaire Talok
 *
 * Synchronise avec migration 20251228000000_documents_sota.sql
 * Importer depuis ici dans TOUTES les routes, hooks et composants.
 */

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOCUMENT_TYPES = [
  // Contrats
  "bail", "avenant", "engagement_garant", "bail_signe_locataire", "bail_signe_proprietaire",
  // Identite
  "piece_identite", "cni_recto", "cni_verso", "passeport", "titre_sejour",
  // Finance
  "quittance", "facture", "rib", "avis_imposition", "bulletin_paie", "attestation_loyer", "justificatif_revenus",
  // Assurance
  "attestation_assurance", "assurance_pno", "assurance_rc_pro", "assurance_decennale",
  "assurance_gli", "assurance_garantie_financiere",
  // Diagnostics
  "diagnostic", "dpe", "diagnostic_gaz", "diagnostic_electricite",
  "diagnostic_plomb", "diagnostic_amiante", "diagnostic_termites",
  "diagnostic_tertiaire", "diagnostic_performance", "erp",
  // Etats des lieux
  "EDL_entree", "EDL_sortie", "inventaire",
  // Candidature
  "candidature_identite", "candidature_revenus", "candidature_domicile", "candidature_garantie",
  // Garant
  "garant_identite", "garant_revenus", "garant_domicile", "garant_engagement",
  // Prestataire
  "devis", "ordre_mission", "rapport_intervention",
  // Copropriete
  "taxe_fonciere", "taxe_sejour", "copropriete", "proces_verbal", "appel_fonds",
  // Divers
  "annexe_pinel", "etat_travaux", "publication_jal", "consentement", "courrier", "photo", "autre",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// ============================================
// CATEGORIES
// ============================================

export const DOCUMENT_CATEGORIES = [
  "contrat", "identite", "finance", "assurance", "diagnostic",
  "edl", "candidature", "garant", "prestataire", "copropriete", "autre",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

// ============================================
// TYPE -> CATEGORIE
// ============================================

export const TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  bail: "contrat", avenant: "contrat", engagement_garant: "contrat",
  bail_signe_locataire: "contrat", bail_signe_proprietaire: "contrat",

  piece_identite: "identite", cni_recto: "identite", cni_verso: "identite",
  passeport: "identite", titre_sejour: "identite",

  quittance: "finance", facture: "finance", rib: "finance",
  avis_imposition: "finance", bulletin_paie: "finance",
  attestation_loyer: "finance", justificatif_revenus: "finance",

  attestation_assurance: "assurance", assurance_pno: "assurance",
  assurance_rc_pro: "assurance", assurance_decennale: "assurance",
  assurance_gli: "assurance", assurance_garantie_financiere: "assurance",

  diagnostic: "diagnostic", dpe: "diagnostic", diagnostic_gaz: "diagnostic",
  diagnostic_electricite: "diagnostic", diagnostic_plomb: "diagnostic",
  diagnostic_amiante: "diagnostic", diagnostic_termites: "diagnostic",
  diagnostic_tertiaire: "diagnostic", diagnostic_performance: "diagnostic", erp: "diagnostic",

  EDL_entree: "edl", EDL_sortie: "edl", inventaire: "edl",

  candidature_identite: "candidature", candidature_revenus: "candidature",
  candidature_domicile: "candidature", candidature_garantie: "candidature",

  garant_identite: "garant", garant_revenus: "garant",
  garant_domicile: "garant", garant_engagement: "garant",

  devis: "prestataire", ordre_mission: "prestataire", rapport_intervention: "prestataire",

  taxe_fonciere: "copropriete", taxe_sejour: "copropriete",
  copropriete: "copropriete", proces_verbal: "copropriete", appel_fonds: "copropriete",

  annexe_pinel: "autre", etat_travaux: "autre", publication_jal: "autre",
  consentement: "autre", courrier: "autre", photo: "autre", autre: "autre",
};

// ============================================
// TYPE -> LABEL FR
// ============================================

export const TYPE_TO_LABEL: Record<DocumentType, string> = {
  bail: "Contrat de bail",
  avenant: "Avenant au bail",
  engagement_garant: "Engagement de caution",
  bail_signe_locataire: "Bail signe (locataire)",
  bail_signe_proprietaire: "Bail signe (proprietaire)",
  piece_identite: "Piece d'identite",
  cni_recto: "Carte d'identite (recto)",
  cni_verso: "Carte d'identite (verso)",
  passeport: "Passeport",
  titre_sejour: "Titre de sejour",
  quittance: "Quittance de loyer",
  facture: "Facture",
  rib: "RIB",
  avis_imposition: "Avis d'imposition",
  bulletin_paie: "Bulletin de paie",
  attestation_loyer: "Attestation de loyer",
  justificatif_revenus: "Justificatif de revenus",
  attestation_assurance: "Attestation d'assurance",
  assurance_pno: "Assurance PNO",
  assurance_rc_pro: "Assurance RC Professionnelle",
  assurance_decennale: "Assurance decennale",
  assurance_gli: "Assurance GLI",
  assurance_garantie_financiere: "Garantie financiere",
  diagnostic: "Diagnostic",
  dpe: "DPE",
  diagnostic_gaz: "Diagnostic gaz",
  diagnostic_electricite: "Diagnostic electricite",
  diagnostic_plomb: "Diagnostic plomb",
  diagnostic_amiante: "Diagnostic amiante",
  diagnostic_termites: "Diagnostic termites",
  diagnostic_tertiaire: "Diagnostic tertiaire",
  diagnostic_performance: "Diagnostic de performance",
  erp: "Etat des risques (ERP)",
  EDL_entree: "Etat des lieux d'entree",
  EDL_sortie: "Etat des lieux de sortie",
  inventaire: "Inventaire mobilier",
  candidature_identite: "Candidature - Identite",
  candidature_revenus: "Candidature - Revenus",
  candidature_domicile: "Candidature - Domicile",
  candidature_garantie: "Candidature - Garantie",
  garant_identite: "Garant - Identite",
  garant_revenus: "Garant - Revenus",
  garant_domicile: "Garant - Domicile",
  garant_engagement: "Garant - Engagement",
  devis: "Devis",
  ordre_mission: "Ordre de mission",
  rapport_intervention: "Rapport d'intervention",
  taxe_fonciere: "Taxe fonciere",
  taxe_sejour: "Taxe de sejour",
  copropriete: "Document copropriete",
  proces_verbal: "Proces-verbal",
  appel_fonds: "Appel de fonds",
  annexe_pinel: "Annexe Pinel",
  etat_travaux: "Etat des travaux",
  publication_jal: "Publication JAL",
  consentement: "Consentement",
  courrier: "Courrier",
  photo: "Photo",
  autre: "Autre document",
};

// ============================================
// MIME TYPES AUTORISES
// ============================================

export const ALLOWED_MIME_TYPES = {
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "text/plain",
  ],
  images: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  spreadsheets: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
} as const;

export const ALL_ALLOWED_MIME_TYPES: readonly string[] = [
  ...ALLOWED_MIME_TYPES.documents,
  ...ALLOWED_MIME_TYPES.images,
  ...ALLOWED_MIME_TYPES.spreadsheets,
];

// ============================================
// TAILLE MAXIMALE
// ============================================

/** 50 Mo — aligne avec la config du bucket Supabase */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ============================================
// GROUPEMENT DOCUMENTS (CNI, etc.)
// ============================================

export interface DocumentGroup {
  group: string;
  parts: DocumentType[];
  label: string;
}

export const GROUPED_DOCUMENT_TYPES: DocumentGroup[] = [
  { group: "cni", parts: ["cni_recto", "cni_verso"], label: "Carte d'identite" },
];

// ============================================
// DOCUMENTS AVEC EXPIRATION
// ============================================

export const EXPIRABLE_DOCUMENT_TYPES: DocumentType[] = [
  "cni_recto", "cni_verso", "passeport", "titre_sejour",
  "attestation_assurance", "assurance_pno", "assurance_rc_pro",
  "assurance_decennale", "assurance_gli", "assurance_garantie_financiere",
  "dpe", "diagnostic_gaz", "diagnostic_electricite",
  "diagnostic_plomb", "diagnostic_amiante", "diagnostic_termites",
  "diagnostic_tertiaire", "diagnostic_performance", "erp",
];

// ============================================
// DOCUMENTS REQUIS DOSSIER CANDIDATURE
// ============================================

export const REQUIRED_TENANT_DOCS: { type: DocumentType; label: string }[] = [
  { type: "piece_identite", label: "Piece d'identite" },
  { type: "justificatif_revenus", label: "Justificatif de revenus" },
  { type: "avis_imposition", label: "Avis d'imposition" },
  { type: "attestation_assurance", label: "Attestation d'assurance habitation" },
];

// ============================================
// DOCUMENTS GENERES AUTOMATIQUEMENT
// ============================================

export const AUTO_GENERATED_DOCS: { trigger: string; type: DocumentType; label: string }[] = [
  { trigger: "lease_sealed", type: "bail", label: "Bail de location signe" },
  { trigger: "payment_succeeded", type: "quittance", label: "Quittance de loyer" },
  { trigger: "edl_signed", type: "EDL_entree", label: "Etat des lieux d'entree" },
  { trigger: "edl_sortie_signed", type: "EDL_sortie", label: "Etat des lieux de sortie" },
];
