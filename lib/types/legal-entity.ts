/**
 * Types pour les entités juridiques (SCI, SARL, etc.)
 * SOTA 2026 - Architecture multi-entités
 *
 * Permet à un propriétaire de gérer plusieurs structures juridiques
 * et d'affecter ses biens à différentes entités.
 */

// ============================================
// TYPES D'ENTITÉS JURIDIQUES
// ============================================

/**
 * Types d'entités juridiques supportés
 */
export type LegalEntityType =
  | "particulier"              // Détention directe (personne physique)
  | "sci_ir"                   // SCI à l'Impôt sur le Revenu
  | "sci_is"                   // SCI à l'Impôt sur les Sociétés
  | "sci_construction_vente"   // SCCV (promotion immobilière)
  | "sarl"                     // SARL classique
  | "sarl_famille"             // SARL de famille (option IR possible)
  | "eurl"                     // EURL
  | "sas"                      // SAS
  | "sasu"                     // SASU
  | "sa"                       // SA
  | "snc"                      // Société en Nom Collectif
  | "indivision"               // Indivision (héritage, achat commun)
  | "demembrement_usufruit"    // Usufruit seul
  | "demembrement_nue_propriete" // Nue-propriété seule
  | "holding";                 // Société holding

/**
 * Régimes fiscaux possibles
 */
export type FiscalRegime =
  | "ir"           // Impôt sur le Revenu (transparence fiscale)
  | "is"           // Impôt sur les Sociétés
  | "ir_option_is" // IR avec option IS
  | "is_option_ir"; // IS avec option IR (SARL famille)

/**
 * Régimes de TVA
 */
export type TvaRegime =
  | "franchise"        // Franchise en base (pas de TVA)
  | "reel_simplifie"   // Réel simplifié
  | "reel_normal"      // Réel normal
  | "mini_reel";       // Mini-réel

/**
 * Types de gérance/direction
 */
export type GeranceType =
  | "gerant_unique"
  | "co_gerance"
  | "gerance_collegiale"
  | "president"
  | "directeur_general"
  | "conseil_administration";

// ============================================
// ENTITÉ JURIDIQUE
// ============================================

/**
 * Entité juridique complète
 */
export interface LegalEntity {
  id: string;
  owner_profile_id: string;

  // Type
  entity_type: LegalEntityType;

  // Identité
  nom: string;
  nom_commercial?: string | null;

  // Immatriculation
  siren?: string | null;
  siret?: string | null;
  rcs_ville?: string | null;
  rcs_numero?: string | null;
  numero_tva?: string | null;
  code_ape?: string | null;

  // Adresse siège
  adresse_siege?: string | null;
  complement_adresse?: string | null;
  code_postal_siege?: string | null;
  ville_siege?: string | null;
  pays_siege?: string | null;

  // Forme juridique
  forme_juridique?: string | null;
  capital_social?: number | null;
  capital_variable?: boolean;
  capital_min?: number | null;
  capital_max?: number | null;

  // Parts sociales
  nombre_parts?: number | null;
  valeur_nominale_part?: number | null;

  // Fiscalité
  regime_fiscal: FiscalRegime;
  date_option_fiscale?: string | null;
  tva_assujetti?: boolean;
  tva_regime?: TvaRegime | null;
  tva_taux_defaut?: number | null;

  // Exercice comptable
  date_creation?: string | null;
  date_cloture_exercice?: string | null;
  duree_exercice_mois?: number;
  premier_exercice_debut?: string | null;
  premier_exercice_fin?: string | null;

  // Coordonnées bancaires
  iban?: string | null;
  bic?: string | null;
  banque_nom?: string | null;
  titulaire_compte?: string | null;

  // Gérance
  type_gerance?: GeranceType | null;

  // Statut
  is_active: boolean;
  date_radiation?: string | null;
  motif_radiation?: string | null;

