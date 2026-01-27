/**
 * Types TypeScript pour les États des Lieux Commerciaux et Professionnels
 * GAP-007: EDL spécifique pour les locaux commerciaux et professionnels
 *
 * Spécificités par rapport à l'EDL résidentiel:
 * - Zones commerciales (vitrine, enseigne, zone clientèle)
 * - Installations techniques (climatisation, ventilation, alarme)
 * - Conformité ERP et accessibilité PMR
 * - Sécurité incendie
 * - Équipements professionnels spécifiques
 */

// ============================================
// ENUMS - CATÉGORIES D'INSPECTION COMMERCIALE
// ============================================

/**
 * Catégories d'inspection pour locaux commerciaux
 */
export type CommercialInspectionCategory =
  | 'facade_vitrine'           // Façade et vitrine
  | 'enseigne_signalisation'   // Enseigne et signalisation
  | 'zone_accueil'             // Zone d'accueil/réception
  | 'zone_vente'               // Surface de vente
  | 'zone_stockage'            // Réserve/stockage
  | 'bureaux'                  // Bureaux administratifs
  | 'sanitaires'               // Sanitaires (clients/personnel)
  | 'cuisine_restauration'     // Zone cuisine/restauration (si applicable)
  | 'installations_techniques' // Installations techniques
  | 'securite_incendie'        // Sécurité incendie
  | 'accessibilite_pmr'        // Accessibilité PMR
  | 'exterieur_parking'        // Extérieurs et parking
  | 'reseaux_compteurs';       // Réseaux et compteurs

/**
 * Catégories d'inspection pour locaux professionnels (libéraux)
 */
export type ProfessionalInspectionCategory =
  | 'facade_entree'            // Façade et entrée
  | 'plaque_professionnelle'   // Plaque professionnelle
  | 'salle_attente'            // Salle d'attente
  | 'bureau_consultation'      // Bureau/Cabinet de consultation
  | 'salle_examen'             // Salle d'examen/soins (médical)
  | 'archives_dossiers'        // Zone archives/dossiers
  | 'sanitaires'               // Sanitaires
  | 'salle_reunion'            // Salle de réunion
  | 'installations_techniques' // Installations techniques
  | 'securite'                 // Sécurité (alarme, coffre, etc.)
  | 'accessibilite_pmr'        // Accessibilité PMR
  | 'reseaux_compteurs';       // Réseaux et compteurs

/**
 * Tous les types de catégories
 */
export type EDLCommercialCategory = CommercialInspectionCategory | ProfessionalInspectionCategory;

/**
 * Type de local
 */
export type CommercialPremiseType =
  | 'boutique'                 // Boutique/Commerce de détail
  | 'restaurant'               // Restaurant
  | 'bureau'                   // Bureau/Tertiaire
  | 'atelier'                  // Atelier
  | 'entrepot'                 // Entrepôt
  | 'local_activite'           // Local d'activité mixte
  | 'cabinet_medical'          // Cabinet médical
  | 'cabinet_paramedical'      // Cabinet paramédical
  | 'cabinet_juridique'        // Cabinet juridique
  | 'cabinet_comptable'        // Cabinet comptable/expertise
  | 'agence'                   // Agence (immobilière, assurance, etc.)
  | 'autre';

/**
 * État d'un élément
 */
export type CommercialItemCondition =
  | 'neuf'
  | 'tres_bon'
  | 'bon'
  | 'usage_normal'
  | 'mauvais'
  | 'hors_service'
  | 'absent'
  | 'non_applicable';

/**
 * Niveau de conformité
 */
export type ComplianceLevel =
  | 'conforme'
  | 'non_conforme'
  | 'a_verifier'
  | 'non_applicable'
  | 'derogation';

// ============================================
// INTERFACES - ÉLÉMENTS D'INSPECTION
// ============================================

/**
 * Élément d'inspection générique
 */
