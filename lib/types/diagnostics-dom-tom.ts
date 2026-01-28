/**
 * Types Diagnostics DOM-TOM - GAP-009/010/011 SOTA 2026
 *
 * Spécificités réglementaires des départements et régions d'outre-mer:
 * - 971: Guadeloupe
 * - 972: Martinique
 * - 973: Guyane
 * - 974: La Réunion
 * - 976: Mayotte
 *
 * Conformité:
 * - Loi n°99-471 du 8 juin 1999 (termites)
 * - Décret n°2006-1114 (état parasitaire)
 * - Code de l'environnement (risques naturels DOM)
 * - Arrêtés préfectoraux spécifiques par territoire
 */

// ============================================
// DÉPARTEMENTS ET TERRITOIRES D'OUTRE-MER
// ============================================

/**
 * Codes des départements d'outre-mer
 */
export type DepartementDOM =
  | '971'   // Guadeloupe
  | '972'   // Martinique
  | '973'   // Guyane
  | '974'   // La Réunion
  | '976';  // Mayotte

/**
 * Collectivités d'outre-mer (COM) - pour information
 */
export type CollectiviteOM =
  | '975'   // Saint-Pierre-et-Miquelon
  | '977'   // Saint-Barthélemy
  | '978'   // Saint-Martin
  | '986'   // Wallis-et-Futuna
  | '987'   // Polynésie française
  | '988';  // Nouvelle-Calédonie

/**
 * Informations sur chaque DOM
 */
export interface DOMInfo {
  code: DepartementDOM;
  nom: string;
  region: string;
  chef_lieu: string;
  fuseau_horaire: string;
  risques_specifiques: RisqueNaturelDOM[];
  termites_obligatoire: boolean;
  zone_sismique: ZoneSismique;
  zone_cyclonique: boolean;
  zone_volcanique: boolean;
}

// ============================================
// DIAGNOSTIC TERMITES - Loi du 8 juin 1999
// ============================================

/**
 * État d'infestation termites
 */
export type EtatTermites =
  | 'absence'              // Absence d'indices d'infestation
  | 'indices_anciens'      // Indices anciens sans activité
  | 'presence_active'      // Présence active de termites
  | 'non_visible';         // Éléments non visibles/accessibles

/**
 * Type de termites présents dans les DOM
 */
export type TypeTermite =
  | 'reticulitermes'       // Termites souterrains (métropole + DOM)
  | 'cryptotermes'         // Termites de bois sec (Antilles)
  | 'coptotermes'          // Termites formosan (très agressifs - Réunion)
  | 'nasutitermes'         // Termites arboricoles (Guyane)
  | 'heterotermes';        // Termites souterrains (Antilles)

/**
 * Zone du diagnostic termites
 */
export type ZoneDiagnosticTermites =
  | 'interieur'            // Parties intérieures
  | 'exterieur'            // Parties extérieures (10m)
  | 'parties_communes'     // Parties communes (copro)
  | 'dependances';         // Dépendances (garage, etc.)

/**
 * Résultat du diagnostic termites
 */
export interface DiagnosticTermites {
  id: string;

  /** Bien concerné */
  property_id: string;

  /** Diagnostiqueur certifié */
  diagnostiqueur: {
    nom: string;
    certification: string;
    numero_certification: string;
    assurance_rc: string;
    date_validite_certification: string;
  };

  /** Date du diagnostic */
  date_diagnostic: string;

  /** Date de validité (6 mois pour termites) */
  date_validite: string;

  /** Département */
  departement: DepartementDOM | string;

  /** Commune */
  commune: string;

  /** Zone délimitée par arrêté préfectoral */
  zone_arrete_prefectoral: boolean;

  /** Référence de l'arrêté préfectoral */
  reference_arrete?: string | null;

  /** Résultats par zone */
  resultats: DiagnosticTermitesZone[];

  /** Types de termites identifiés */
  types_termites_identifies: TypeTermite[];

  /** Conclusion générale */
  conclusion: EtatTermites;

  /** Présence active détectée */
  presence_active: boolean;

  /** Traitement préventif existant */
  traitement_preventif_existant: boolean;

  /** Date du dernier traitement */
  date_dernier_traitement?: string | null;

  /** Recommandations */
  recommandations: string[];

  /** Document PDF du diagnostic */
  document_id?: string | null;