  // UI
  couleur?: string | null;
  icone?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// ASSOCIÉS
// ============================================

/**
 * Types d'apports
 */
export type ApportType =
  | "numeraire"           // Apport en argent
  | "nature_immobilier"   // Apport d'immeuble
  | "nature_mobilier"     // Apport de biens mobiliers
  | "industrie";          // Apport en industrie (travail)

/**
 * Types de détention de parts
 */
export type DetentionPartsType =
  | "pleine_propriete"
  | "nue_propriete"
  | "usufruit"
  | "indivision";

/**
 * Civilité
 */
export type Civilite = "M" | "Mme" | "Société";

/**
 * Associé d'une entité juridique
 */
export interface EntityAssociate {
  id: string;
  legal_entity_id: string;

  // Lien vers profil ou entité parente
  profile_id?: string | null;
  parent_entity_id?: string | null;

  // Identité personne physique
  civilite?: Civilite | null;
  nom?: string | null;
  prenom?: string | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  nationalite?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;

  // Identité personne morale
  denomination_sociale?: string | null;
  forme_juridique_associe?: string | null;
  siren_associe?: string | null;
  representant_legal?: string | null;

  // Participation
  nombre_parts: number;
  pourcentage_capital?: number | null;
  pourcentage_droits_vote?: number | null;
  valeur_parts?: number | null;

  // Apports
  apport_initial?: number | null;
  type_apport?: ApportType | null;
  date_apport?: string | null;

  // Type de détention
  type_detention: DetentionPartsType;

  // Rôles
  is_gerant: boolean;
  is_president: boolean;
  is_directeur_general: boolean;
  is_associe_fondateur: boolean;
  role_autre?: string | null;

  // Mandat
  date_debut_mandat?: string | null;
  date_fin_mandat?: string | null;
  duree_mandat_annees?: number | null;

  // Pouvoirs
  pouvoirs?: string | null;
  limitations_pouvoirs?: string | null;
  signature_autorisee: boolean;
  plafond_engagement?: number | null;

  // Statut
  is_current: boolean;
  date_entree?: string | null;
  date_sortie?: string | null;
  motif_sortie?: string | null;

  // Documents
  piece_identite_document_id?: string | null;
  justificatif_domicile_document_id?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// DÉTENTION DE PROPRIÉTÉ
// ============================================

/**
 * Types de détention d'un bien
 */
export type PropertyDetentionType =
  | "pleine_propriete"     // Propriété pleine et entière
  | "nue_propriete"        // Nue-propriété (sans usufruit)
  | "usufruit"             // Usufruit (droit de jouissance)
  | "usufruit_temporaire"  // Usufruit à durée limitée
  | "indivision";          // Part d'indivision

/**
 * Modes d'acquisition
 */
export type AcquisitionMode =
  | "achat"
  | "apport"        // Apport à société
  | "donation"
  | "succession"
  | "echange"
  | "construction"
  | "licitation";   // Sortie d'indivision

/**
 * Modes de cession
 */
export type CessionMode =
  | "vente"
  | "donation"
  | "apport_societe"
  | "succession"
  | "echange"
  | "expropriation";

/**
 * Détention d'un bien immobilier
 */
export interface PropertyOwnership {
  id: string;
  property_id: string;

  // Détenteur
  legal_entity_id?: string | null;
  profile_id?: string | null;

  // Quote-part
  quote_part_numerateur: number;
  quote_part_denominateur: number;
  pourcentage_detention?: number; // Calculé

  // Type de détention
  detention_type: PropertyDetentionType;

  // Usufruit temporaire
  usufruit_duree_annees?: number | null;
  usufruit_date_fin?: string | null;

  // Acquisition
  date_acquisition?: string | null;
  mode_acquisition?: AcquisitionMode | null;
  prix_acquisition?: number | null;
  frais_acquisition?: number | null;

  // Notaire
  notaire_nom?: string | null;
  notaire_ville?: string | null;
  reference_acte?: string | null;
  date_acte?: string | null;

  // Financement
  finance_par_emprunt?: boolean;
  montant_emprunt?: number | null;
  banque_emprunt?: string | null;

  // Cession
  date_cession?: string | null;
  mode_cession?: CessionMode | null;
  prix_cession?: number | null;