export interface CommercialInspectionItem {
  id: string;
  category: EDLCommercialCategory;
  subcategory?: string;
  name: string;
  description: string;
  condition: CommercialItemCondition;
  compliance?: ComplianceLevel;
  quantity?: number;
  dimensions?: {
    longueur_m?: number;
    largeur_m?: number;
    hauteur_m?: number;
    surface_m2?: number;
  };
  photos: string[];
  observations?: string;
  defauts?: string[];
  action_requise?: string;
  estimation_reparation?: number;
}

/**
 * Inspection de façade et vitrine
 */
export interface FacadeVitrineInspection {
  // Vitrine
  vitrine_etat: CommercialItemCondition;
  vitrine_type: 'simple' | 'double' | 'securit' | 'autre';
  vitrine_surface_m2?: number;
  vitrine_film_adhesif: boolean;
  vitrine_observations?: string;

  // Façade
  facade_etat: CommercialItemCondition;
  facade_materiau: string;
  facade_peinture_date?: string;
  facade_observations?: string;

  // Store/Banne
  store_present: boolean;
  store_type?: 'banne' | 'venitien' | 'roulant' | 'autre';
  store_motorise?: boolean;
  store_etat?: CommercialItemCondition;
  store_observations?: string;

  // Porte d'entrée
  porte_entree_etat: CommercialItemCondition;
  porte_entree_type: 'vitree' | 'pleine' | 'rideau_metallique' | 'autre';
  porte_entree_serrure_type: string;
  porte_entree_nb_cles: number;

  photos: string[];
}

/**
 * Inspection enseigne et signalétique
 */
export interface EnseigneInspection {
  // Enseigne principale
  enseigne_presente: boolean;
  enseigne_type?: 'bandeau' | 'caisson' | 'lettres_decoupees' | 'drapeau' | 'autre';
  enseigne_eclairee?: boolean;
  enseigne_etat?: CommercialItemCondition;
  enseigne_dimensions?: string;
  enseigne_autorisation_mairie?: boolean;
  enseigne_observations?: string;

  // Signalétique intérieure
  signaletique_interieure: boolean;
  signaletique_sortie_secours: boolean;
  signaletique_sanitaires: boolean;
  signaletique_accessibilite: boolean;
  signaletique_observations?: string;

  photos: string[];
}

/**
 * Inspection installations techniques
 */
export interface InstallationsTechniquesInspection {
  // Climatisation
  climatisation_presente: boolean;
  climatisation_type?: 'split' | 'centralisee' | 'vmc_double_flux' | 'autre';
  climatisation_marque?: string;
  climatisation_puissance_kw?: number;
  climatisation_date_entretien?: string;
  climatisation_etat?: CommercialItemCondition;
  climatisation_observations?: string;

  // Chauffage
  chauffage_type: 'electrique' | 'gaz' | 'fioul' | 'pompe_chaleur' | 'autre';
  chauffage_equipements: string[];
  chauffage_etat: CommercialItemCondition;
  chauffage_date_entretien?: string;
  chauffage_observations?: string;

  // Ventilation
  ventilation_type: 'naturelle' | 'vmc_simple' | 'vmc_double' | 'extraction';
  ventilation_etat: CommercialItemCondition;
  ventilation_observations?: string;

  // Électricité
  electricite_puissance_kva?: number;
  electricite_tableau_conforme: boolean;
  electricite_differentiel_present: boolean;
  electricite_nb_prises?: number;
  electricite_nb_circuits?: number;
  electricite_date_diagnostic?: string;
  electricite_observations?: string;

  // Plomberie
  plomberie_arrivee_eau: boolean;
  plomberie_evacuation: boolean;
  plomberie_chauffe_eau_type?: string;
  plomberie_chauffe_eau_capacite_l?: number;
  plomberie_etat: CommercialItemCondition;
  plomberie_observations?: string;

  // Télécom/IT
  telecom_lignes_telephoniques?: number;
  telecom_fibre_optique: boolean;
  telecom_prises_rj45?: number;
  telecom_baie_brassage: boolean;
  telecom_observations?: string;

  photos: string[];
}

/**
 * Inspection sécurité incendie
 */
