/**
 * Types TypeScript pour les baux professionnels
 *
 * Régime juridique :
 * - Article 57 A de la loi n°86-1290 du 23 décembre 1986
 * - Modifié par la loi n°2008-776 du 4 août 2008 (LME)
 *
 * Destiné aux :
 * - Professions libérales (médecins, avocats, architectes, experts-comptables...)
 * - Officiers ministériels
 * - Activités non commerciales exercées dans des locaux
 *
 * Caractéristiques principales :
 * - Durée minimale 6 ans
 * - Pas de "propriété commerciale"
 * - Pas d'indemnité d'éviction
 * - Indexation sur ILAT
 * - Résiliation à tout moment avec préavis 6 mois
 */

// ============================================
// ENUMS - TYPES DE PROFESSIONS
// ============================================

/**
 * Catégories de professions libérales
 */
export type ProfessionLiberaleCategory =
  | "sante"              // Santé : médecins, dentistes, infirmiers, kinés...
  | "juridique"          // Juridique : avocats, notaires, huissiers...
  | "technique"          // Technique : architectes, géomètres, ingénieurs...
  | "comptable"          // Économique : experts-comptables, commissaires aux comptes
  | "conseil"            // Conseil : consultants, formateurs...
  | "artistique"         // Artistique : graphistes, designers...
  | "autre";             // Autre profession libérale

/**
 * Régime fiscal du professionnel
 */
export type ProfessionalFiscalRegime =
  | "bnc"               // Bénéfices Non Commerciaux (BNC)
  | "is"                // Impôt sur les Sociétés (SEL, SELARL...)
  | "micro_bnc";        // Micro-BNC

/**
 * Forme juridique du preneur professionnel
 */
export type ProfessionalLegalForm =
  | "exercice_individuel"    // Exercice en nom propre
  | "scp"                    // Société Civile Professionnelle
  | "scm"                    // Société Civile de Moyens
  | "sel"                    // Société d'Exercice Libéral
  | "selarl"                 // SELARL
  | "selas"                  // SELAS
  | "selafa"                 // SELAFA
  | "selca"                  // SELCA (commandite par actions)
  | "spfpl"                  // Société de Participations Financières de Professions Libérales
  | "autre_societe";         // Autre forme

/**
 * Type d'activité professionnelle
 */
export type ProfessionalActivityType =
  // Santé
  | "medecin_generaliste"
  | "medecin_specialiste"
  | "chirurgien_dentiste"
  | "infirmier"
  | "kinesitherapeute"
  | "orthophoniste"
  | "psychologue"
  | "sage_femme"
  | "veterinaire"
  // Juridique
  | "avocat"
  | "notaire"
  | "huissier"
  | "mandataire_judiciaire"
  | "commissaire_priseur"
  // Technique
  | "architecte"
  | "geometre_expert"
  | "ingenieur_conseil"
  | "expert_automobile"
  // Économique
  | "expert_comptable"
  | "commissaire_aux_comptes"
  | "conseil_gestion"
  // Autres
  | "autre";

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Informations sur le professionnel (preneur)
 */
export interface ProfessionalTenantInfo {
  // Identité
  civilite: "M." | "Mme" | "Dr" | "Maître";
  nom: string;
  prenom: string;
  date_naissance?: string;
  lieu_naissance?: string;

  // Profession
  profession: ProfessionalActivityType;
  profession_libelle: string; // Libellé exact
  categorie: ProfessionLiberaleCategory;

  // Inscription ordinale (si applicable)
  ordre_professionnel?: string;  // Ex: "Ordre des médecins"
  numero_ordinal?: string;       // Ex: "75-12345"
  departement_inscription?: string;

  // Forme juridique
  forme_juridique: ProfessionalLegalForm;
  raison_sociale?: string;       // Si société
  siret?: string;
  rcs?: string;

  // Fiscal
  regime_fiscal: ProfessionalFiscalRegime;
  numero_tva_intra?: string;

  // Contact professionnel
  adresse_cabinet_actuel?: string;
  telephone_pro: string;
  email_pro: string;

  // Assurance professionnelle
  assurance_rcp: boolean;       // Responsabilité Civile Professionnelle
  assurance_rcp_compagnie?: string;
  assurance_rcp_numero?: string;
}

