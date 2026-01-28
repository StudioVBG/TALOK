/**
 * Types TypeScript pour la Location-Gérance (Gérance Libre)
 * GAP-005: Support des contrats de location-gérance de fonds de commerce
 *
 * Cadre légal: Articles L144-1 à L144-13 du Code de commerce
 *
 * Définition: Contrat par lequel le propriétaire d'un fonds de commerce
 * (le loueur) concède à un tiers (le gérant) le droit d'exploiter
 * ce fonds à ses risques et périls, moyennant le paiement d'une redevance.
 */

// ============================================
// ENUMS ET TYPES DE BASE
// ============================================

/**
 * Types de fonds de commerce
 */
export type FondsDeCommerceType =
  | 'commerce_detail'      // Commerce de détail
  | 'restaurant'           // Restaurant, bar, brasserie
  | 'hotel'                // Hôtel, hébergement
  | 'garage'               // Garage, station-service
  | 'salon_coiffure'       // Salon de coiffure, esthétique
  | 'boulangerie'          // Boulangerie, pâtisserie
  | 'pharmacie'            // Pharmacie (soumis à autorisation)
  | 'tabac_presse'         // Tabac, presse, PMU
  | 'agence_immobiliere'   // Agence immobilière
  | 'agence_voyage'        // Agence de voyage
  | 'pressing'             // Pressing, blanchisserie
  | 'superette'            // Supérette, alimentation
  | 'discothèque'          // Discothèque, bar de nuit
  | 'artisanat'            // Activité artisanale
  | 'services'             // Services divers
  | 'autre';

/**
 * Statut du contrat de location-gérance
 */
export type LocationGeranceStatus =
  | 'draft'                // Brouillon
  | 'pending_publication'  // En attente de publication JAL
  | 'published'            // Publié au JAL
  | 'active'               // Actif
  | 'suspended'            // Suspendu
  | 'terminated'           // Résilié
  | 'expired';             // Expiré

/**
 * Type de redevance
 */
export type RedevanceType =
  | 'fixe'                 // Montant fixe mensuel
  | 'pourcentage_ca'       // Pourcentage du chiffre d'affaires
  | 'mixte'                // Minimum garanti + pourcentage
  | 'progressive';         // Évolutive dans le temps

/**
 * Type de fin de contrat
 */
export type FinContratType =
  | 'terme'                // Arrivée à terme
  | 'resiliation_loueur'   // Résiliation par le loueur
  | 'resiliation_gerant'   // Résiliation par le gérant
  | 'faute_grave'          // Résiliation pour faute grave
  | 'redressement'         // Redressement judiciaire
  | 'liquidation'          // Liquidation judiciaire
  | 'cession'              // Cession du fonds
  | 'deces';               // Décès du gérant

// ============================================
// INTERFACES - PARTIES AU CONTRAT
// ============================================

/**
 * Le Loueur (propriétaire du fonds de commerce)
 */
export interface LoueurFonds {
  // Identification
  type: 'personne_physique' | 'personne_morale';

  // Personne physique
  civilite?: 'M.' | 'Mme' | 'M. et Mme';
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;

  // Personne morale
  raison_sociale?: string;
  forme_juridique?: string;
  capital_social?: number;
  siret?: string;
  rcs_numero?: string;
  rcs_ville?: string;
  representant_nom?: string;
  representant_prenom?: string;
  representant_qualite?: string;

  // Coordonnées
  adresse: string;
  code_postal: string;
  ville: string;
  telephone?: string;
  email?: string;

  // Fiscal
  regime_fiscal?: 'ir' | 'is';
  tva_assujetti?: boolean;
  numero_tva?: string;
}

/**
 * Le Gérant (locataire-gérant)
 */
export interface GerantFonds {
  // Identification
  type: 'personne_physique' | 'personne_morale';

  // Personne physique
  civilite?: 'M.' | 'Mme' | 'M. et Mme';
  nom?: string;
  prenom?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;

  // Personne morale
  raison_sociale?: string;
  forme_juridique?: string;
  capital_social?: number;
  siret?: string;
  rcs_numero?: string;
  rcs_ville?: string;
  representant_nom?: string;
  representant_prenom?: string;
  representant_qualite?: string;

  // Coordonnées
  adresse: string;
  code_postal: string;
  ville: string;
  telephone?: string;
  email?: string;

  // Immatriculation obligatoire
  rcs_immatriculation_date?: string;
  rm_numero?: string; // Répertoire des métiers (artisans)
  rm_ville?: string;