export interface SecuriteIncendieInspection {
  // Classification ERP
  erp_categorie?: '1' | '2' | '3' | '4' | '5' | 'non_erp';
  erp_type?: string; // M, N, O, W, etc.
  erp_capacite_max?: number;

  // Extincteurs
  extincteurs_presents: boolean;
  extincteurs_nombre?: number;
  extincteurs_types?: ('eau' | 'co2' | 'poudre' | 'mousse')[];
  extincteurs_date_verification?: string;
  extincteurs_conformes?: boolean;

  // Alarme incendie
  alarme_incendie_presente: boolean;
  alarme_incendie_type?: 'type_1' | 'type_2a' | 'type_2b' | 'type_3' | 'type_4';
  alarme_incendie_centrale?: boolean;
  alarme_incendie_nb_detecteurs?: number;
  alarme_incendie_date_verification?: string;

  // Issues de secours
  issues_secours_nombre: number;
  issues_secours_conformes: boolean;
  issues_secours_eclairage_securite: boolean;
  issues_secours_balisage: boolean;

  // Désenfumage
  desenfumage_present: boolean;
  desenfumage_type?: 'naturel' | 'mecanique';
  desenfumage_conforme?: boolean;

  // Documents
  registre_securite_present: boolean;
  registre_securite_a_jour: boolean;
  dernier_controle_commission?: string;
  avis_commission?: 'favorable' | 'defavorable' | 'sursis';

  observations?: string;
  photos: string[];
}

/**
 * Inspection accessibilité PMR
 */
export interface AccessibilitePMRInspection {
  // Conformité générale
  ad_ap_presente: boolean; // Attestation d'Accessibilité ou Ad'AP
  ad_ap_date?: string;
  ad_ap_reference?: string;

  // Accès extérieur
  acces_plain_pied: boolean;
  rampe_acces_presente?: boolean;
  rampe_acces_conforme?: boolean;
  rampe_pente_pct?: number;
  largeur_porte_entree_cm?: number;

  // Circulation intérieure
  circulation_largeur_min_cm?: number;
  circulation_libre: boolean;
  escalier_present: boolean;
  ascenseur_present?: boolean;
  ascenseur_conforme_pmr?: boolean;

  // Sanitaires PMR
  sanitaire_pmr_present: boolean;
  sanitaire_pmr_conforme?: boolean;
  sanitaire_pmr_dimensions?: string;

  // Stationnement
  place_pmr_presente: boolean;
  place_pmr_signalee?: boolean;

  // Signalétique
  signaletique_pmr_presente: boolean;
  bande_guidage_presente?: boolean;

  conformite_globale: ComplianceLevel;
  observations?: string;
  photos: string[];
}

/**
 * Inspection spécifique cabinet médical/paramédical
 */
export interface CabinetMedicalInspection {
  // Salle d'attente
  salle_attente_surface_m2?: number;
  salle_attente_capacite?: number;
  salle_attente_ventilation: boolean;
  salle_attente_etat: CommercialItemCondition;

  // Cabinet de consultation
  cabinet_surface_m2?: number;
  cabinet_lavabo_present: boolean;
  cabinet_point_eau_conforme: boolean;
  cabinet_eclairage_medical?: boolean;
  cabinet_etat: CommercialItemCondition;

  // Salle de soins/examen
  salle_soins_presente: boolean;
  salle_soins_surface_m2?: number;
  salle_soins_point_eau: boolean;
  salle_soins_prise_oxygene?: boolean;
  salle_soins_etat?: CommercialItemCondition;

  // Hygiène
  sol_lessivable: boolean;
  murs_lessivables: boolean;
  poubelle_dasri_presente?: boolean;
  conteneur_aiguilles_present?: boolean;

  // Stockage médicaments
  armoire_medicaments_presente?: boolean;
  armoire_medicaments_fermee?: boolean;
  refrigerateur_medical_present?: boolean;

  // Confidentialité
  insonorisation_correcte: boolean;
  confidentialite_respectee: boolean;

  observations?: string;
  photos: string[];
}

/**
 * Inspection compteurs et réseaux
 */