/**
 * Configuration des locaux professionnels
 */
export interface ProfessionalPremisesConfig {
  // Surface
  surface_totale_m2: number;
  surface_accueil_m2?: number;
  surface_bureaux_m2?: number;
  surface_technique_m2?: number;  // Salle de soins, atelier...

  // Pièces
  nb_bureaux: number;
  nb_salles_attente: number;
  nb_salles_examen?: number;     // Pour médical
  nb_sanitaires: number;

  // Accessibilité
  accessibilite_pmr: boolean;
  accessibilite_details?: string;
  rez_de_chaussee: boolean;
  ascenseur?: boolean;

  // Équipements inclus
  climatisation: boolean;
  alarme: boolean;
  fibre_optique: boolean;
  parking_privatif: boolean;
  nb_places_parking?: number;

  // Usage
  usage_exclusif_professionnel: boolean;
  usage_mixte_habitation?: boolean;
  reception_clientele: boolean;
  enseigne_autorisee: boolean;

  // Copropriété
  en_copropriete: boolean;
  reglement_copropriete_conforme?: boolean;
  activite_autorisee_copropriete?: boolean;
}

/**
 * Clause d'indexation du bail professionnel
 */
export interface ProfessionalIndexation {
  indice: "ILAT" | "ILC";  // ILAT recommandé pour professionnel
  indice_base: number;
  indice_base_trimestre: string;  // Ex: "T4 2025"
  date_revision_annuelle: string; // Ex: "01-01" (1er janvier)
  plafonnement?: boolean;
}

/**
 * Conditions financières
 */
export interface ProfessionalFinancialTerms {
  // Loyer
  loyer_annuel_hc: number;
  loyer_mensuel_hc: number;
  loyer_m2_annuel: number;

  // TVA (généralement pas de TVA pour bail professionnel)
  tva_applicable: boolean;
  tva_taux?: number;
  loyer_annuel_ttc?: number;
  loyer_mensuel_ttc?: number;

  // Charges
  charges_type: "forfait" | "provisions" | "reel";
  charges_montant_mensuel: number;
  charges_incluses: string[];  // Liste des charges incluses

  // Dépôt de garantie
  depot_garantie: number;
  depot_garantie_mois: number;  // Généralement 2 mois

  // Termes de paiement
  periodicite: "mensuelle" | "trimestrielle";
  terme: "a_echoir" | "echu";
  jour_paiement: number;  // Ex: 5 du mois
  mode_paiement: "virement" | "prelevement" | "cheque";
}

/**
 * Configuration complète d'un bail professionnel
 */
export interface ProfessionalLeaseConfig {
  // Référence
  reference?: string;

  // Durée (minimum 6 ans)
  duree_annees: number;
  date_debut: string;
  date_fin: string;

  // Preneur
  preneur: ProfessionalTenantInfo;

  // Locaux
  locaux: ProfessionalPremisesConfig;

  // Activité
  activite_autorisee: string;  // Description précise
  activites_connexes_autorisees?: string[];
  sous_location_autorisee: boolean;
  cession_bail_autorisee: boolean;
  cession_agrement_bailleur: boolean;

  // Financier
  conditions_financieres: ProfessionalFinancialTerms;

  // Indexation
  indexation: ProfessionalIndexation;

  // Résiliation
  preavis_locataire_mois: number;  // Défaut: 6 mois
  preavis_bailleur_mois: number;   // Défaut: 6 mois
  resiliation_anticipee_possible: boolean;

  // Travaux
  travaux_preneur_autorises: string[];
  travaux_bailleur_prevus?: string[];
  autorisation_travaux_requise: boolean;
  sort_ameliorations: "bailleur" | "preneur" | "indemnite";

  // Assurances
  assurance_locaux_obligatoire: boolean;
  assurance_rcp_obligatoire: boolean;  // RC Professionnelle

  // Clause résolutoire
  clause_resolutoire: {
    applicable: boolean;
    delai_jours: number;  // Délai après commandement
  };

  // État des lieux
  etat_des_lieux_entree: boolean;
  inventaire_equipements: boolean;

