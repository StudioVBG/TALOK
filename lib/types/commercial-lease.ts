/**
 * Types TypeScript pour les baux commerciaux
 *
 * Régime juridique :
 * - Bail commercial 3/6/9 : Articles L145-1 et suivants du Code de commerce
 * - Bail dérogatoire : Article L145-5 du Code de commerce (max 3 ans)
 *
 * Caractéristiques principales :
 * - Durée minimale 9 ans (3/6/9) ou max 3 ans (dérogatoire)
 * - Indexation sur ILC (Indice des Loyers Commerciaux)
 * - Droit au renouvellement (propriété commerciale)
 * - Possibilité de pas-de-porte et droit au bail
 */

// ============================================
// ENUMS - TYPES DE BAIL COMMERCIAL
// ============================================

/**
 * Types de baux commerciaux disponibles
 */
export type CommercialLeaseType =
  | "commercial_3_6_9"        // Bail commercial classique
  | "commercial_derogatoire"  // Bail dérogatoire (max 3 ans)
  | "commercial_saisonnier";  // Location saisonnière commerciale

/**
 * Régime de TVA applicable
 */
export type CommercialTVARegime =
  | "non_assujetti"          // Pas de TVA (exonéré)
  | "tva_sur_loyer"          // TVA sur option (art. 260-2° CGI)
  | "tva_obligatoire";       // TVA obligatoire (locaux aménagés)

/**
 * Type d'activité autorisée
 */
export type CommercialActivityType =
  | "commerce_detail"         // Commerce de détail
  | "restauration"            // Restaurant, bar, café
  | "services"                // Services aux particuliers/entreprises
  | "artisanat"               // Artisanat
  | "bureaux"                 // Activité de bureaux
  | "industrie_legere"        // Industrie légère, atelier
  | "entrepot"                // Stockage, logistique
  | "medical_paramedical"     // Professions médicales
  | "hotel"                   // Hôtellerie
  | "autre";                  // Autre activité

/**
 * Clause de destination du bail
 */
export type DestinationClause =
  | "tous_commerces"          // Tous commerces (clause large)
  | "activite_precise"        // Activité précise uniquement
  | "activites_connexes";     // Activité + activités connexes

/**
 * Type de charges
 */
export type CommercialChargesType =
  | "forfait"                 // Charges forfaitaires
  | "provisions"              // Provisions avec régularisation
  | "reel";                   // Charges réelles

/**
 * Périodicité de révision du loyer
 */
export type RevisionPeriodicity =
  | "annuelle"                // Révision annuelle
  | "triennale";              // Révision triennale (légale)

/**
 * Indice de référence pour l'indexation
 */
export type CommercialIndex =
  | "ILC"                     // Indice des Loyers Commerciaux
  | "ILAT"                    // Indice des Loyers des Activités Tertiaires
  | "ICC";                    // Indice du Coût de la Construction (obsolète)

/**
 * Statut du droit au renouvellement
 */
export type RenewalRightStatus =
  | "applicable"              // Droit au renouvellement applicable
  | "renonce"                 // Renonciation (bail dérogatoire)
  | "exclu";                  // Exclu (certains locaux)

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Informations sur le pas-de-porte
 */
export interface PasDePorte {
  montant: number;
  type: "supplement_loyer" | "indemnite" | "droit_entree";
  modalites_paiement: "comptant" | "echelonne";
  echeances?: PasDePorteEcheance[];
  tva_applicable: boolean;
  justification?: string;
}

export interface PasDePorteEcheance {
  date: string;
  montant: number;
  paye: boolean;
}

/**
 * Informations sur le droit au bail (cession)
 */
export interface DroitAuBail {
  cessible: boolean;
  conditions_cession?: string;
  agrement_bailleur_requis: boolean;
  indemnite_cession?: number;
  clause_solidarite_duree_mois?: number; // Ex: 24 mois
}

/**
 * Travaux et aménagements
 */
export interface TravauxAmenagements {
  travaux_preneur: string[];
  travaux_bailleur: string[];
  autorisation_travaux_requise: boolean;
  franchise_travaux_mois?: number;
  indemnite_fin_bail: "remboursement" | "propriete_bailleur" | "remise_etat";
}

/**
 * Clause d'indexation
 */
export interface IndexationClause {
  indice: CommercialIndex;
  indice_base: number;
  indice_base_date: string; // Format "T1 2026"
  periodicite: RevisionPeriodicity;
  plafonnement: boolean;
  plafond_hausse_percent?: number;
  lissage_deplafonnement: boolean;
}