  // Assurances
  assurance_rc_professionnelle: boolean;
  assurance_rc_compagnie?: string;
  assurance_rc_numero?: string;
  assurance_multirisque?: boolean;
  assurance_multirisque_compagnie?: string;
}

// ============================================
// INTERFACES - FONDS DE COMMERCE
// ============================================

/**
 * Description du fonds de commerce
 */
export interface FondsDeCommerce {
  // Identification
  id?: string;
  nom_commercial: string;
  enseigne?: string;
  type_fonds: FondsDeCommerceType;
  activite_principale: string;
  activites_secondaires?: string[];
  code_ape?: string;

  // Localisation
  adresse_exploitation: string;
  code_postal: string;
  ville: string;
  local_surface_m2?: number;

  // Bail commercial sous-jacent (si applicable)
  bail_commercial_id?: string;
  bail_commercial_reference?: string;
  bail_date_fin?: string;
  bailleur_local_nom?: string;

  // Éléments incorporels
  clientele: boolean;
  achalandage: boolean;
  nom_commercial_inclus: boolean;
  enseigne_incluse: boolean;
  droit_au_bail: boolean;
  licences: LicenceFonds[];
  brevets?: string[];
  marques?: string[];
  contrats_exclusivite?: string[];

  // Éléments corporels
  materiel_equipement: EquipementFonds[];
  mobilier: EquipementFonds[];
  stock_marchandises: boolean;
  stock_valeur_estimee?: number;
  vehicules?: VehiculeFonds[];

  // Valeur du fonds
  valeur_estimee?: number;
  date_evaluation?: string;
  methode_evaluation?: string;

  // Historique
  date_creation_fonds?: string;
  origine_fonds?: 'creation' | 'acquisition' | 'heritage' | 'autre';
  chiffre_affaires_dernier_exercice?: number;
  resultat_dernier_exercice?: number;
}

/**
 * Licence ou autorisation
 */
export interface LicenceFonds {
  type: 'licence_4' | 'licence_3' | 'licence_2' | 'licence_restaurant' | 'debit_tabac' | 'pharmacie' | 'taxi' | 'autre';
  numero?: string;
  date_obtention?: string;
  date_expiration?: string;
  transferable: boolean;
  observations?: string;
}

/**
 * Équipement du fonds
 */
export interface EquipementFonds {
  designation: string;
  marque?: string;
  modele?: string;
  numero_serie?: string;
  annee_acquisition?: number;
  valeur_acquisition?: number;
  valeur_actuelle?: number;
  etat: 'neuf' | 'bon' | 'usage' | 'a_remplacer';
  inclus_dans_gerance: boolean;
  observations?: string;
}

/**
 * Véhicule du fonds
 */
export interface VehiculeFonds {
  type: 'utilitaire' | 'tourisme' | 'deux_roues' | 'autre';
  marque: string;
  modele: string;
  immatriculation: string;
  annee: number;
  kilometrage?: number;
  valeur_actuelle?: number;
  inclus_dans_gerance: boolean;
}

// ============================================
// INTERFACES - CONDITIONS FINANCIÈRES
// ============================================

/**
 * Conditions de la redevance
 */
export interface RedevanceConfig {
  type: RedevanceType;

  // Redevance fixe
  montant_fixe_mensuel?: number;
  montant_fixe_annuel?: number;

  // Pourcentage CA
  pourcentage_ca?: number;
  ca_minimum_garanti?: number;
  periodicite_versement_ca?: 'mensuelle' | 'trimestrielle';

  // Mixte
  minimum_garanti_mensuel?: number;
  pourcentage_depassement?: number;
  seuil_depassement?: number;

  // Progressive
  paliers?: {
    de_mois: number;
    a_mois: number;
    montant: number;
  }[];

  // Indexation
  indexation: boolean;
  indice_reference?: 'ILC' | 'ILAT' | 'ICC' | 'autre';
  indice_base?: number;
  indice_base_trimestre?: string;
  date_revision?: string; // Format MM-DD

  // TVA
  tva_applicable: boolean;
  tva_taux?: number;

  // Modalités de paiement
  date_echeance_jour?: number; // 1-28
  mode_paiement?: 'virement' | 'prelevement' | 'cheque';
}

/**
 * Dépôt de garantie / Cautionnement
 */
export interface CautionnementGerance {
  montant: number;
  nombre_mois_redevance?: number;
  type: 'depot_especes' | 'garantie_bancaire' | 'caution_solidaire';