  // Statut
  is_current: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// MODES DE DÉTENTION (pour properties)
// ============================================

/**
 * Mode de détention d'une propriété
 */
export type PropertyDetentionMode =
  | "direct"       // Détention directe (via owner_id)
  | "societe"      // Via une société (legal_entity_id)
  | "indivision"   // Multi-détenteurs
  | "demembrement"; // Démembrement NP/usufruit

// ============================================
// DTOs - Création et mise à jour
// ============================================

/**
 * DTO pour créer une entité juridique
 */
export interface CreateLegalEntityDTO {
  entity_type: LegalEntityType;
  nom: string;
  nom_commercial?: string;

  // Immatriculation (optionnel)
  siren?: string;
  siret?: string;
  rcs_ville?: string;
  numero_tva?: string;

  // Adresse siège
  adresse_siege?: string;
  code_postal_siege?: string;
  ville_siege?: string;

  // Forme et capital
  forme_juridique?: string;
  capital_social?: number;
  nombre_parts?: number;

  // Fiscalité
  regime_fiscal: FiscalRegime;
  tva_assujetti?: boolean;
  tva_regime?: TvaRegime;

  // Exercice
  date_creation?: string;
  date_cloture_exercice?: string;

  // Bancaire
  iban?: string;
  bic?: string;
  banque_nom?: string;

  // UI
  couleur?: string;
  notes?: string;
}

/**
 * DTO pour mettre à jour une entité juridique
 */
export interface UpdateLegalEntityDTO extends Partial<CreateLegalEntityDTO> {
  is_active?: boolean;
}

/**
 * DTO pour créer un associé
 */
export interface CreateEntityAssociateDTO {
  legal_entity_id: string;

  // Identité (choisir un mode)
  profile_id?: string;
  parent_entity_id?: string;
  // OU identité manuelle:
  civilite?: Civilite;
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  adresse?: string;
  // OU personne morale:
  denomination_sociale?: string;
  siren_associe?: string;

  // Participation
  nombre_parts: number;
  pourcentage_capital?: number;

  // Apport
  type_apport?: ApportType;
  apport_initial?: number;
  date_apport?: string;

  // Rôles
  is_gerant?: boolean;
  is_president?: boolean;
  date_debut_mandat?: string;

  // Détention
  type_detention?: DetentionPartsType;
}

/**
 * DTO pour créer une détention de propriété
 */
export interface CreatePropertyOwnershipDTO {
  property_id: string;
  legal_entity_id?: string;
  profile_id?: string;

  quote_part_numerateur?: number;
  quote_part_denominateur?: number;
  detention_type: PropertyDetentionType;

  date_acquisition?: string;
  mode_acquisition?: AcquisitionMode;
  prix_acquisition?: number;
  frais_acquisition?: number;

  notaire_nom?: string;
  reference_acte?: string;

