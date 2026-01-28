/**
 * Types Taxe de Séjour - GAP-006 SOTA 2026
 *
 * Conformité:
 * - Article L2333-26 à L2333-47 du Code général des collectivités territoriales (CGCT)
 * - Décret n°2019-1062 du 17 octobre 2019 (taux plafonds)
 * - Loi de finances 2024 (taxe additionnelle départementale 10%)
 *
 * La taxe de séjour s'applique aux:
 * - Hébergements touristiques marchands
 * - Locations saisonnières (meublés de tourisme)
 * - Locations via plateformes (Airbnb, Booking, etc.)
 *
 * Deux modes de perception:
 * - Au réel: par personne et par nuitée (cas général)
 * - Au forfait: montant fixe par unité de capacité (sur délibération)
 */

// ============================================
// TYPES D'HÉBERGEMENT - Article L2333-30 CGCT
// ============================================

/**
 * Classification des hébergements touristiques
 * Impacte directement le taux de taxe applicable
 */
export type HebergementTouristiqueType =
  | 'palace'                    // Palace (distinction spéciale)
  | 'hotel_5_etoiles'           // Hôtel 5 étoiles
  | 'hotel_4_etoiles'           // Hôtel 4 étoiles
  | 'hotel_3_etoiles'           // Hôtel 3 étoiles
  | 'hotel_2_etoiles'           // Hôtel 2 étoiles
  | 'hotel_1_etoile'            // Hôtel 1 étoile
  | 'hotel_non_classe'          // Hôtel en attente de classement
  | 'residence_tourisme_5'      // Résidence de tourisme 5 étoiles
  | 'residence_tourisme_4'      // Résidence de tourisme 4 étoiles
  | 'residence_tourisme_3'      // Résidence de tourisme 3 étoiles
  | 'residence_tourisme_2'      // Résidence de tourisme 2 étoiles
  | 'residence_tourisme_1'      // Résidence de tourisme 1 étoile
  | 'residence_tourisme_nc'     // Résidence de tourisme non classée
  | 'meuble_tourisme_5'         // Meublé de tourisme 5 étoiles
  | 'meuble_tourisme_4'         // Meublé de tourisme 4 étoiles
  | 'meuble_tourisme_3'         // Meublé de tourisme 3 étoiles
  | 'meuble_tourisme_2'         // Meublé de tourisme 2 étoiles
  | 'meuble_tourisme_1'         // Meublé de tourisme 1 étoile
  | 'meuble_tourisme_nc'        // Meublé de tourisme non classé
  | 'chambre_hotes'             // Chambre d'hôtes
  | 'camping_5_etoiles'         // Terrain de camping 5 étoiles
  | 'camping_4_etoiles'         // Terrain de camping 4 étoiles
  | 'camping_3_etoiles'         // Terrain de camping 3 étoiles
  | 'camping_2_etoiles'         // Terrain de camping 2 étoiles
  | 'camping_1_etoile'          // Terrain de camping 1 étoile
  | 'camping_non_classe'        // Terrain de camping non classé
  | 'village_vacances_4_5'      // Village de vacances 4-5 étoiles
  | 'village_vacances_1_2_3'    // Village de vacances 1-2-3 étoiles
  | 'auberge_jeunesse'          // Auberge de jeunesse
  | 'port_plaisance'            // Emplacement port de plaisance
  | 'aire_camping_car'          // Aire de camping-car
  | 'autre_hebergement';        // Autre hébergement non classé

/**
 * Mode de perception de la taxe
 */
export type ModePerceptionTaxe =
  | 'au_reel'      // Par personne et par nuitée (défaut)
  | 'au_forfait';  // Montant fixe par unité de capacité

/**
 * Statut de la déclaration
 */
export type DeclarationTaxeStatus =
  | 'brouillon'          // En cours de saisie
  | 'a_declarer'         // Prête à être déclarée
  | 'declaree'           // Déclarée à la commune
  | 'validee'            // Validée par la commune
  | 'payee'              // Payée
  | 'annulee';           // Annulée

/**
 * Motif d'exonération - Article L2333-31 CGCT
 */