  // Garantie bancaire
  banque_nom?: string;
  banque_agence?: string;
  garantie_numero?: string;
  garantie_date_emission?: string;

  // Caution solidaire
  caution_nom?: string;
  caution_adresse?: string;
  caution_montant_max?: number;
}

/**
 * Stock de marchandises
 */
export interface StockConfig {
  reprise_stock: boolean;
  valeur_stock_entree?: number;
  mode_evaluation: 'cout_achat' | 'prix_vente_minore' | 'inventaire';
  taux_minoration_vente?: number;
  inventaire_contradictoire: boolean;
  date_inventaire?: string;
}

// ============================================
// INTERFACE PRINCIPALE - CONTRAT
// ============================================

/**
 * Contrat de location-gérance complet
 */
export interface LocationGeranceContract {
  id: string;

  // Référence
  reference: string;
  version: number;

  // Parties
  loueur: LoueurFonds;
  gerant: GerantFonds;

  // Fonds de commerce
  fonds: FondsDeCommerce;

  // Durée
  duree_type: 'determinee' | 'indeterminee';
  duree_mois?: number; // Si déterminée
  date_debut: string;
  date_fin?: string;
  tacite_reconduction: boolean;
  preavis_non_reconduction_mois?: number;

  // Conditions financières
  redevance: RedevanceConfig;
  cautionnement?: CautionnementGerance;
  stock?: StockConfig;

  // Charges
  charges_locatives_gerant: boolean; // Si bail commercial sous-jacent
  taxe_fonciere_gerant: boolean;
  cfe_gerant: boolean; // Cotisation Foncière des Entreprises
  assurances_gerant: string[];

  // Obligations du gérant
  obligation_exploitation_personnelle: boolean;
  obligation_continuation_activite: boolean;
  interdiction_sous_location: boolean;
  interdiction_cession: boolean;
  clause_non_concurrence?: {
    active: boolean;
    duree_mois?: number;
    perimetre_km?: number;
    activites_concernees?: string[];
  };

  // Obligations du loueur
  obligation_non_concurrence_loueur: boolean;
  garantie_jouissance_paisible: boolean;

  // Fin de contrat
  clause_resiliation_anticipee: boolean;
  preavis_resiliation_mois?: number;
  indemnite_resiliation?: number;
  conditions_restitution?: string;

  // Solidarité fiscale et sociale (Art. L144-7)
  solidarite_dettes: {
    active: boolean;
    duree_mois: number; // Généralement 6 mois après publication fin
    montant_max?: number;
  };

  // Publication obligatoire
  publication_jal: {
    journal_nom?: string;
    date_publication?: string;
    reference_publication?: string;
  };

  // Statut
  status: LocationGeranceStatus;

  // Métadonnées
  created_at: string;
  updated_at: string;
  created_by?: string;
  signed_at?: string;
}

// ============================================
// DTOs
// ============================================

/**
 * Créer un contrat de location-gérance
 */
export interface CreateLocationGeranceDTO {
  loueur: LoueurFonds;
  gerant: GerantFonds;
  fonds: Omit<FondsDeCommerce, 'id'>;
  duree_type: 'determinee' | 'indeterminee';
  duree_mois?: number;
  date_debut: string;
  redevance: RedevanceConfig;
  cautionnement?: CautionnementGerance;
  stock?: StockConfig;
}

/**
 * Mettre à jour le contrat
 */
export interface UpdateLocationGeranceDTO {
  redevance?: Partial<RedevanceConfig>;
  date_fin?: string;
  status?: LocationGeranceStatus;
  publication_jal?: {
    journal_nom: string;
    date_publication: string;
    reference_publication: string;
  };
}

/**
 * Données pour le template
 */
export interface LocationGeranceTemplateData {
  // Référence
  REFERENCE: string;
  DATE_SIGNATURE: string;

  // Loueur
  LOUEUR_TYPE: string;
  LOUEUR_IDENTITE: string;
  LOUEUR_ADRESSE: string;
  LOUEUR_RCS?: string;
  LOUEUR_REPRESENTANT?: string;

  // Gérant
  GERANT_TYPE: string;
  GERANT_IDENTITE: string;
  GERANT_ADRESSE: string;
  GERANT_RCS?: string;
  GERANT_RM?: string;
  GERANT_REPRESENTANT?: string;

  // Fonds
  FONDS_NOM: string;
  FONDS_ENSEIGNE?: string;
  FONDS_ACTIVITE: string;
  FONDS_ADRESSE: string;
  FONDS_TYPE_LABEL: string;