export interface CompteursReseauxInspection {
  // Compteur électrique
  compteur_elec_numero?: string;
  compteur_elec_index?: number;
  compteur_elec_type?: 'linky' | 'electronique' | 'mecanique';
  compteur_elec_puissance_kva?: number;
  compteur_elec_photo?: string;

  // Compteur gaz
  compteur_gaz_present: boolean;
  compteur_gaz_numero?: string;
  compteur_gaz_index_m3?: number;
  compteur_gaz_photo?: string;

  // Compteur eau
  compteur_eau_numero?: string;
  compteur_eau_index_m3?: number;
  compteur_eau_divisionnaire?: boolean;
  compteur_eau_photo?: string;

  // Télécom
  ligne_telephonique_numero?: string;
  acces_internet_type?: 'adsl' | 'fibre' | 'cable' | 'autre';
  debit_internet_mbps?: number;

  observations?: string;
}

// ============================================
// INTERFACE PRINCIPALE - EDL COMMERCIAL
// ============================================

/**
 * État des lieux commercial complet
 */
export interface EDLCommercial {
  id: string;
  lease_id: string;
  property_id: string;

  // Type d'EDL
  type_edl: 'entree' | 'sortie';
  type_local: CommercialPremiseType;
  type_bail: 'commercial' | 'commercial_derogatoire' | 'professionnel';

  // Informations générales
  date_edl: string;
  heure_debut: string;
  heure_fin?: string;

  // Surface détaillée
  surface_totale_m2: number;
  surface_vente_m2?: number;
  surface_reserve_m2?: number;
  surface_bureaux_m2?: number;
  surface_annexes_m2?: number;

  // Parties présentes
  representant_bailleur: {
    nom: string;
    prenom: string;
    qualite: string;
    signature?: string;
  };
  representant_preneur: {
    nom: string;
    prenom: string;
    qualite: string;
    raison_sociale?: string;
    signature?: string;
  };

  // Inspections par catégorie
  facade_vitrine?: FacadeVitrineInspection;
  enseigne?: EnseigneInspection;
  installations_techniques: InstallationsTechniquesInspection;
  securite_incendie: SecuriteIncendieInspection;
  accessibilite_pmr: AccessibilitePMRInspection;
  compteurs_reseaux: CompteursReseauxInspection;

  // Inspection spécifique cabinet médical (si applicable)
  cabinet_medical?: CabinetMedicalInspection;

  // Éléments d'inspection détaillés par pièce/zone
  items: CommercialInspectionItem[];

  // Équipements fournis par le bailleur
  equipements_bailleur: EquipementBailleur[];

  // Clés remises
  cles_remises: CleRemise[];

  // Documents annexés
  documents_annexes: DocumentAnnexe[];

  // Observations générales
  observations_generales?: string;
  reserves_preneur?: string;
  reserves_bailleur?: string;

  // État global
  etat_general: CommercialItemCondition;
  conformite_globale: ComplianceLevel;

  // Comparaison (pour EDL sortie)
  edl_entree_id?: string;
  differences_constatees?: DifferenceConstatee[];

  // Validation
  status: 'brouillon' | 'en_cours' | 'a_valider' | 'valide' | 'conteste';
  valide_bailleur: boolean;
  valide_bailleur_date?: string;
  valide_preneur: boolean;
  valide_preneur_date?: string;

  // Métadonnées
  created_at: string;
  updated_at: string;
  created_by: string;
  pdf_generated?: boolean;
  pdf_path?: string;
}

/**
 * Équipement fourni par le bailleur
 */
export interface EquipementBailleur {
  id: string;
  categorie: string;
  designation: string;
  marque?: string;
  modele?: string;
  numero_serie?: string;
  date_installation?: string;
  etat: CommercialItemCondition;
  valeur_estimee?: number;
  photo?: string;
  observations?: string;
}

/**
 * Clé remise
 */
export interface CleRemise {
  id: string;
  type: 'porte_principale' | 'porte_service' | 'rideau_metallique' | 'local_technique' | 'boite_lettres' | 'parking' | 'autre';
  description: string;
  quantite: number;
  numero_badge?: string;
  photo?: string;
}