export type MotifExoneration =
  | 'mineur'                    // Personnes mineures
  | 'intermediaire_agence'      // Intermédiaires agences de voyage
  | 'travailleur_saisonnier'    // Travailleurs saisonniers (contrat)
  | 'logement_urgence'          // Hébergement d'urgence
  | 'resident_secondaire_taxe'; // Propriétaire résidence secondaire (taxe habitation)

// ============================================
// TARIFS PLAFONDS 2024 - Décret 2019-1062
// ============================================

/**
 * Tarifs plafonds par catégorie d'hébergement (€/personne/nuit)
 * Source: Article L2333-30 CGCT modifié par loi finances 2024
 */
export const TARIFS_PLAFONDS_2024: Record<HebergementTouristiqueType, number> = {
  // Palaces et hôtels
  palace: 15.00,
  hotel_5_etoiles: 5.00,
  hotel_4_etoiles: 2.88,
  hotel_3_etoiles: 1.70,
  hotel_2_etoiles: 1.00,
  hotel_1_etoile: 0.90,
  hotel_non_classe: 0.90,

  // Résidences de tourisme
  residence_tourisme_5: 5.00,
  residence_tourisme_4: 2.88,
  residence_tourisme_3: 1.70,
  residence_tourisme_2: 1.00,
  residence_tourisme_1: 0.90,
  residence_tourisme_nc: 0.90,

  // Meublés de tourisme (locations saisonnières Talok)
  meuble_tourisme_5: 5.00,
  meuble_tourisme_4: 2.88,
  meuble_tourisme_3: 1.70,
  meuble_tourisme_2: 1.00,
  meuble_tourisme_1: 0.90,
  meuble_tourisme_nc: 0.90,

  // Chambres d'hôtes
  chambre_hotes: 0.90,

  // Campings
  camping_5_etoiles: 0.70,
  camping_4_etoiles: 0.60,
  camping_3_etoiles: 0.55,
  camping_2_etoiles: 0.33,
  camping_1_etoile: 0.25,
  camping_non_classe: 0.25,

  // Villages vacances
  village_vacances_4_5: 1.00,
  village_vacances_1_2_3: 0.90,

  // Autres
  auberge_jeunesse: 0.25,
  port_plaisance: 0.25,
  aire_camping_car: 0.25,
  autre_hebergement: 0.90,
};

/**
 * Labels d'affichage pour les types d'hébergement
 */
export const HEBERGEMENT_TYPE_LABELS: Record<HebergementTouristiqueType, string> = {
  palace: 'Palace',
  hotel_5_etoiles: 'Hôtel 5 étoiles',
  hotel_4_etoiles: 'Hôtel 4 étoiles',
  hotel_3_etoiles: 'Hôtel 3 étoiles',
  hotel_2_etoiles: 'Hôtel 2 étoiles',
  hotel_1_etoile: 'Hôtel 1 étoile',
  hotel_non_classe: 'Hôtel non classé',
  residence_tourisme_5: 'Résidence de tourisme 5 étoiles',
  residence_tourisme_4: 'Résidence de tourisme 4 étoiles',
  residence_tourisme_3: 'Résidence de tourisme 3 étoiles',
  residence_tourisme_2: 'Résidence de tourisme 2 étoiles',
  residence_tourisme_1: 'Résidence de tourisme 1 étoile',
  residence_tourisme_nc: 'Résidence de tourisme non classée',
  meuble_tourisme_5: 'Meublé de tourisme 5 étoiles',
  meuble_tourisme_4: 'Meublé de tourisme 4 étoiles',
  meuble_tourisme_3: 'Meublé de tourisme 3 étoiles',
  meuble_tourisme_2: 'Meublé de tourisme 2 étoiles',
  meuble_tourisme_1: 'Meublé de tourisme 1 étoile',
  meuble_tourisme_nc: 'Meublé de tourisme non classé',
  chambre_hotes: "Chambre d'hôtes",
  camping_5_etoiles: 'Camping 5 étoiles',
  camping_4_etoiles: 'Camping 4 étoiles',
  camping_3_etoiles: 'Camping 3 étoiles',
  camping_2_etoiles: 'Camping 2 étoiles',
  camping_1_etoile: 'Camping 1 étoile',
  camping_non_classe: 'Camping non classé',
  village_vacances_4_5: 'Village de vacances 4-5 étoiles',
  village_vacances_1_2_3: 'Village de vacances 1-2-3 étoiles',
  auberge_jeunesse: 'Auberge de jeunesse',
  port_plaisance: 'Port de plaisance',
  aire_camping_car: 'Aire de camping-car',
  autre_hebergement: 'Autre hébergement',
};