  // Éléments du fonds
  ELEMENTS_INCORPORELS_HTML: string;
  ELEMENTS_CORPORELS_HTML: string;
  LICENCES_HTML: string;

  // Bail sous-jacent
  HAS_BAIL_COMMERCIAL: boolean;
  BAIL_REFERENCE?: string;
  BAIL_FIN?: string;
  BAILLEUR_NOM?: string;

  // Durée
  DUREE_TYPE: string;
  DUREE_MOIS?: number;
  DATE_DEBUT: string;
  DATE_FIN?: string;
  TACITE_RECONDUCTION: boolean;
  PREAVIS_MOIS?: number;

  // Redevance
  REDEVANCE_TYPE_LABEL: string;
  REDEVANCE_MONTANT_MENSUEL?: string;
  REDEVANCE_POURCENTAGE?: string;
  REDEVANCE_MINIMUM_GARANTI?: string;
  REDEVANCE_INDEXATION: boolean;
  REDEVANCE_INDICE?: string;
  REDEVANCE_TVA: boolean;
  REDEVANCE_TVA_TAUX?: string;

  // Cautionnement
  HAS_CAUTIONNEMENT: boolean;
  CAUTIONNEMENT_TYPE?: string;
  CAUTIONNEMENT_MONTANT?: string;

  // Stock
  HAS_STOCK: boolean;
  STOCK_VALEUR?: string;
  STOCK_MODE_EVALUATION?: string;

  // Charges
  CHARGES_HTML: string;

  // Obligations
  OBLIGATIONS_GERANT_HTML: string;
  OBLIGATIONS_LOUEUR_HTML: string;

  // Clause non-concurrence
  HAS_NON_CONCURRENCE: boolean;
  NON_CONCURRENCE_DUREE?: string;
  NON_CONCURRENCE_PERIMETRE?: string;

  // Solidarité
  SOLIDARITE_DUREE_MOIS: number;

  // Publication
  HAS_PUBLICATION: boolean;
  PUBLICATION_JOURNAL?: string;
  PUBLICATION_DATE?: string;
  PUBLICATION_REFERENCE?: string;
}

// ============================================
// CONSTANTES
// ============================================

/**
 * Labels des types de fonds
 */
export const FONDS_TYPE_LABELS: Record<FondsDeCommerceType, string> = {
  commerce_detail: 'Commerce de détail',
  restaurant: 'Restaurant / Bar / Brasserie',
  hotel: 'Hôtel / Hébergement',
  garage: 'Garage / Station-service',
  salon_coiffure: 'Salon de coiffure / Esthétique',
  boulangerie: 'Boulangerie / Pâtisserie',
  pharmacie: 'Pharmacie',
  tabac_presse: 'Tabac / Presse / PMU',
  agence_immobiliere: 'Agence immobilière',
  agence_voyage: 'Agence de voyage',
  pressing: 'Pressing / Blanchisserie',
  superette: 'Supérette / Alimentation',
  discothèque: 'Discothèque / Bar de nuit',
  artisanat: 'Activité artisanale',
  services: 'Services',
  autre: 'Autre',
};

/**
 * Labels des types de redevance
 */
export const REDEVANCE_TYPE_LABELS: Record<RedevanceType, string> = {
  fixe: 'Montant fixe',
  pourcentage_ca: 'Pourcentage du chiffre d\'affaires',
  mixte: 'Minimum garanti + pourcentage',
  progressive: 'Redevance progressive',
};

/**
 * Labels des statuts
 */
export const LOCATION_GERANCE_STATUS_LABELS: Record<LocationGeranceStatus, string> = {
  draft: 'Brouillon',
  pending_publication: 'En attente de publication',
  published: 'Publié au JAL',
  active: 'Actif',
  suspended: 'Suspendu',
  terminated: 'Résilié',
  expired: 'Expiré',
};

/**
 * Labels des types de fin de contrat
 */
export const FIN_CONTRAT_LABELS: Record<FinContratType, string> = {
  terme: 'Arrivée à terme',
  resiliation_loueur: 'Résiliation par le loueur',
  resiliation_gerant: 'Résiliation par le gérant',
  faute_grave: 'Faute grave',
  redressement: 'Redressement judiciaire',
  liquidation: 'Liquidation judiciaire',
  cession: 'Cession du fonds',
  deces: 'Décès du gérant',
};

/**
 * Labels des types de licence
 */