  // Diagnostics annexés
  diagnostics: string[];

  // Mentions spéciales
  mentions_particulieres?: string;
}

// ============================================
// INTERFACE DONNÉES DB
// ============================================

/**
 * Données du bail professionnel stockées en DB
 */
export interface ProfessionalLeaseData {
  // Liaison au bail parent
  lease_id: string;

  // Preneur
  profession_category: ProfessionLiberaleCategory;
  profession_type: ProfessionalActivityType;
  profession_libelle: string;
  forme_juridique: ProfessionalLegalForm;
  numero_ordinal?: string | null;
  ordre_professionnel?: string | null;
  assurance_rcp: boolean;

  // Locaux
  surface_totale_m2: number;
  nb_bureaux: number;
  accessibilite_pmr: boolean;
  usage_exclusif_professionnel: boolean;

  // Financier
  loyer_annuel_hc: number;
  tva_applicable: boolean;
  charges_type: string;
  charges_montant: number;
  depot_garantie: number;

  // Indexation
  indice_reference: "ILAT" | "ILC";
  indice_base: number;
  indice_base_trimestre: string;

  // Résiliation
  preavis_locataire_mois: number;
  preavis_bailleur_mois: number;

  // Métadonnées
  created_at: string;
  updated_at: string;
}

// ============================================
// DTOs
// ============================================

export interface CreateProfessionalLeaseDTO {
  property_id: string;
  date_debut: string;
  duree_annees: number;

  // Preneur simplifié
  preneur_civilite: string;
  preneur_nom: string;
  preneur_prenom: string;
  preneur_profession: ProfessionalActivityType;
  preneur_forme_juridique: ProfessionalLegalForm;
  preneur_siret?: string;
  preneur_email: string;
  preneur_telephone: string;

  // Financier
  loyer_annuel_hc: number;
  charges_mensuelles: number;
  depot_garantie: number;

  // Options
  sous_location_autorisee?: boolean;
  cession_autorisee?: boolean;
}

// ============================================
// CONSTANTES ET LABELS
// ============================================

export const PROFESSION_CATEGORY_LABELS: Record<ProfessionLiberaleCategory, string> = {
  sante: "Professions de santé",
  juridique: "Professions juridiques",
  technique: "Professions techniques",
  comptable: "Professions comptables et économiques",
  conseil: "Conseil et formation",
  artistique: "Professions artistiques",
  autre: "Autre profession libérale",
};

export const PROFESSION_ACTIVITY_LABELS: Record<ProfessionalActivityType, string> = {
  // Santé
  medecin_generaliste: "Médecin généraliste",
  medecin_specialiste: "Médecin spécialiste",
  chirurgien_dentiste: "Chirurgien-dentiste",
  infirmier: "Infirmier(e)",
  kinesitherapeute: "Masseur-kinésithérapeute",
  orthophoniste: "Orthophoniste",
  psychologue: "Psychologue",
  sage_femme: "Sage-femme",
  veterinaire: "Vétérinaire",
  // Juridique
  avocat: "Avocat(e)",
  notaire: "Notaire",
  huissier: "Commissaire de justice (Huissier)",
  mandataire_judiciaire: "Mandataire judiciaire",
  commissaire_priseur: "Commissaire-priseur",
  // Technique
  architecte: "Architecte",
  geometre_expert: "Géomètre-expert",
  ingenieur_conseil: "Ingénieur-conseil",
  expert_automobile: "Expert automobile",
  // Économique
  expert_comptable: "Expert-comptable",
  commissaire_aux_comptes: "Commissaire aux comptes",
  conseil_gestion: "Conseil en gestion",
  // Autre
  autre: "Autre profession libérale",
};

export const LEGAL_FORM_LABELS: Record<ProfessionalLegalForm, string> = {
  exercice_individuel: "Exercice individuel",
  scp: "SCP (Société Civile Professionnelle)",
  scm: "SCM (Société Civile de Moyens)",
  sel: "SEL (Société d'Exercice Libéral)",
  selarl: "SELARL",
  selas: "SELAS",
  selafa: "SELAFA",
  selca: "SELCA",
  spfpl: "SPFPL (Holding)",
  autre_societe: "Autre forme sociale",
};