  /** Métadonnées */
  created_at: string;
  updated_at: string;
}

/**
 * Résultat par zone inspectée
 */
export interface DiagnosticTermitesZone {
  zone: ZoneDiagnosticTermites;
  localisation: string;
  etat: EtatTermites;
  elements_infestes?: string[];
  observations?: string | null;
}

// ============================================
// RISQUES NATURELS SPÉCIFIQUES DOM
// ============================================

/**
 * Types de risques naturels spécifiques aux DOM
 */
export type RisqueNaturelDOM =
  | 'cyclone'              // Cyclones tropicaux
  | 'seisme'               // Séismes (Antilles, Réunion, Mayotte)
  | 'volcan'               // Activité volcanique
  | 'tsunami'              // Tsunamis
  | 'inondation'           // Inondations
  | 'mouvement_terrain'    // Mouvements de terrain
  | 'submersion_marine'    // Submersion marine
  | 'erosion_cotiere'      // Érosion côtière
  | 'recul_trait_cote'     // Recul du trait de côte
  | 'radon'                // Radon (zones volcaniques)
  | 'feu_foret';           // Feux de forêt (saison sèche)

/**
 * Zone sismique (1 à 5)
 */
export type ZoneSismique =
  | 1    // Très faible
  | 2    // Faible
  | 3    // Modérée
  | 4    // Moyenne
  | 5;   // Forte

/**
 * Niveau de risque cyclonique
 */
export type NiveauRisqueCyclone =
  | 'vigilance_jaune'      // Vigilance
  | 'vigilance_orange'     // Alerte
  | 'vigilance_rouge'      // Alerte maximale
  | 'vigilance_violette';  // Confinement total (Antilles)

/**
 * Zone de risque volcanique
 */
export type ZoneVolcanique =
  | 'zone_interdite'       // Accès interdit (cratère)
  | 'zone_danger_immediat' // Danger immédiat
  | 'zone_proximite'       // Zone de proximité
  | 'zone_eloignee';       // Zone éloignée

/**
 * État des Risques et Pollutions spécifique DOM
 */
export interface ERPDomTom {
  id: string;

  /** Bien concerné */
  property_id: string;

  /** Département DOM */
  departement: DepartementDOM;

  /** Commune */
  commune: string;

  /** Date de l'ERP */
  date_erp: string;

  /** Durée de validité (6 mois) */
  date_validite: string;

  // ===== RISQUES NATURELS =====

  /** Zone sismique */
  zone_sismique: ZoneSismique;

  /** Zone cyclonique */
  zone_cyclonique: boolean;

  /** Niveau de risque cyclonique historique */
  niveau_cyclonique_historique?: NiveauRisqueCyclone | null;

  /** Constructions paracycloniques obligatoires */
  normes_paracycloniques: boolean;

  /** Zone volcanique (Réunion, Guadeloupe, Martinique) */
  zone_volcanique?: ZoneVolcanique | null;

  /** Distance du volcan actif (km) */
  distance_volcan_km?: number | null;

  /** Volcan de référence */
  volcan_reference?: string | null;

  /** Risque tsunami */
  risque_tsunami: boolean;

  /** Zone submersion marine */
  zone_submersion_marine: boolean;

  /** Zone inondable */
  zone_inondable: boolean;

  /** Plan de prévention des risques naturels (PPRN) */
  pprn: {
    existe: boolean;
    reference?: string | null;
    date_approbation?: string | null;
    prescriptions?: string[];
  };

  /** Zone de mouvement de terrain */
  mouvement_terrain: boolean;

  /** Zone érosion côtière */
  erosion_cotiere: boolean;

  /** Recul du trait de côte */
  recul_trait_cote: {
    concerne: boolean;
    horizon_30_ans?: boolean;
    horizon_100_ans?: boolean;
  };

  // ===== RISQUES TECHNOLOGIQUES =====

  /** Site SEVESO à proximité */
  seveso_proximite: boolean;

  /** Distance site SEVESO (m) */
  distance_seveso_m?: number | null;

  // ===== POLLUTION =====

  /** Secteur d'information sur les sols (SIS) */
  sis: boolean;

  /** Zone radon (niveau 1 à 3) */
  zone_radon?: 1 | 2 | 3 | null;

  // ===== DOCUMENTS =====

  /** Informations acquéreur/locataire annexées */
  ial_annexe: boolean;