/**
 * Labels pour les motifs d'exonération
 */
export const EXONERATION_LABELS: Record<MotifExoneration, string> = {
  mineur: 'Personne mineure (moins de 18 ans)',
  intermediaire_agence: "Intermédiaire d'agence de voyage",
  travailleur_saisonnier: 'Travailleur saisonnier (contrat de travail)',
  logement_urgence: "Hébergement d'urgence ou relogement temporaire",
  resident_secondaire_taxe: 'Propriétaire résidence secondaire (assujetti à la taxe d\'habitation)',
};

// ============================================
// INTERFACES - Configuration Commune
// ============================================

/**
 * Configuration de la taxe de séjour pour une commune
 * Chaque commune fixe ses taux dans les limites des plafonds
 */
export interface TaxeSejourCommuneConfig {
  /** Code INSEE de la commune */
  code_insee: string;

  /** Nom de la commune */
  nom_commune: string;

  /** Code postal principal */
  code_postal: string;

  /** Département */
  departement: string;

  /** La commune perçoit-elle la taxe de séjour ? */
  taxe_active: boolean;

  /** Mode de perception choisi par la commune */
  mode_perception: ModePerceptionTaxe;

  /** Tarifs appliqués par type d'hébergement (€/personne/nuit) */
  tarifs: Partial<Record<HebergementTouristiqueType, number>>;

  /** Taxe additionnelle départementale (10% max, Article L3333-1 CGCT) */
  taxe_additionnelle_departementale: number;

  /** URL du portail de déclaration de la commune (si existe) */
  portail_declaration_url?: string | null;

  /** Périodicité de déclaration */
  periodicite_declaration: 'mensuelle' | 'trimestrielle' | 'annuelle';

  /** Date limite de déclaration (jour du mois) */
  jour_limite_declaration: number;

  /** Observations spécifiques de la commune */
  observations?: string | null;

  /** Dates de validité */
  date_debut_validite: string;
  date_fin_validite?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// INTERFACES - Séjours et Déclarations
// ============================================

/**
 * Information sur un occupant pour le calcul de la taxe
 */
export interface OccupantSejour {
  /** Nom de l'occupant (optionnel) */
  nom?: string | null;

  /** Prénom de l'occupant (optionnel) */
  prenom?: string | null;

  /** Date de naissance pour vérifier minorité */
  date_naissance?: string | null;

  /** Est mineur (calculé ou saisi) */
  est_mineur: boolean;

  /** Motif d'exonération le cas échéant */
  exoneration?: MotifExoneration | null;

  /** Justificatif d'exonération (référence document) */
  justificatif_exoneration?: string | null;
}

/**
 * Séjour touristique soumis à taxe de séjour
 * Lié à une réservation saisonnière
 */
export interface SejourTouristique {
  id: string;

  /** Référence de la réservation/bail saisonnier */
  lease_id: string;

  /** Bien concerné */
  property_id: string;

  /** Propriétaire (collecteur de la taxe) */
  owner_id: string;

  /** Type d'hébergement déclaré */
  type_hebergement: HebergementTouristiqueType;

  /** Numéro d'enregistrement mairie (obligatoire dans certaines villes) */
  numero_enregistrement?: string | null;

  /** Dates du séjour */
  date_arrivee: string;
  date_depart: string;

  /** Nombre de nuitées */
  nombre_nuitees: number;

  /** Liste des occupants */
  occupants: OccupantSejour[];

  /** Nombre total d'occupants */
  nombre_occupants_total: number;

  /** Nombre d'occupants assujettis (non exonérés, non mineurs) */
  nombre_occupants_assujettis: number;