export const LICENCE_TYPE_LABELS: Record<LicenceFonds['type'], string> = {
  licence_4: 'Licence IV (débit de boissons)',
  licence_3: 'Licence III (boissons fermentées)',
  licence_2: 'Licence II (boissons fermentées < 3°)',
  licence_restaurant: 'Licence restaurant',
  debit_tabac: 'Débit de tabac',
  pharmacie: 'Autorisation pharmacie',
  taxi: 'Licence taxi / VTC',
  autre: 'Autre autorisation',
};

/**
 * Configuration par défaut
 */
export const DEFAULT_LOCATION_GERANCE_CONFIG = {
  duree_type: 'determinee' as const,
  duree_mois: 36, // 3 ans standard
  tacite_reconduction: true,
  preavis_non_reconduction_mois: 6,
  solidarite_dettes_mois: 6, // 6 mois après publication fin (Art. L144-7)
  preavis_resiliation_mois: 3,
  obligation_exploitation_personnelle: true,
  obligation_continuation_activite: true,
  interdiction_sous_location: true,
  interdiction_cession: true,
  tva_applicable: true,
  tva_taux: 20,
};

/**
 * Indices de référence pour l'indexation
 */
export const INDICES_LOCATION_GERANCE = {
  ILC: {
    code: 'ILC',
    nom: 'Indice des Loyers Commerciaux',
    description: 'Recommandé pour les activités commerciales',
    source: 'INSEE',
  },
  ILAT: {
    code: 'ILAT',
    nom: 'Indice des Loyers des Activités Tertiaires',
    description: 'Recommandé pour les activités de services',
    source: 'INSEE',
  },
  ICC: {
    code: 'ICC',
    nom: 'Indice du Coût de la Construction',
    description: 'Indice historique (moins utilisé)',
    source: 'INSEE',
  },
};

/**
 * Obligations légales du gérant
 */
export const OBLIGATIONS_LEGALES_GERANT = [
  'Immatriculation au RCS ou RM obligatoire (Art. L144-3)',
  'Mention "gérant-mandataire" ou "locataire-gérant" sur tous documents',
  'Exploitation personnelle et continue du fonds',
  'Maintien de la destination et de l\'activité',
  'Entretien du matériel et des locaux',
  'Paiement des charges d\'exploitation',
  'Souscription des assurances obligatoires',
  'Communication des comptes au loueur',
  'Respect des normes d\'hygiène et de sécurité',
  'Non-concurrence pendant et après le contrat (si clause)',
];

/**
 * Obligations légales du loueur
 */
export const OBLIGATIONS_LEGALES_LOUEUR = [
  'Délivrance du fonds en état d\'exploitation',
  'Garantie d\'éviction',
  'Garantie des vices cachés',
  'Non-concurrence envers le gérant',
  'Maintien du bail commercial sous-jacent',
  'Information sur la situation du fonds',
];

/**
 * Délais légaux
 */
export const DELAIS_LEGAUX_LOCATION_GERANCE = {
  publication_debut_jours: 15, // Publication dans les 15 jours du début
  solidarite_mois: 6, // Solidarité fiscale 6 mois après publication fin
  prescription_redevances_ans: 5, // Prescription commerciale
  delai_contestation_inventaire_jours: 8,
};

/**
 * Documents requis pour la mise en location-gérance
 */
export const DOCUMENTS_REQUIS_LOCATION_GERANCE = [
  { type: 'contrat_signe', label: 'Contrat de location-gérance signé', obligatoire: true },
  { type: 'publication_jal', label: 'Publication au Journal d\'Annonces Légales', obligatoire: true },
  { type: 'kbis_gerant', label: 'Extrait K-bis du gérant (ou inscription RM)', obligatoire: true },
  { type: 'inventaire_fonds', label: 'Inventaire contradictoire du fonds', obligatoire: true },
  { type: 'bail_commercial', label: 'Copie du bail commercial', obligatoire: false },
  { type: 'autorisation_bailleur', label: 'Autorisation du bailleur des murs', obligatoire: false },
  { type: 'attestation_assurance_gerant', label: 'Attestation d\'assurance RC Pro', obligatoire: true },
  { type: 'licences', label: 'Copies des licences et autorisations', obligatoire: false },
  { type: 'comptes_annuels', label: 'Comptes annuels des 3 derniers exercices', obligatoire: false },
  { type: 'caution_bancaire', label: 'Garantie bancaire ou dépôt de garantie', obligatoire: false },
];