  /** Document PDF de l'ERP */
  document_id?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// OBLIGATIONS PAR TERRITOIRE
// ============================================

/**
 * Configuration des obligations par territoire DOM
 */
export interface ObligationsDOMConfig {
  departement: DepartementDOM;
  nom: string;

  // Diagnostics obligatoires
  termites: {
    obligatoire: boolean;
    tout_le_territoire: boolean;
    zones_arrete?: string[];
  };

  // Normes construction
  normes_paracycloniques: boolean;
  normes_parasismiques: boolean;

  // ERP spécificités
  erp_specificites: string[];

  // Risques à mentionner obligatoirement
  risques_obligatoires: RisqueNaturelDOM[];

  // Périodicité des diagnostics
  periodicite_termites_mois: number; // 6 mois
  periodicite_erp_mois: number; // 6 mois
}

// ============================================
// CONSTANTES
// ============================================

/**
 * Informations sur chaque DOM
 */
export const DOM_INFO: Record<DepartementDOM, DOMInfo> = {
  '971': {
    code: '971',
    nom: 'Guadeloupe',
    region: 'Guadeloupe',
    chef_lieu: 'Basse-Terre',
    fuseau_horaire: 'America/Guadeloupe',
    risques_specifiques: ['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain'],
    termites_obligatoire: true,
    zone_sismique: 5,
    zone_cyclonique: true,
    zone_volcanique: true, // La Soufrière
  },
  '972': {
    code: '972',
    nom: 'Martinique',
    region: 'Martinique',
    chef_lieu: 'Fort-de-France',
    fuseau_horaire: 'America/Martinique',
    risques_specifiques: ['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain'],
    termites_obligatoire: true,
    zone_sismique: 5,
    zone_cyclonique: true,
    zone_volcanique: true, // Montagne Pelée
  },
  '973': {
    code: '973',
    nom: 'Guyane',
    region: 'Guyane',
    chef_lieu: 'Cayenne',
    fuseau_horaire: 'America/Cayenne',
    risques_specifiques: ['inondation', 'mouvement_terrain', 'feu_foret'],
    termites_obligatoire: true,
    zone_sismique: 2,
    zone_cyclonique: false, // Hors zone cyclonique
    zone_volcanique: false,
  },
  '974': {
    code: '974',
    nom: 'La Réunion',
    region: 'La Réunion',
    chef_lieu: 'Saint-Denis',
    fuseau_horaire: 'Indian/Reunion',
    risques_specifiques: ['cyclone', 'seisme', 'volcan', 'tsunami', 'inondation', 'mouvement_terrain', 'erosion_cotiere'],
    termites_obligatoire: true,
    zone_sismique: 4,
    zone_cyclonique: true,
    zone_volcanique: true, // Piton de la Fournaise
  },
  '976': {
    code: '976',
    nom: 'Mayotte',
    region: 'Mayotte',
    chef_lieu: 'Mamoudzou',
    fuseau_horaire: 'Indian/Mayotte',
    risques_specifiques: ['cyclone', 'seisme', 'tsunami', 'inondation', 'mouvement_terrain', 'volcan'],
    termites_obligatoire: true,
    zone_sismique: 4, // Augmenté après essaim sismique 2018-2021
    zone_cyclonique: true,
    zone_volcanique: true, // Volcan sous-marin découvert 2019
  },
};

/**
 * Labels pour les risques naturels DOM
 */
export const RISQUE_NATUREL_DOM_LABELS: Record<RisqueNaturelDOM, string> = {
  cyclone: 'Cyclone tropical',
  seisme: 'Séisme',
  volcan: 'Activité volcanique',
  tsunami: 'Tsunami',
  inondation: 'Inondation',
  mouvement_terrain: 'Mouvement de terrain',
  submersion_marine: 'Submersion marine',
  erosion_cotiere: 'Érosion côtière',
  recul_trait_cote: 'Recul du trait de côte',
  radon: 'Radon',
  feu_foret: 'Feu de forêt',
};

/**
 * Labels pour les états termites
 */
export const ETAT_TERMITES_LABELS: Record<EtatTermites, string> = {
  absence: 'Absence d\'indices d\'infestation',
  indices_anciens: 'Indices anciens sans activité actuelle',
  presence_active: 'Présence active de termites',
  non_visible: 'Éléments non visibles ou inaccessibles',
};

/**
 * Couleurs pour les états termites
 */
export const ETAT_TERMITES_COLORS: Record<EtatTermites, string> = {
  absence: '#22c55e',        // Vert
  indices_anciens: '#f59e0b', // Orange
  presence_active: '#ef4444', // Rouge
  non_visible: '#6b7280',     // Gris
};

/**
 * Labels pour les types de termites
 */
export const TYPE_TERMITE_LABELS: Record<TypeTermite, string> = {
  reticulitermes: 'Termites souterrains (Reticulitermes)',
  cryptotermes: 'Termites de bois sec (Cryptotermes)',
  coptotermes: 'Termites formosan (Coptotermes)',
  nasutitermes: 'Termites arboricoles (Nasutitermes)',
  heterotermes: 'Termites souterrains (Heterotermes)',
};

/**
 * Labels pour les zones sismiques
 */
export const ZONE_SISMIQUE_LABELS: Record<ZoneSismique, string> = {
  1: 'Zone 1 - Très faible',
  2: 'Zone 2 - Faible',
  3: 'Zone 3 - Modérée',
  4: 'Zone 4 - Moyenne',
  5: 'Zone 5 - Forte',
};

/**
 * Volcans actifs des DOM
 */
export const VOLCANS_ACTIFS_DOM: Record<DepartementDOM, string | null> = {
  '971': 'La Soufrière',
  '972': 'Montagne Pelée',
  '973': null,
  '974': 'Piton de la Fournaise',
  '976': 'Volcan sous-marin Fani Maoré',
};

/**
 * Configuration des obligations par DOM
 */
export const OBLIGATIONS_DOM: Record<DepartementDOM, ObligationsDOMConfig> = {
  '971': {
    departement: '971',
    nom: 'Guadeloupe',
    termites: {
      obligatoire: true,
      tout_le_territoire: true,
    },
    normes_paracycloniques: true,
    normes_parasismiques: true,
    erp_specificites: [
      'Mention zone sismique 5 obligatoire',
      'Mention risque volcanique (La Soufrière)',
      'Mention zone cyclonique',
      'Mention risque tsunami',
    ],
    risques_obligatoires: ['cyclone', 'seisme', 'volcan', 'tsunami'],
    periodicite_termites_mois: 6,
    periodicite_erp_mois: 6,
  },
  '972': {
    departement: '972',
    nom: 'Martinique',
    termites: {
      obligatoire: true,
      tout_le_territoire: true,
    },
    normes_paracycloniques: true,
    normes_parasismiques: true,
    erp_specificites: [
      'Mention zone sismique 5 obligatoire',
      'Mention risque volcanique (Montagne Pelée)',
      'Mention zone cyclonique',
      'Mention risque tsunami',
    ],
    risques_obligatoires: ['cyclone', 'seisme', 'volcan', 'tsunami'],
    periodicite_termites_mois: 6,
    periodicite_erp_mois: 6,
  },
  '973': {
    departement: '973',
    nom: 'Guyane',
    termites: {
      obligatoire: true,
      tout_le_territoire: true,
    },
    normes_paracycloniques: false, // Hors zone cyclonique
    normes_parasismiques: false, // Zone sismique faible
    erp_specificites: [
      'Mention risque inondation (forte pluviométrie)',
      'Mention termites (espèces tropicales agressives)',
    ],
    risques_obligatoires: ['inondation', 'mouvement_terrain'],
    periodicite_termites_mois: 6,
    periodicite_erp_mois: 6,
  },
  '974': {
    departement: '974',
    nom: 'La Réunion',
    termites: {
      obligatoire: true,
      tout_le_territoire: true,
    },
    normes_paracycloniques: true,
    normes_parasismiques: true,
    erp_specificites: [
      'Mention zone sismique 4 obligatoire',
      'Mention risque volcanique (Piton de la Fournaise)',
      'Mention zone cyclonique',
      'Mention érosion côtière',
    ],
    risques_obligatoires: ['cyclone', 'seisme', 'volcan', 'erosion_cotiere'],
    periodicite_termites_mois: 6,
    periodicite_erp_mois: 6,
  },
  '976': {
    departement: '976',
    nom: 'Mayotte',
    termites: {
      obligatoire: true,
      tout_le_territoire: true,
    },
    normes_paracycloniques: true,
    normes_parasismiques: true,
    erp_specificites: [
      'Mention zone sismique 4 obligatoire (essaim sismique 2018-2021)',
      'Mention volcan sous-marin (Fani Maoré)',
      'Mention zone cyclonique',
      'Mention risque tsunami',
    ],
    risques_obligatoires: ['cyclone', 'seisme', 'volcan', 'tsunami'],
    periodicite_termites_mois: 6,
    periodicite_erp_mois: 6,
  },
};

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Vérifie si un département est un DOM
 */
export function isDepartementDOM(departement: string): departement is DepartementDOM {
  return ['971', '972', '973', '974', '976'].includes(departement);
}

/**
 * Récupère les informations d'un DOM
 */
export function getDOMInfo(departement: string): DOMInfo | null {
  if (!isDepartementDOM(departement)) return null;
  return DOM_INFO[departement];
}

/**
 * Vérifie si le diagnostic termites est obligatoire pour un département
 */
export function isTermitesObligatoire(departement: string): boolean {
  if (!isDepartementDOM(departement)) {
    // En métropole, vérifier si zone délimitée par arrêté préfectoral
    // (non implémenté ici - nécessite base de données des arrêtés)
    return false;
  }
  return DOM_INFO[departement].termites_obligatoire;
}

/**
 * Récupère les risques obligatoires à mentionner pour un DOM
 */
export function getRisquesObligatoires(departement: string): RisqueNaturelDOM[] {
  if (!isDepartementDOM(departement)) return [];
  return OBLIGATIONS_DOM[departement].risques_obligatoires;
}

/**
 * Calcule la date de validité du diagnostic termites (6 mois)
 */
export function getDateValiditeTermites(dateDiagnostic: string): string {
  const date = new Date(dateDiagnostic);
  date.setMonth(date.getMonth() + 6);
  return date.toISOString().split('T')[0];
}

/**
 * Vérifie si un diagnostic termites est encore valide
 */
export function isTermitesValide(dateValidite: string): boolean {
  return new Date(dateValidite) >= new Date();
}

/**
 * Récupère la zone sismique d'un département
 */
export function getZoneSismique(departement: string): ZoneSismique | null {
  if (!isDepartementDOM(departement)) return null;
  return DOM_INFO[departement].zone_sismique;
}

/**
 * Vérifie si le département est en zone cyclonique
 */
export function isZoneCyclonique(departement: string): boolean {
  if (!isDepartementDOM(departement)) return false;
  return DOM_INFO[departement].zone_cyclonique;
}

/**
 * Vérifie si le département a un risque volcanique
 */
export function isZoneVolcanique(departement: string): boolean {
  if (!isDepartementDOM(departement)) return false;
  return DOM_INFO[departement].zone_volcanique;
}

/**
 * Récupère le volcan actif d'un DOM
 */
export function getVolcanActif(departement: string): string | null {
  if (!isDepartementDOM(departement)) return null;
  return VOLCANS_ACTIFS_DOM[departement];
}

/**
 * Génère la liste des diagnostics obligatoires pour un bien DOM
 */
export function getDiagnosticsObligatoiresDOM(
  departement: string,
  isVente: boolean = false
): string[] {
  if (!isDepartementDOM(departement)) return [];

  const diagnostics: string[] = [];
  const config = OBLIGATIONS_DOM[departement];

  // Termites toujours obligatoire en DOM
  diagnostics.push('Diagnostic termites (état parasitaire)');

  // ERP toujours obligatoire
  diagnostics.push('État des Risques et Pollutions (ERP) spécifique DOM');

  // Ajouts selon le territoire
  if (config.normes_paracycloniques) {
    diagnostics.push('Attestation normes paracycloniques');
  }

  if (config.normes_parasismiques) {
    diagnostics.push('Attestation normes parasismiques');
  }

  // Pour une vente
  if (isVente) {
    diagnostics.push('DPE');
    diagnostics.push('Diagnostic électricité (si > 15 ans)');
    diagnostics.push('Diagnostic gaz (si > 15 ans)');
    if (['971', '972', '973'].includes(departement)) {
      diagnostics.push('Diagnostic amiante (si permis avant 1997)');
    }
  }

  return diagnostics;
}

/**
 * Retourne les spécificités ERP pour un DOM
 */
export function getERPSpecificites(departement: string): string[] {
  if (!isDepartementDOM(departement)) return [];
  return OBLIGATIONS_DOM[departement].erp_specificites;
}