/**
 * Répartition des charges et taxes
 */
export interface ChargesRepartition {
  taxe_fonciere: "bailleur" | "preneur" | "partage";
  taxe_fonciere_quote_part?: number; // Si partage, % preneur
  charges_copropriete: "bailleur" | "preneur" | "partage";
  charges_copropriete_quote_part?: number;
  assurance_immeuble: "bailleur" | "preneur";
  gros_travaux_article_606: "bailleur" | "preneur"; // Normalement bailleur
  entretien_courant: "preneur";
  honoraires_gestion?: number; // % du loyer
}

/**
 * Garanties demandées
 */
export interface CommercialGuarantees {
  depot_garantie_mois: number; // Généralement 3 ou 6 mois
  garantie_bancaire: boolean;
  garantie_bancaire_montant?: number;
  caution_personnelle: boolean;
  caution_solidaire: boolean;
  assurance_loyers_impayes: boolean;
}

/**
 * Clause résolutoire
 */
export interface ClauseResolutoire {
  applicable: boolean;
  delai_commandement_jours: number; // Minimum 1 mois légal
  causes: string[]; // Ex: "non-paiement loyer", "non-respect destination"
}

/**
 * Configuration complète d'un bail commercial
 */
export interface CommercialLeaseConfig {
  // Identification
  type_bail: CommercialLeaseType;
  reference?: string;

  // Durée
  duree_annees: number; // 9 pour 3/6/9, max 3 pour dérogatoire
  date_debut: string;
  date_fin?: string;
  reconduction_tacite: boolean;

  // Destination
  destination: DestinationClause;
  activite_autorisee: string; // Description précise
  activite_type: CommercialActivityType;
  sous_location_autorisee: boolean;
  cession_fonds_autorisee: boolean;

  // Financier
  loyer_annuel_ht: number;
  loyer_mensuel_ht: number;
  tva_regime: CommercialTVARegime;
  tva_taux: number; // 20% standard
  loyer_annuel_ttc?: number;
  loyer_mensuel_ttc?: number;

  // Charges
  charges_type: CommercialChargesType;
  charges_provisions_mensuelles?: number;
  charges_forfait_mensuel?: number;

  // Indexation
  indexation: IndexationClause;

  // Dépôt et garanties
  garanties: CommercialGuarantees;

  // Pas-de-porte
  pas_de_porte?: PasDePorte;

  // Droit au bail
  droit_au_bail: DroitAuBail;

  // Travaux
  travaux: TravauxAmenagements;

  // Répartition charges/taxes
  repartition_charges: ChargesRepartition;

  // Clause résolutoire
  clause_resolutoire: ClauseResolutoire;

  // Droit au renouvellement (3/6/9 uniquement)
  droit_renouvellement: RenewalRightStatus;
  indemnite_eviction_applicable: boolean;

  // Spécificités bail dérogatoire
  derogation_article_l145_5?: boolean;
  derogation_justification?: string;
  transformation_bail_commercial_auto?: boolean;

  // Divers
  etat_des_lieux_entree: boolean;
  annexe_etat_locaux?: boolean;
  diagnostics_annexes: string[];
}

// ============================================
// INTERFACE BAIL COMMERCIAL (DB)
// ============================================

/**
 * Extension du bail pour les données commerciales
 */
export interface CommercialLeaseData {
  // Identifiant du bail parent
  lease_id: string;

  // Type spécifique
  commercial_type: CommercialLeaseType;

  // Destination et activité
  destination_clause: DestinationClause;
  activite_autorisee: string;
  activite_type: CommercialActivityType;
  sous_location_autorisee: boolean;

  // Financier
  loyer_annuel_ht: number;
  tva_regime: CommercialTVARegime;
  tva_taux: number | null;

  // Indexation
  indice_reference: CommercialIndex;
  indice_base: number;
  indice_base_date: string;
  revision_periodicite: RevisionPeriodicity;
  plafonnement_actif: boolean;

  // Pas-de-porte
  pas_de_porte_montant: number | null;
  pas_de_porte_type: string | null;

  // Droit au bail
  droit_au_bail_cessible: boolean;
  agrement_bailleur_requis: boolean;

  // Garanties
  depot_garantie_mois: number;
  garantie_bancaire_montant: number | null;
  caution_personnelle: boolean;

  // Charges
  repartition_taxe_fonciere: string;
  repartition_charges_copro: string;

  // Clause résolutoire
  clause_resolutoire_active: boolean;
  delai_commandement_jours: number;