  /** Configuration taxe de la commune applicable */
  commune_config_id: string;

  /** Taux appliqué (€/personne/nuit) */
  taux_applique: number;

  /** Taxe additionnelle départementale appliquée */
  taux_additionnel_departemental: number;

  /** Montant total de la taxe collectée */
  montant_taxe_collectee: number;

  /** Montant de la taxe additionnelle */
  montant_taxe_additionnelle: number;

  /** Montant total (taxe + additionnelle) */
  montant_total: number;

  /** Taxe effectivement collectée auprès du locataire */
  taxe_collectee: boolean;

  /** Date de collecte */
  date_collecte?: string | null;

  /** Moyen de paiement de la taxe par le locataire */
  moyen_paiement_taxe?: 'especes' | 'cb' | 'virement' | 'inclus_loyer' | null;

  /** Observations */
  observations?: string | null;

  created_at: string;
  updated_at: string;
}

/**
 * Déclaration périodique de taxe de séjour à la commune
 */
export interface DeclarationTaxeSejour {
  id: string;

  /** Propriétaire déclarant */
  owner_id: string;

  /** Commune destinataire */
  commune_config_id: string;

  /** Période de déclaration */
  periode_debut: string;
  periode_fin: string;

  /** Année fiscale */
  annee_fiscale: number;

  /** Trimestre ou mois selon périodicité */
  periode_reference: string; // "2026-Q1" ou "2026-01"

  /** Statut de la déclaration */
  statut: DeclarationTaxeStatus;

  /** Liste des séjours inclus dans cette déclaration */
  sejours_ids: string[];

  /** Nombre total de nuitées déclarées */
  total_nuitees: number;

  /** Nombre total de personnes assujetties */
  total_personnes_assujetties: number;

  /** Montant total de taxe à reverser */
  montant_taxe_totale: number;

  /** Montant taxe additionnelle départementale */
  montant_taxe_additionnelle: number;

  /** Montant global à reverser */
  montant_total_a_reverser: number;

  /** Date limite de déclaration */
  date_limite: string;

  /** Date de déclaration effective */
  date_declaration?: string | null;

  /** Référence de déclaration (numéro commune) */
  reference_declaration?: string | null;

  /** Date de paiement */
  date_paiement?: string | null;

  /** Référence de paiement */
  reference_paiement?: string | null;

  /** Moyen de paiement à la commune */
  moyen_paiement?: 'virement' | 'prelevement' | 'cheque' | 'telepaiement' | null;

  /** Document justificatif (reçu de la commune) */
  justificatif_id?: string | null;

  /** Notes internes */
  notes?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// DTOs - Création et mise à jour
// ============================================

export interface CreateSejourTouristiqueDTO {
  lease_id: string;
  property_id: string;
  type_hebergement: HebergementTouristiqueType;
  numero_enregistrement?: string | null;
  date_arrivee: string;
  date_depart: string;
  occupants: OccupantSejour[];
  observations?: string | null;
}

export interface UpdateSejourTouristiqueDTO {
  type_hebergement?: HebergementTouristiqueType;
  numero_enregistrement?: string | null;
  occupants?: OccupantSejour[];
  taxe_collectee?: boolean;
  date_collecte?: string | null;
  moyen_paiement_taxe?: 'especes' | 'cb' | 'virement' | 'inclus_loyer' | null;
  observations?: string | null;
}

export interface CreateDeclarationDTO {
  commune_config_id: string;
  periode_debut: string;
  periode_fin: string;
  sejours_ids: string[];
  notes?: string | null;
}

// ============================================
// INTERFACES - Calculs et Reporting
// ============================================

/**
 * Résultat du calcul de taxe pour un séjour
 */
export interface CalculTaxeSejourResult {
  /** Nombre de nuitées */
  nuitees: number;

  /** Nombre d'occupants assujettis */
  occupants_assujettis: number;

  /** Nombre d'occupants exonérés */
  occupants_exoneres: number;

  /** Détail des exonérations */
  detail_exonerations: Array<{
    motif: MotifExoneration;
    nombre: number;
  }>;