export const FISCAL_REGIME_LABELS: Record<ProfessionalFiscalRegime, string> = {
  bnc: "BNC (Bénéfices Non Commerciaux)",
  is: "Impôt sur les Sociétés",
  micro_bnc: "Micro-BNC",
};

// Liste des ordres professionnels
export const ORDRES_PROFESSIONNELS: Record<string, string> = {
  medecins: "Ordre national des médecins",
  pharmaciens: "Ordre national des pharmaciens",
  dentistes: "Ordre national des chirurgiens-dentistes",
  sages_femmes: "Ordre national des sages-femmes",
  infirmiers: "Ordre national des infirmiers",
  masseurs_kinesitherapeutes: "Ordre des masseurs-kinésithérapeutes",
  pedicures_podologues: "Ordre national des pédicures-podologues",
  avocats: "Ordre des avocats (Barreau)",
  notaires: "Chambre des notaires",
  huissiers: "Chambre nationale des commissaires de justice",
  architectes: "Ordre des architectes",
  geometres_experts: "Ordre des géomètres-experts",
  experts_comptables: "Ordre des experts-comptables",
  veterinaires: "Ordre national des vétérinaires",
};

// ============================================
// VALEURS PAR DÉFAUT
// ============================================

/**
 * Configuration par défaut d'un bail professionnel
 */
export const DEFAULT_PROFESSIONAL_LEASE_CONFIG: Partial<ProfessionalLeaseConfig> = {
  duree_annees: 6,  // Minimum légal
  sous_location_autorisee: false,
  cession_bail_autorisee: true,
  cession_agrement_bailleur: true,
  preavis_locataire_mois: 6,
  preavis_bailleur_mois: 6,
  resiliation_anticipee_possible: true,
  autorisation_travaux_requise: true,
  sort_ameliorations: "bailleur",
  assurance_locaux_obligatoire: true,
  assurance_rcp_obligatoire: true,
  clause_resolutoire: {
    applicable: true,
    delai_jours: 30,
  },
  etat_des_lieux_entree: true,
  inventaire_equipements: true,
  indexation: {
    indice: "ILAT",
    indice_base: 0,
    indice_base_trimestre: "",
    date_revision_annuelle: "01-01",
  },
};

export const DEFAULT_PROFESSIONAL_FINANCIAL_TERMS: Partial<ProfessionalFinancialTerms> = {
  tva_applicable: false,  // Généralement pas de TVA
  charges_type: "provisions",
  depot_garantie_mois: 2,
  periodicite: "mensuelle",
  terme: "a_echoir",
  jour_paiement: 5,
  mode_paiement: "virement",
};

// ============================================
// RÈGLES MÉTIER
// ============================================

/**
 * Durées légales du bail professionnel
 */
export const PROFESSIONAL_LEASE_DURATION = {
  min_years: 6,         // Durée minimale légale
  max_years: null,      // Pas de maximum
  preavis_standard_mois: 6,
};

/**
 * Professions soumises à un ordre professionnel
 */
export const PROFESSIONS_WITH_ORDER: ProfessionalActivityType[] = [
  "medecin_generaliste",
  "medecin_specialiste",
  "chirurgien_dentiste",
  "infirmier",
  "kinesitherapeute",
  "sage_femme",
  "veterinaire",
  "avocat",
  "notaire",
  "huissier",
  "architecte",
  "geometre_expert",
  "expert_comptable",
  "commissaire_aux_comptes",
];

/**
 * Professions de santé (réglementation spécifique locaux)
 */
export const HEALTH_PROFESSIONS: ProfessionalActivityType[] = [
  "medecin_generaliste",
  "medecin_specialiste",
  "chirurgien_dentiste",
  "infirmier",
  "kinesitherapeute",
  "orthophoniste",
  "psychologue",
  "sage_femme",
];

/**
 * Vérifie si une profession est soumise à un ordre
 */
export function isOrderedProfession(activity: ProfessionalActivityType): boolean {
  return PROFESSIONS_WITH_ORDER.includes(activity);
}

/**
 * Vérifie si c'est une profession de santé
 */