  // Droit au renouvellement
  droit_renouvellement: RenewalRightStatus;

  // Métadonnées
  created_at: string;
  updated_at: string;
}

// ============================================
// DTOs
// ============================================

export interface CreateCommercialLeaseDTO {
  // Données bail standard
  property_id: string;
  type_bail: CommercialLeaseType;
  date_debut: string;
  date_fin?: string;

  // Preneur
  preneur_type: "entreprise" | "auto_entrepreneur" | "association";
  preneur_raison_sociale: string;
  preneur_siret: string;
  preneur_rcs?: string;
  preneur_representant_nom: string;
  preneur_representant_qualite: string;
  preneur_adresse: string;
  preneur_email: string;
  preneur_telephone?: string;

  // Configuration commerciale
  config: Partial<CommercialLeaseConfig>;
}

export interface UpdateCommercialLeaseDTO {
  config?: Partial<CommercialLeaseConfig>;
  loyer_annuel_ht?: number;
  charges_provisions?: number;
}

// ============================================
// CONSTANTES ET LABELS
// ============================================

export const COMMERCIAL_LEASE_TYPE_LABELS: Record<CommercialLeaseType, string> = {
  commercial_3_6_9: "Bail commercial 3/6/9",
  commercial_derogatoire: "Bail dérogatoire (max 3 ans)",
  commercial_saisonnier: "Location saisonnière commerciale",
};

export const COMMERCIAL_ACTIVITY_LABELS: Record<CommercialActivityType, string> = {
  commerce_detail: "Commerce de détail",
  restauration: "Restauration / Bar / Café",
  services: "Services",
  artisanat: "Artisanat",
  bureaux: "Bureaux",
  industrie_legere: "Industrie légère / Atelier",
  entrepot: "Entrepôt / Logistique",
  medical_paramedical: "Médical / Paramédical",
  hotel: "Hôtellerie",
  autre: "Autre activité",
};

export const DESTINATION_CLAUSE_LABELS: Record<DestinationClause, string> = {
  tous_commerces: "Tous commerces",
  activite_precise: "Activité précise uniquement",
  activites_connexes: "Activité principale + connexes",
};

export const TVA_REGIME_LABELS: Record<CommercialTVARegime, string> = {
  non_assujetti: "Non assujetti à la TVA",
  tva_sur_loyer: "TVA sur option (art. 260-2° CGI)",
  tva_obligatoire: "TVA obligatoire",
};

export const COMMERCIAL_INDEX_LABELS: Record<CommercialIndex, string> = {
  ILC: "ILC (Indice des Loyers Commerciaux)",
  ILAT: "ILAT (Indice des Loyers Activités Tertiaires)",
  ICC: "ICC (Indice Coût Construction) - Obsolète",
};

export const REVISION_PERIODICITY_LABELS: Record<RevisionPeriodicity, string> = {
  annuelle: "Annuelle",
  triennale: "Triennale (légale)",
};

export const CHARGES_TYPE_LABELS: Record<CommercialChargesType, string> = {
  forfait: "Forfait mensuel",
  provisions: "Provisions avec régularisation",
  reel: "Charges réelles",
};

export const RENEWAL_RIGHT_LABELS: Record<RenewalRightStatus, string> = {
  applicable: "Droit au renouvellement applicable",
  renonce: "Renonciation au statut des baux commerciaux",
  exclu: "Exclu du statut",
};

// ============================================
// VALEURS PAR DÉFAUT
// ============================================

/**
 * Configuration par défaut pour un bail commercial 3/6/9
 */
export const DEFAULT_COMMERCIAL_369_CONFIG: Partial<CommercialLeaseConfig> = {
  type_bail: "commercial_3_6_9",
  duree_annees: 9,
  reconduction_tacite: true,
  destination: "activite_precise",
  sous_location_autorisee: false,
  cession_fonds_autorisee: true,
  tva_regime: "tva_sur_loyer",
  tva_taux: 20,
  charges_type: "provisions",
  indexation: {
    indice: "ILC",
    indice_base: 0,
    indice_base_date: "",
    periodicite: "annuelle",
    plafonnement: false,
    lissage_deplafonnement: false,
  },
  garanties: {
    depot_garantie_mois: 3,
    garantie_bancaire: false,
    caution_personnelle: false,
    caution_solidaire: true,
    assurance_loyers_impayes: false,
  },
  droit_au_bail: {
    cessible: true,
    agrement_bailleur_requis: true,
    clause_solidarite_duree_mois: 24,
  },
  travaux: {
    travaux_preneur: [],
    travaux_bailleur: [],
    autorisation_travaux_requise: true,
    indemnite_fin_bail: "propriete_bailleur",
  },
  repartition_charges: {
    taxe_fonciere: "preneur",
    charges_copropriete: "preneur",
    assurance_immeuble: "bailleur",
    gros_travaux_article_606: "bailleur",
    entretien_courant: "preneur",
  },
  clause_resolutoire: {
    applicable: true,
    delai_commandement_jours: 30,
    causes: [
      "Défaut de paiement du loyer ou des charges",
      "Non-respect de la destination des lieux",
      "Sous-location non autorisée",
      "Défaut d'assurance",
    ],
  },
  droit_renouvellement: "applicable",
  indemnite_eviction_applicable: true,
  etat_des_lieux_entree: true,
};