  /** Taux unitaire appliqué */
  taux_unitaire: number;

  /** Taxe de base (nuitées × occupants × taux) */
  taxe_base: number;

  /** Taux additionnel départemental (%) */
  taux_additionnel_pct: number;

  /** Montant taxe additionnelle */
  taxe_additionnelle: number;

  /** Total à collecter */
  total: number;

  /** Formule de calcul (pour affichage) */
  formule: string;
}

/**
 * Statistiques de taxe de séjour pour un propriétaire
 */
export interface TaxeSejourStats {
  /** Période */
  periode: {
    debut: string;
    fin: string;
  };

  /** Nombre de séjours */
  nombre_sejours: number;

  /** Total nuitées */
  total_nuitees: number;

  /** Total personnes */
  total_personnes: number;

  /** Total taxe collectée */
  total_taxe_collectee: number;

  /** Total taxe à reverser */
  total_taxe_a_reverser: number;

  /** Taxe en attente de collecte */
  taxe_en_attente: number;

  /** Déclarations en cours */
  declarations_en_cours: number;

  /** Déclarations en retard */
  declarations_en_retard: number;

  /** Répartition par type d'hébergement */
  par_type_hebergement: Array<{
    type: HebergementTouristiqueType;
    nuitees: number;
    montant: number;
  }>;