export function isHealthProfession(activity: ProfessionalActivityType): boolean {
  return HEALTH_PROFESSIONS.includes(activity);
}

/**
 * Obtient l'ordre professionnel pour une activité
 */
export function getOrdreForProfession(activity: ProfessionalActivityType): string | null {
  const mapping: Partial<Record<ProfessionalActivityType, string>> = {
    medecin_generaliste: "medecins",
    medecin_specialiste: "medecins",
    chirurgien_dentiste: "dentistes",
    infirmier: "infirmiers",
    kinesitherapeute: "masseurs_kinesitherapeutes",
    sage_femme: "sages_femmes",
    veterinaire: "veterinaires",
    avocat: "avocats",
    notaire: "notaires",
    huissier: "huissiers",
    architecte: "architectes",
    geometre_expert: "geometres_experts",
    expert_comptable: "experts_comptables",
  };

  const key = mapping[activity];
  return key ? ORDRES_PROFESSIONNELS[key] : null;
}

/**
 * Template data pour génération du bail professionnel
 */
export interface ProfessionalLeaseTemplateData {
  // Système
  DOCUMENT_TITLE: string;
  REFERENCE_BAIL: string;
  DATE_GENERATION: string;
  DATE_SIGNATURE: string;
  LIEU_SIGNATURE: string;
  NB_EXEMPLAIRES: number;

  // Bailleur
  BAILLEUR_IS_SOCIETE: boolean;
  BAILLEUR_NOM_COMPLET: string;
  BAILLEUR_RAISON_SOCIALE?: string;
  BAILLEUR_SIRET?: string;
  BAILLEUR_ADRESSE: string;
  BAILLEUR_REPRESENTANT?: string;
  BAILLEUR_REPRESENTANT_QUALITE?: string;

  // Preneur
  PRENEUR_CIVILITE: string;
  PRENEUR_NOM_COMPLET: string;
  PRENEUR_PROFESSION: string;
  PRENEUR_FORME_JURIDIQUE: string;
  PRENEUR_RAISON_SOCIALE?: string;
  PRENEUR_SIRET?: string;
  PRENEUR_ADRESSE: string;
  PRENEUR_ORDRE?: string;
  PRENEUR_NUMERO_ORDINAL?: string;
  PRENEUR_ASSURANCE_RCP: boolean;
  PRENEUR_ASSURANCE_COMPAGNIE?: string;

  // Locaux
  LOCAUX_ADRESSE: string;
  LOCAUX_CODE_POSTAL: string;
  LOCAUX_VILLE: string;
  LOCAUX_SURFACE: number;
  LOCAUX_ETAGE?: string;
  LOCAUX_NB_BUREAUX: number;
  LOCAUX_DESCRIPTION: string;
  LOCAUX_ACCESSIBILITE_PMR: boolean;

  // Durée
  BAIL_DUREE_ANNEES: number;
  BAIL_DATE_DEBUT: string;
  BAIL_DATE_FIN: string;

  // Financier
  LOYER_ANNUEL_HC: number;
  LOYER_MENSUEL_HC: number;
  LOYER_M2_ANNUEL: number;
  LOYER_LETTRES: string;
  TVA_APPLICABLE: boolean;
  TVA_TAUX?: number;
  CHARGES_TYPE: string;
  CHARGES_MENSUELLES: number;
  TOTAL_MENSUEL: number;
  DEPOT_GARANTIE: number;
  DEPOT_NB_MOIS: number;
  PERIODICITE: string;
  TERME: string;
  JOUR_PAIEMENT: number;
  MODE_PAIEMENT: string;

  // Indexation
  INDICE_TYPE: string;
  INDICE_BASE: number;
  INDICE_TRIMESTRE_BASE: string;
  DATE_REVISION: string;

  // Résiliation
  PREAVIS_LOCATAIRE: number;
  PREAVIS_BAILLEUR: number;

  // Options
  SOUS_LOCATION_AUTORISEE: boolean;
  CESSION_AUTORISEE: boolean;

  // Signatures
  IS_SIGNED: boolean;
  BAILLEUR_SIGNATURE_IMAGE?: string;
  PRENEUR_SIGNATURE_IMAGE?: string;
  CERTIFICATE_HTML?: string;
}