/**
 * Configuration par défaut pour un bail dérogatoire
 */
export const DEFAULT_COMMERCIAL_DEROGATOIRE_CONFIG: Partial<CommercialLeaseConfig> = {
  type_bail: "commercial_derogatoire",
  duree_annees: 2, // Max 3 ans (total cumulé)
  reconduction_tacite: false, // Attention: si prolongé, devient 3/6/9
  destination: "activite_precise",
  sous_location_autorisee: false,
  cession_fonds_autorisee: false,
  tva_regime: "tva_sur_loyer",
  tva_taux: 20,
  charges_type: "forfait",
  indexation: {
    indice: "ILC",
    indice_base: 0,
    indice_base_date: "",
    periodicite: "annuelle",
    plafonnement: false,
    lissage_deplafonnement: false,
  },
  garanties: {
    depot_garantie_mois: 2,
    garantie_bancaire: false,
    caution_personnelle: true,
    caution_solidaire: false,
    assurance_loyers_impayes: false,
  },
  droit_au_bail: {
    cessible: false,
    agrement_bailleur_requis: true,
  },
  travaux: {
    travaux_preneur: [],
    travaux_bailleur: [],
    autorisation_travaux_requise: true,
    indemnite_fin_bail: "remise_etat",
  },
  repartition_charges: {
    taxe_fonciere: "bailleur",
    charges_copropriete: "preneur",
    assurance_immeuble: "bailleur",
    gros_travaux_article_606: "bailleur",
    entretien_courant: "preneur",
  },
  clause_resolutoire: {
    applicable: true,
    delai_commandement_jours: 15,
    causes: [
      "Défaut de paiement du loyer",
      "Non-respect de la destination",
    ],
  },
  droit_renouvellement: "renonce",
  indemnite_eviction_applicable: false,
  derogation_article_l145_5: true,
  transformation_bail_commercial_auto: true, // Si > 3 ans
  etat_des_lieux_entree: true,
};

// ============================================
// RÈGLES MÉTIER
// ============================================

/**
 * Durées légales par type de bail
 */
export const COMMERCIAL_LEASE_DURATIONS = {
  commercial_3_6_9: {
    min_years: 9,
    max_years: null, // Pas de max
    faculte_resiliation_triennale: true,
    preavis_mois: 6,
  },
  commercial_derogatoire: {
    min_years: 0,
    max_years: 3, // Cumulé pour même local/même parties
    faculte_resiliation_triennale: false,
    preavis_mois: 1, // À définir contractuellement
  },
  commercial_saisonnier: {
    min_years: 0,
    max_years: 1,
    faculte_resiliation_triennale: false,
    preavis_mois: 0,
  },
};

/**
 * Préavis légaux
 */
export const COMMERCIAL_PREAVIS = {
  locataire_resiliation_triennale: 6, // mois
  bailleur_conge_fin_bail: 6, // mois avant fin période triennale
  bailleur_refus_renouvellement: 6, // mois
};

/**
 * Valeurs de l'ILC par trimestre (à mettre à jour régulièrement)
 * Source : INSEE
 */
export const ILC_VALUES: Record<string, number> = {
  "T4 2025": 134.65,
  "T3 2025": 134.12,
  "T2 2025": 133.58,
  "T1 2025": 132.87,
  "T4 2024": 132.15,
  "T3 2024": 131.42,
  // ... à compléter
};

/**
 * Valeurs de l'ILAT par trimestre
 */
export const ILAT_VALUES: Record<string, number> = {
  "T4 2025": 128.43,
  "T3 2025": 127.89,
  "T2 2025": 127.34,
  "T1 2025": 126.78,
  "T4 2024": 126.21,
  "T3 2024": 125.65,
  // ... à compléter
};