  finance_par_emprunt?: boolean;
  montant_emprunt?: number;
  banque_emprunt?: string;
}

// ============================================
// INTERFACES ENRICHIES (avec relations)
// ============================================

/**
 * Entité juridique avec statistiques
 */
export interface LegalEntityWithStats extends LegalEntity {
  properties_count: number;
  total_value: number;
  monthly_rent: number;
  active_leases: number;
  associates_count: number;
}

/**
 * Entité juridique avec associés
 */
export interface LegalEntityWithAssociates extends LegalEntity {
  associates: EntityAssociate[];
}

/**
 * Associé avec détails du profil lié
 */
export interface EntityAssociateWithProfile extends EntityAssociate {
  profile?: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  parent_entity?: {
    nom: string;
    entity_type: LegalEntityType;
  };
}

/**
 * Détention de propriété avec détails
 */
export interface PropertyOwnershipWithDetails extends PropertyOwnership {
  legal_entity?: {
    nom: string;
    entity_type: LegalEntityType;
    regime_fiscal: FiscalRegime;
  };
  profile?: {
    prenom: string | null;
    nom: string | null;
  };
  property?: {
    adresse_complete: string;
    ville: string;
    type: string;
  };
}

// ============================================
// CONSTANTES ET LABELS
// ============================================

/**
 * Labels des types d'entités
 * Source unique : @/lib/entities/entity-constants.ts
 */
export { ENTITY_TYPE_LABELS } from "@/lib/entities/entity-constants";

/**
 * Labels des régimes fiscaux
 */
export const FISCAL_REGIME_LABELS: Record<FiscalRegime, string> = {
  ir: "Impôt sur le Revenu",
  is: "Impôt sur les Sociétés",
  ir_option_is: "IR avec option IS",
  is_option_ir: "IS avec option IR",
};

/**
 * Labels des types de détention
 */
export const DETENTION_TYPE_LABELS: Record<PropertyDetentionType, string> = {
  pleine_propriete: "Pleine propriété",
  nue_propriete: "Nue-propriété",
  usufruit: "Usufruit",
  usufruit_temporaire: "Usufruit temporaire",
  indivision: "Indivision",
};

/**
 * Labels des modes d'acquisition
 */
export const ACQUISITION_MODE_LABELS: Record<AcquisitionMode, string> = {
  achat: "Achat",
  apport: "Apport à société",
  donation: "Donation",
  succession: "Succession",
  echange: "Échange",
  construction: "Construction",
  licitation: "Licitation (sortie d'indivision)",
};

/**
 * Labels des types d'apport
 */
export const APPORT_TYPE_LABELS: Record<ApportType, string> = {
  numeraire: "Numéraire (argent)",
  nature_immobilier: "Nature (immobilier)",
  nature_mobilier: "Nature (mobilier)",
  industrie: "Industrie (travail)",
};

/**
 * Couleurs par défaut pour les types d'entités
 */
export const ENTITY_TYPE_COLORS: Record<LegalEntityType, string> = {
  particulier: "#6366f1",     // Indigo
  sci_ir: "#22c55e",          // Green
  sci_is: "#10b981",          // Emerald
  sci_construction_vente: "#14b8a6", // Teal
  sarl: "#3b82f6",            // Blue
  sarl_famille: "#0ea5e9",    // Sky
  eurl: "#6366f1",            // Indigo
  sas: "#8b5cf6",             // Violet
  sasu: "#a855f7",            // Purple
  sa: "#d946ef",              // Fuchsia
  snc: "#ec4899",             // Pink
  indivision: "#f97316",      // Orange
  demembrement_usufruit: "#eab308",    // Yellow
  demembrement_nue_propriete: "#84cc16", // Lime
  holding: "#64748b",         // Slate
};

/**
 * Groupes d'entités par catégorie
 */
export const ENTITY_TYPE_GROUPS = {
  personnel: ["particulier"] as LegalEntityType[],
  sci: ["sci_ir", "sci_is", "sci_construction_vente"] as LegalEntityType[],
  commerciale: ["sarl", "sarl_famille", "eurl", "sas", "sasu", "sa", "snc"] as LegalEntityType[],
  speciale: ["indivision", "demembrement_usufruit", "demembrement_nue_propriete", "holding"] as LegalEntityType[],
};

/**
 * Entités nécessitant un SIRET
 */
export const ENTITIES_REQUIRING_SIRET: LegalEntityType[] = [
  "sci_ir",
  "sci_is",
  "sci_construction_vente",
  "sarl",
  "sarl_famille",
  "eurl",
  "sas",
  "sasu",
  "sa",
  "snc",
  "holding",
];

/**
 * Entités avec minimum 2 associés
 */
export const ENTITIES_MIN_2_ASSOCIATES: LegalEntityType[] = [
  "sci_ir",
  "sci_is",
  "sci_construction_vente",
  "sarl",
  "sarl_famille",
  "sas",
  "sa",
  "snc",
  "indivision",
];

/**
 * Entités permettant l'option IR
 */
export const ENTITIES_IR_OPTION: LegalEntityType[] = [
  "particulier",
  "sci_ir",
  "sarl_famille",
  "indivision",
];

/**
 * Entités à l'IS obligatoire
 */
export const ENTITIES_IS_MANDATORY: LegalEntityType[] = [
  "sci_is",
  "sas",
  "sasu",
  "sa",
];