  /** Répartition par commune */
  par_commune: Array<{
    code_insee: string;
    nom_commune: string;
    nuitees: number;
    montant: number;
  }>;
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Calcule la taxe de séjour pour un séjour donné
 */
export function calculerTaxeSejour(
  nuitees: number,
  occupants: OccupantSejour[],
  tauxUnitaire: number,
  tauxAdditionnelPct: number = 0
): CalculTaxeSejourResult {
  // Compter les occupants assujettis (non mineurs et non exonérés)
  const assujettis = occupants.filter(o => !o.est_mineur && !o.exoneration);
  const exoneres = occupants.filter(o => o.est_mineur || o.exoneration);

  // Détail des exonérations
  const exonerationMap = new Map<MotifExoneration, number>();
  exoneres.forEach(o => {
    const motif = o.est_mineur ? 'mineur' : o.exoneration!;
    exonerationMap.set(motif, (exonerationMap.get(motif) || 0) + 1);
  });

  const detailExonerations = Array.from(exonerationMap.entries()).map(([motif, nombre]) => ({
    motif,
    nombre,
  }));

  // Calcul taxe
  const taxeBase = nuitees * assujettis.length * tauxUnitaire;
  const taxeAdditionnelle = taxeBase * (tauxAdditionnelPct / 100);
  const total = taxeBase + taxeAdditionnelle;

  return {
    nuitees,
    occupants_assujettis: assujettis.length,
    occupants_exoneres: exoneres.length,
    detail_exonerations: detailExonerations,
    taux_unitaire: tauxUnitaire,
    taxe_base: Math.round(taxeBase * 100) / 100,
    taux_additionnel_pct: tauxAdditionnelPct,
    taxe_additionnelle: Math.round(taxeAdditionnelle * 100) / 100,
    total: Math.round(total * 100) / 100,
    formule: `${nuitees} nuits × ${assujettis.length} pers. × ${tauxUnitaire.toFixed(2)}€ = ${taxeBase.toFixed(2)}€` +
      (tauxAdditionnelPct > 0 ? ` + ${tauxAdditionnelPct}% = ${total.toFixed(2)}€` : ''),
  };
}

/**
 * Détermine si un occupant est mineur à la date du séjour
 */
export function estMineurALaDate(dateNaissance: string | null | undefined, dateSejour: string): boolean {
  if (!dateNaissance) return false;

  const naissance = new Date(dateNaissance);
  const sejour = new Date(dateSejour);

  let age = sejour.getFullYear() - naissance.getFullYear();
  const moisDiff = sejour.getMonth() - naissance.getMonth();

  if (moisDiff < 0 || (moisDiff === 0 && sejour.getDate() < naissance.getDate())) {
    age--;
  }

  return age < 18;
}

/**
 * Retourne le tarif plafond pour un type d'hébergement
 */
export function getTarifPlafond(type: HebergementTouristiqueType): number {
  return TARIFS_PLAFONDS_2024[type] || TARIFS_PLAFONDS_2024.autre_hebergement;
}

/**
 * Valide qu'un taux communal ne dépasse pas le plafond
 */
export function validerTauxCommunal(
  type: HebergementTouristiqueType,
  tauxCommune: number
): { valide: boolean; plafond: number; message?: string } {
  const plafond = getTarifPlafond(type);

  if (tauxCommune > plafond) {
    return {
      valide: false,
      plafond,
      message: `Le taux de ${tauxCommune.toFixed(2)}€ dépasse le plafond légal de ${plafond.toFixed(2)}€ pour ${HEBERGEMENT_TYPE_LABELS[type]}`,
    };
  }

  return { valide: true, plafond };
}

/**
 * Groupe les types d'hébergement par catégorie
 */
export const HEBERGEMENT_TYPE_GROUPS = {
  hotels: [
    'palace',
    'hotel_5_etoiles',
    'hotel_4_etoiles',
    'hotel_3_etoiles',
    'hotel_2_etoiles',
    'hotel_1_etoile',
    'hotel_non_classe',
  ] as HebergementTouristiqueType[],

  residences_tourisme: [
    'residence_tourisme_5',
    'residence_tourisme_4',
    'residence_tourisme_3',
    'residence_tourisme_2',
    'residence_tourisme_1',
    'residence_tourisme_nc',
  ] as HebergementTouristiqueType[],

  meubles_tourisme: [
    'meuble_tourisme_5',
    'meuble_tourisme_4',
    'meuble_tourisme_3',
    'meuble_tourisme_2',
    'meuble_tourisme_1',
    'meuble_tourisme_nc',
  ] as HebergementTouristiqueType[],

  campings: [
    'camping_5_etoiles',
    'camping_4_etoiles',
    'camping_3_etoiles',
    'camping_2_etoiles',
    'camping_1_etoile',
    'camping_non_classe',
  ] as HebergementTouristiqueType[],

  autres: [
    'chambre_hotes',
    'village_vacances_4_5',
    'village_vacances_1_2_3',
    'auberge_jeunesse',
    'port_plaisance',
    'aire_camping_car',
    'autre_hebergement',
  ] as HebergementTouristiqueType[],
};

/**
 * Types d'hébergement les plus courants pour Talok (locations saisonnières)
 */
export const HEBERGEMENT_TYPES_TALOK: HebergementTouristiqueType[] = [
  'meuble_tourisme_5',
  'meuble_tourisme_4',
  'meuble_tourisme_3',
  'meuble_tourisme_2',
  'meuble_tourisme_1',
  'meuble_tourisme_nc',
  'chambre_hotes',
];

/**
 * Configuration par défaut pour un bien saisonnier Talok
 */
export const DEFAULT_TAXE_SEJOUR_CONFIG = {
  type_hebergement: 'meuble_tourisme_nc' as HebergementTouristiqueType,
  taxe_additionnelle_departementale: 10, // 10% max légal
};

// ============================================
// CONSTANTES - Villes avec numéro d'enregistrement obligatoire
// ============================================

/**
 * Villes où le numéro d'enregistrement meublé tourisme est obligatoire
 * (Article L324-1-1 du Code du tourisme)
 */
export const VILLES_ENREGISTREMENT_OBLIGATOIRE = [
  'Paris',
  'Lyon',
  'Marseille',
  'Bordeaux',
  'Nice',
  'Toulouse',
  'Montpellier',
  'Strasbourg',
  'Nantes',
  'Lille',
  'Annecy',
  'Biarritz',
  'Cannes',
  'Chamonix-Mont-Blanc',
  'La Rochelle',
  'Saint-Malo',
  // ... autres communes ayant délibéré
];

/**
 * Vérifie si une commune requiert un numéro d'enregistrement
 */
export function requiresNumeroEnregistrement(nomCommune: string): boolean {
  return VILLES_ENREGISTREMENT_OBLIGATOIRE.some(
    ville => nomCommune.toLowerCase().includes(ville.toLowerCase())
  );
}