/**
 * Document annexé à l'EDL
 */
export interface DocumentAnnexe {
  id: string;
  type: 'diagnostic' | 'attestation' | 'photo' | 'plan' | 'facture' | 'autre';
  nom: string;
  description?: string;
  chemin_fichier: string;
  date_document?: string;
}

/**
 * Différence constatée entre EDL entrée et sortie
 */
export interface DifferenceConstatee {
  id: string;
  categorie: EDLCommercialCategory;
  element: string;
  etat_entree: CommercialItemCondition;
  etat_sortie: CommercialItemCondition;
  description_degradation?: string;
  photos_entree?: string[];
  photos_sortie?: string[];
  imputable_preneur: boolean;
  estimation_reparation?: number;
  observations?: string;
}

// ============================================
// DTOs - CRÉATION ET MISE À JOUR
// ============================================

/**
 * Créer un EDL commercial
 */
export interface CreateEDLCommercialDTO {
  lease_id: string;
  property_id: string;
  type_edl: 'entree' | 'sortie';
  type_local: CommercialPremiseType;
  date_edl: string;
  heure_debut: string;

  surface_totale_m2: number;
  surface_vente_m2?: number;
  surface_reserve_m2?: number;
  surface_bureaux_m2?: number;

  representant_bailleur: {
    nom: string;
    prenom: string;
    qualite: string;
  };
  representant_preneur: {
    nom: string;
    prenom: string;
    qualite: string;
    raison_sociale?: string;
  };

  // Pour EDL sortie, référence à l'EDL entrée
  edl_entree_id?: string;
}

/**
 * Ajouter un élément d'inspection
 */
export interface AddInspectionItemDTO {
  edl_id: string;
  category: EDLCommercialCategory;
  subcategory?: string;
  name: string;
  description?: string;
  condition: CommercialItemCondition;
  compliance?: ComplianceLevel;
  quantity?: number;
  observations?: string;
  defauts?: string[];
  photos?: File[];
}

/**
 * Valider l'EDL
 */
export interface ValidateEDLCommercialDTO {
  edl_id: string;
  role: 'bailleur' | 'preneur';
  signature: string; // Base64 de la signature
  reserves?: string;
}

// ============================================
// CONSTANTES ET LABELS
// ============================================

/**
 * Labels des catégories d'inspection commerciale
 */
export const COMMERCIAL_INSPECTION_CATEGORY_LABELS: Record<CommercialInspectionCategory, string> = {
  facade_vitrine: 'Façade et Vitrine',
  enseigne_signalisation: 'Enseigne et Signalisation',
  zone_accueil: 'Zone d\'accueil',
  zone_vente: 'Surface de vente',
  zone_stockage: 'Réserve / Stockage',
  bureaux: 'Bureaux',
  sanitaires: 'Sanitaires',
  cuisine_restauration: 'Cuisine / Restauration',
  installations_techniques: 'Installations techniques',
  securite_incendie: 'Sécurité incendie',
  accessibilite_pmr: 'Accessibilité PMR',
  exterieur_parking: 'Extérieurs et Parking',
  reseaux_compteurs: 'Réseaux et Compteurs',
};

/**
 * Labels des catégories d'inspection professionnelle
 */
export const PROFESSIONAL_INSPECTION_CATEGORY_LABELS: Record<ProfessionalInspectionCategory, string> = {
  facade_entree: 'Façade et Entrée',
  plaque_professionnelle: 'Plaque professionnelle',
  salle_attente: 'Salle d\'attente',
  bureau_consultation: 'Bureau / Cabinet',
  salle_examen: 'Salle d\'examen / Soins',
  archives_dossiers: 'Archives / Dossiers',
  sanitaires: 'Sanitaires',
  salle_reunion: 'Salle de réunion',
  installations_techniques: 'Installations techniques',
  securite: 'Sécurité',
  accessibilite_pmr: 'Accessibilité PMR',
  reseaux_compteurs: 'Réseaux et Compteurs',
};

/**
 * Labels des états
 */
export const COMMERCIAL_CONDITION_LABELS: Record<CommercialItemCondition, string> = {
  neuf: 'Neuf',
  tres_bon: 'Très bon état',
  bon: 'Bon état',
  usage_normal: 'Usure normale',
  mauvais: 'Mauvais état',
  hors_service: 'Hors service',
  absent: 'Absent',
  non_applicable: 'N/A',
};

/**
 * Labels de conformité
 */
export const COMPLIANCE_LEVEL_LABELS: Record<ComplianceLevel, string> = {
  conforme: 'Conforme',
  non_conforme: 'Non conforme',
  a_verifier: 'À vérifier',
  non_applicable: 'Non applicable',
  derogation: 'Dérogation accordée',
};

/**
 * Labels des types de locaux
 */
export const COMMERCIAL_PREMISE_TYPE_LABELS: Record<CommercialPremiseType, string> = {
  boutique: 'Boutique / Commerce',
  restaurant: 'Restaurant',
  bureau: 'Bureau / Tertiaire',
  atelier: 'Atelier',
  entrepot: 'Entrepôt',
  local_activite: 'Local d\'activité',
  cabinet_medical: 'Cabinet médical',
  cabinet_paramedical: 'Cabinet paramédical',
  cabinet_juridique: 'Cabinet juridique',
  cabinet_comptable: 'Cabinet comptable',
  agence: 'Agence',
  autre: 'Autre',
};

/**
 * Types de clés
 */
export const CLE_TYPE_LABELS: Record<CleRemise['type'], string> = {
  porte_principale: 'Porte principale',
  porte_service: 'Porte de service',
  rideau_metallique: 'Rideau métallique',
  local_technique: 'Local technique',
  boite_lettres: 'Boîte aux lettres',
  parking: 'Parking',
  autre: 'Autre',
};

/**
 * Couleurs des états
 */
export const COMMERCIAL_CONDITION_COLORS: Record<CommercialItemCondition, string> = {
  neuf: '#3b82f6',        // blue-500
  tres_bon: '#22c55e',    // green-500
  bon: '#84cc16',         // lime-500
  usage_normal: '#eab308', // yellow-500
  mauvais: '#f97316',     // orange-500
  hors_service: '#ef4444', // red-500
  absent: '#6b7280',      // gray-500
  non_applicable: '#9ca3af', // gray-400
};

/**
 * Couleurs de conformité
 */
export const COMPLIANCE_LEVEL_COLORS: Record<ComplianceLevel, string> = {
  conforme: '#22c55e',     // green-500
  non_conforme: '#ef4444', // red-500
  a_verifier: '#f59e0b',   // amber-500
  non_applicable: '#9ca3af', // gray-400
  derogation: '#8b5cf6',   // violet-500
};

/**
 * Configuration des catégories ERP
 */
export const ERP_CATEGORIES = {
  '1': { capacite_min: 1500, description: 'Plus de 1500 personnes' },
  '2': { capacite_min: 701, capacite_max: 1500, description: '701 à 1500 personnes' },
  '3': { capacite_min: 301, capacite_max: 700, description: '301 à 700 personnes' },
  '4': { capacite_min: 0, capacite_max: 300, description: '300 personnes et moins (hors 5e cat.)' },
  '5': { capacite_min: 0, description: 'Selon seuils par type d\'établissement' },
  'non_erp': { capacite_min: 0, description: 'Non classé ERP' },
};

/**
 * Types d'ERP courants pour commerces
 */
export const ERP_TYPES = {
  M: 'Magasins de vente, centres commerciaux',
  N: 'Restaurants et débits de boissons',
  O: 'Hôtels et pensions de famille',
  W: 'Administrations, banques, bureaux',
  J: 'Structures d\'accueil pour personnes âgées ou handicapées',
  U: 'Établissements de soins',
};

/**
 * Checklist de conformité pour locaux commerciaux
 */
export const COMMERCIAL_COMPLIANCE_CHECKLIST = [
  { id: 'erp_categorie', label: 'Classification ERP à jour', required: true },
  { id: 'securite_incendie', label: 'Registre de sécurité à jour', required: true },
  { id: 'extincteurs', label: 'Extincteurs vérifiés annuellement', required: true },
  { id: 'issues_secours', label: 'Issues de secours dégagées et signalées', required: true },
  { id: 'accessibilite', label: 'Conformité accessibilité ou Ad\'AP', required: true },
  { id: 'diagnostic_elec', label: 'Diagnostic électrique', required: false },
  { id: 'diagnostic_gaz', label: 'Diagnostic gaz (si applicable)', required: false },
  { id: 'dpe', label: 'Diagnostic de Performance Énergétique', required: true },
];

/**
 * Éléments types à inspecter par catégorie - Commercial
 */
export const COMMERCIAL_INSPECTION_ITEMS_BY_CATEGORY: Record<CommercialInspectionCategory, string[]> = {
  facade_vitrine: [
    'Vitrine principale',
    'Châssis vitrine',
    'Film de protection / Adhésifs',
    'Store banne',
    'Porte d\'entrée principale',
    'Serrure et fermeture',
    'Rideau métallique',
  ],
  enseigne_signalisation: [
    'Enseigne principale',
    'Éclairage enseigne',
    'Enseigne drapeau',
    'Signalétique directionnelle',
    'Panneaux horaires',
  ],
  zone_accueil: [
    'Sol',
    'Murs',
    'Plafond',
    'Comptoir / Banque d\'accueil',
    'Éclairage',
    'Mobilier',
  ],
  zone_vente: [
    'Sol',
    'Murs',
    'Plafond',
    'Rayonnages / Présentoirs',
    'Éclairage',
    'Cabines d\'essayage',
    'Caisses',
  ],
  zone_stockage: [
    'Sol',
    'Murs',
    'Étagères de stockage',
    'Porte / Accès',
    'Éclairage',
    'Ventilation',
  ],
  bureaux: [
    'Sol',
    'Murs',
    'Plafond',
    'Fenêtres',
    'Portes',
    'Prises électriques',
    'Éclairage',
  ],
  sanitaires: [
    'Sol',
    'Murs',
    'WC',
    'Lavabo',
    'Miroir',
    'Robinetterie',
    'Ventilation',
    'Accessoires',
  ],
  cuisine_restauration: [
    'Sol',
    'Murs',
    'Plafond',
    'Hotte / Extraction',
    'Équipements de cuisson',
    'Réfrigération',
    'Plonge',
    'Plan de travail',
  ],
  installations_techniques: [
    'Tableau électrique',
    'Climatisation',
    'Chauffage',
    'VMC',
    'Chauffe-eau',
    'Baie de brassage',
  ],
  securite_incendie: [
    'Extincteurs',
    'Alarme incendie',
    'Détecteurs de fumée',
    'Issues de secours',
    'Éclairage de sécurité',
    'Plans d\'évacuation',
  ],
  accessibilite_pmr: [
    'Rampe d\'accès',
    'Largeur des passages',
    'Sanitaire PMR',
    'Signalétique',
    'Place de stationnement PMR',
  ],
  exterieur_parking: [
    'Parking',
    'Places de stationnement',
    'Éclairage extérieur',
    'Clôture / Portail',
    'Espaces verts',
  ],
  reseaux_compteurs: [
    'Compteur électrique',
    'Compteur gaz',
    'Compteur eau',
    'Arrivée télécom',
    'Fibre optique',
  ],
};

/**
 * Éléments types à inspecter - Cabinet médical/paramédical
 */
export const MEDICAL_INSPECTION_ITEMS: string[] = [
  'Salle d\'attente - Sol',
  'Salle d\'attente - Sièges',
  'Salle d\'attente - Revues / Documentation',
  'Cabinet - Sol',
  'Cabinet - Murs',
  'Cabinet - Bureau',
  'Cabinet - Lavabo',
  'Cabinet - Table d\'examen',
  'Cabinet - Éclairage',
  'Salle de soins - Sol',
  'Salle de soins - Équipements',
  'Sanitaires patients',
  'Sanitaires personnel',
  'Zone archives',
];
