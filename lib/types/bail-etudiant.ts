/**
 * Types Bail Étudiant - GAP-008 SOTA 2026
 *
 * Conformité:
 * - Loi n°89-462 du 6 juillet 1989 - Article 25-9
 * - Loi ALUR du 24 mars 2014
 * - Décret n°2015-981 du 31 juillet 2015 (mobilier obligatoire)
 *
 * Le bail étudiant est un bail meublé spécifique:
 * - Durée fixe de 9 mois (année universitaire)
 * - Non reconductible tacitement
 * - Réservé aux étudiants (justificatif requis)
 * - Dépôt de garantie max 2 mois
 * - Préavis locataire: 1 mois
 */

// ============================================
// TYPES - Statut étudiant
// ============================================

/**
 * Type d'établissement d'enseignement
 */
export type TypeEtablissement =
  | 'universite'           // Université publique
  | 'grande_ecole'         // Grande école (commerce, ingénieur)
  | 'iut'                  // Institut Universitaire de Technologie
  | 'bts'                  // Section de Technicien Supérieur
  | 'cpge'                 // Classe Préparatoire aux Grandes Écoles
  | 'ecole_art'            // École d'art
  | 'ecole_sante'          // École de santé (infirmier, kiné, etc.)
  | 'ecole_commerce'       // École de commerce
  | 'ecole_ingenieur'      // École d'ingénieur
  | 'formation_continue'   // Formation continue (certificat étudiant)
  | 'apprentissage'        // Centre de Formation des Apprentis
  | 'autre';               // Autre établissement agréé

/**
 * Niveau d'études
 */
export type NiveauEtudes =
  | 'bac'           // Baccalauréat (terminale)
  | 'bac_plus_1'    // L1 / 1ère année post-bac
  | 'bac_plus_2'    // L2 / BTS / DUT / CPGE 2
  | 'bac_plus_3'    // L3 / Licence / Bachelor
  | 'bac_plus_4'    // M1 / 1ère année Master
  | 'bac_plus_5'    // M2 / Diplôme ingénieur / Master
  | 'bac_plus_6'    // Doctorat 1ère année
  | 'bac_plus_7'    // Doctorat 2ème année
  | 'bac_plus_8'    // Doctorat 3ème année et +
  | 'autre';        // Autre niveau

/**
 * Type de justificatif étudiant
 */
export type JustificatifEtudiantType =
  | 'carte_etudiant'              // Carte d'étudiant en cours
  | 'certificat_scolarite'        // Certificat de scolarité
  | 'attestation_inscription'     // Attestation d'inscription
  | 'convention_stage'            // Convention de stage (si stagiaire)
  | 'contrat_apprentissage';      // Contrat d'apprentissage

// ============================================
// INTERFACES - Profil étudiant
// ============================================

/**
 * Informations sur l'établissement d'enseignement
 */
export interface EtablissementEnseignement {
  /** Nom de l'établissement */
  nom: string;

  /** Type d'établissement */
  type: TypeEtablissement;

  /** Adresse de l'établissement */
  adresse?: string | null;

  /** Code postal */
  code_postal?: string | null;

  /** Ville */
  ville: string;

  /** Numéro UAI (ex-RNE) si connu */
  numero_uai?: string | null;

  /** Site web de l'établissement */
  site_web?: string | null;
}

/**
 * Informations sur le cursus de l'étudiant
 */
export interface CursusEtudiant {
  /** Établissement */
  etablissement: EtablissementEnseignement;

  /** Année universitaire (ex: "2025-2026") */
  annee_universitaire: string;

  /** Niveau d'études */
  niveau: NiveauEtudes;

  /** Intitulé de la formation */
  formation: string;

  /** Numéro INE (Identifiant National Étudiant) */
  numero_ine?: string | null;

  /** Date de début de l'année universitaire */
  date_debut_annee: string;

  /** Date de fin de l'année universitaire */
  date_fin_annee: string;
}

/**
 * Justificatif de statut étudiant
 */
export interface JustificatifEtudiant {
  /** Type de justificatif */
  type: JustificatifEtudiantType;

  /** Référence du document uploadé */
  document_id?: string | null;

  /** Numéro du document (carte étudiant, etc.) */
  numero?: string | null;

  /** Date de validité du justificatif */
  date_validite: string;

  /** Établissement émetteur */
  etablissement_emetteur: string;

  /** Vérifié par le bailleur */
  verifie: boolean;

  /** Date de vérification */
  date_verification?: string | null;
}

// ============================================
// INTERFACES - Configuration Bail Étudiant
// ============================================

/**
 * Configuration spécifique du bail étudiant
 */
export interface BailEtudiantConfig {
  /** Durée fixe en mois (toujours 9 pour bail étudiant) */
  duree_mois: 9;

  /** Dépôt de garantie max (2 mois pour meublé) */
  depot_garantie_max_mois: 2;

  /** Préavis locataire (1 mois) */
  preavis_locataire_mois: 1;

  /** Reconduction tacite désactivée */
  tacite_reconduction: false;

  /** Référence à l'année universitaire */
  annee_universitaire: string;

  /** Date de début alignée sur rentrée */
  date_debut_suggeree: string;

  /** Date de fin alignée sur fin d'année */
  date_fin_suggeree: string;

  /** Clause de résiliation anticipée autorisée */
  resiliation_anticipee: boolean;

  /** Garant obligatoire (recommandé pour étudiants) */
  garant_obligatoire: boolean;

  /** Visale acceptée */
  visale_accepte: boolean;

  /** APL compatible */
  apl_eligible: boolean;
}

/**
 * Données complètes du bail étudiant
 */
export interface BailEtudiantData {
  /** Configuration de base */
  config: BailEtudiantConfig;

  /** Informations du cursus étudiant */
  cursus: CursusEtudiant;

  /** Justificatif fourni */
  justificatif: JustificatifEtudiant;

  /** Contact des parents/responsables (si mineur ou pour urgence) */
  contact_responsable?: {
    nom: string;
    prenom: string;
    telephone: string;
    email?: string | null;
    lien: 'pere' | 'mere' | 'tuteur' | 'autre';
    adresse?: string | null;
  } | null;

  /** Informations Visale si applicable */
  visale?: {
    numero_visa: string;
    date_validite: string;
    montant_couvert: number;
    document_id?: string | null;
  } | null;
}

// ============================================
// INTERFACES - Template Data
// ============================================

/**
 * Variables pour le template du bail étudiant
 */
export interface BailEtudiantTemplateData {
  // Parties
  bailleur: {
    nom: string;
    prenom?: string | null;
    adresse: string;
    email?: string | null;
    telephone?: string | null;
    type: 'particulier' | 'societe';
    siret?: string | null;
    representant?: string | null;
  };

  locataire: {
    nom: string;
    prenom: string;
    date_naissance: string;
    lieu_naissance?: string | null;
    nationalite?: string | null;
    email: string;
    telephone?: string | null;
  };

  // Cursus
  cursus: {
    etablissement_nom: string;
    etablissement_type: string;
    etablissement_ville: string;
    formation: string;
    niveau: string;
    annee_universitaire: string;
    numero_ine?: string | null;
  };

  // Justificatif
  justificatif: {
    type: string;
    numero?: string | null;
    date_validite: string;
    etablissement_emetteur: string;
  };

  // Logement
  logement: {
    adresse: string;
    code_postal: string;
    ville: string;
    type: string; // "Studio", "T1", etc.
    surface_m2: number;
    etage?: number | null;
    ascenseur?: boolean;
    meuble: true; // Toujours meublé
    equipements: string[];
  };

  // Conditions financières
  conditions: {
    loyer_mensuel: number;
    charges_forfaitaires: number;
    total_mensuel: number;
    depot_garantie: number;
    mode_paiement: string;
    jour_paiement: number;
  };

  // Durée
  duree: {
    date_debut: string;
    date_fin: string;
    duree_mois: 9;
    annee_universitaire: string;
    tacite_reconduction: false;
    preavis_locataire: string; // "1 mois"
  };

  // Garant (si applicable)
  garant?: {
    nom: string;
    prenom: string;
    adresse: string;
    telephone?: string | null;
    type_caution: 'simple' | 'solidaire';
    montant_engagement?: number | null;
  } | null;

  // Visale (si applicable)
  visale?: {
    numero_visa: string;
    montant_couvert: number;
  } | null;

  // Contact responsable (si mineur)
  responsable?: {
    nom: string;
    prenom: string;
    telephone: string;
    lien: string;
  } | null;

  // Métadonnées
  reference_bail: string;
  date_signature: string;
  lieu_signature: string;
}

// ============================================
// DTOs
// ============================================

export interface CreateBailEtudiantDTO {
  /** ID de la propriété */
  property_id: string;

  /** Informations du locataire étudiant */
  locataire: {
    profile_id?: string | null; // Si profil existant
    nom: string;
    prenom: string;
    email: string;
    telephone?: string | null;
    date_naissance: string;
    lieu_naissance?: string | null;
  };

  /** Cursus de l'étudiant */
  cursus: CursusEtudiant;

  /** Justificatif de scolarité */
  justificatif: Omit<JustificatifEtudiant, 'verifie' | 'date_verification'>;

  /** Date de début du bail */
  date_debut: string;

  /** Loyer mensuel hors charges */
  loyer_hc: number;

  /** Charges forfaitaires mensuelles */
  charges: number;

  /** Dépôt de garantie (max 2 mois) */
  depot_garantie: number;

  /** Garant (optionnel) */
  garant?: {
    profile_id?: string | null;
    nom: string;
    prenom: string;
    adresse: string;
    telephone?: string | null;
    email?: string | null;
    type_caution: 'simple' | 'solidaire';
  } | null;

  /** Numéro Visale (optionnel, alternative au garant) */
  visale_numero?: string | null;

  /** Contact des parents/responsables */
  contact_responsable?: {
    nom: string;
    prenom: string;
    telephone: string;
    email?: string | null;
    lien: 'pere' | 'mere' | 'tuteur' | 'autre';
  } | null;
}

// ============================================
// CONSTANTES
// ============================================

/**
 * Labels pour les types d'établissement
 */
export const TYPE_ETABLISSEMENT_LABELS: Record<TypeEtablissement, string> = {
  universite: 'Université',
  grande_ecole: 'Grande École',
  iut: 'IUT (Institut Universitaire de Technologie)',
  bts: 'Section BTS',
  cpge: 'Classe Préparatoire (CPGE)',
  ecole_art: "École d'Art",
  ecole_sante: 'École de Santé',
  ecole_commerce: 'École de Commerce',
  ecole_ingenieur: "École d'Ingénieur",
  formation_continue: 'Formation Continue',
  apprentissage: 'CFA (Centre de Formation des Apprentis)',
  autre: 'Autre établissement',
};

/**
 * Labels pour les niveaux d'études
 */
export const NIVEAU_ETUDES_LABELS: Record<NiveauEtudes, string> = {
  bac: 'Terminale / Baccalauréat',
  bac_plus_1: 'Bac+1 (L1 / 1ère année)',
  bac_plus_2: 'Bac+2 (L2 / BTS / DUT)',
  bac_plus_3: 'Bac+3 (Licence / Bachelor)',
  bac_plus_4: 'Bac+4 (M1 / 1ère année Master)',
  bac_plus_5: 'Bac+5 (M2 / Diplôme ingénieur)',
  bac_plus_6: 'Bac+6 (Doctorat 1ère année)',
  bac_plus_7: 'Bac+7 (Doctorat 2ème année)',
  bac_plus_8: 'Bac+8+ (Doctorat 3ème année et +)',
  autre: 'Autre niveau',
};

/**
 * Labels pour les types de justificatif
 */
export const JUSTIFICATIF_ETUDIANT_LABELS: Record<JustificatifEtudiantType, string> = {
  carte_etudiant: "Carte d'étudiant",
  certificat_scolarite: 'Certificat de scolarité',
  attestation_inscription: "Attestation d'inscription",
  convention_stage: 'Convention de stage',
  contrat_apprentissage: "Contrat d'apprentissage",
};

/**
 * Configuration par défaut du bail étudiant
 */
export const DEFAULT_BAIL_ETUDIANT_CONFIG: BailEtudiantConfig = {
  duree_mois: 9,
  depot_garantie_max_mois: 2,
  preavis_locataire_mois: 1,
  tacite_reconduction: false,
  annee_universitaire: '',
  date_debut_suggeree: '',
  date_fin_suggeree: '',
  resiliation_anticipee: true,
  garant_obligatoire: false, // Recommandé mais pas obligatoire
  visale_accepte: true,
  apl_eligible: true,
};

/**
 * Mobilier minimum obligatoire pour location meublée (Décret 2015-981)
 * Requis pour tout bail étudiant (qui est un bail meublé)
 */
export const MOBILIER_OBLIGATOIRE_MEUBLE = [
  'Literie comprenant couette ou couverture',
  "Dispositif d'occultation des fenêtres dans les pièces destinées au sommeil",
  'Plaques de cuisson',
  'Four ou four à micro-ondes',
  'Réfrigérateur et congélateur ou réfrigérateur avec compartiment à une température ≤ -6°C',
  'Vaisselle nécessaire à la prise des repas',
  'Ustensiles de cuisine',
  'Table et sièges',
  'Étagères de rangement',
  'Luminaires',
  'Matériel d\'entretien ménager adapté aux caractéristiques du logement',
];

/**
 * Documents requis pour un bail étudiant
 */
export const DOCUMENTS_REQUIS_BAIL_ETUDIANT = {
  locataire: [
    { type: 'piece_identite', obligatoire: true, description: "Carte d'identité ou passeport" },
    { type: 'certificat_scolarite', obligatoire: true, description: 'Certificat de scolarité ou carte étudiant' },
    { type: 'avis_imposition', obligatoire: false, description: 'Avis d\'imposition (ou des parents si rattaché)' },
    { type: 'attestation_assurance', obligatoire: true, description: 'Attestation assurance habitation' },
    { type: 'rib', obligatoire: true, description: 'RIB pour prélèvement loyer' },
  ],
  garant: [
    { type: 'piece_identite', obligatoire: true, description: "Carte d'identité ou passeport du garant" },
    { type: 'avis_imposition', obligatoire: true, description: 'Dernier avis d\'imposition' },
    { type: 'justificatif_domicile', obligatoire: true, description: 'Justificatif de domicile < 3 mois' },
    { type: 'justificatif_revenus', obligatoire: true, description: '3 derniers bulletins de salaire' },
  ],
};

/**
 * Dates types de rentrée universitaire en France
 */
export const DATES_RENTREE_UNIVERSITAIRE = {
  standard: {
    debut: '09-01', // 1er septembre
    fin: '05-31',   // 31 mai
  },
  semestre_decale: {
    debut: '01-15', // Mi-janvier
    fin: '09-30',   // Fin septembre
  },
};

/**
 * Calcule l'année universitaire en cours ou à venir
 */
export function getAnneeUniversitaire(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 0-indexed

  // Si après août, c'est la rentrée de l'année en cours
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  // Sinon, on est dans l'année universitaire commencée l'année précédente
  return `${year - 1}-${year}`;
}

/**
 * Calcule les dates suggérées pour un bail étudiant
 */
export function getDatesSuggeresBailEtudiant(anneeUniversitaire: string): {
  date_debut: string;
  date_fin: string;
} {
  const [anneeDebut] = anneeUniversitaire.split('-').map(Number);

  return {
    date_debut: `${anneeDebut}-09-01`,
    date_fin: `${anneeDebut + 1}-05-31`,
  };
}

/**
 * Vérifie si un locataire est éligible au bail étudiant
 */
export function isEligibleBailEtudiant(
  justificatifType: JustificatifEtudiantType,
  dateValidite: string
): { eligible: boolean; raison?: string } {
  const aujourdhui = new Date();
  const validite = new Date(dateValidite);

  if (validite < aujourdhui) {
    return {
      eligible: false,
      raison: 'Le justificatif étudiant a expiré. Veuillez fournir un document à jour.',
    };
  }

  return { eligible: true };
}

/**
 * Calcule le dépôt de garantie maximum légal
 */
export function getDepotGarantieMax(loyerMensuelHC: number): number {
  // Pour bail meublé (dont étudiant): max 2 mois de loyer hors charges
  return loyerMensuelHC * 2;
}

/**
 * Vérifie la conformité du dépôt de garantie
 */
export function verifierDepotGarantie(
  montant: number,
  loyerHC: number
): { conforme: boolean; max: number; message?: string } {
  const max = getDepotGarantieMax(loyerHC);

  if (montant > max) {
    return {
      conforme: false,
      max,
      message: `Le dépôt de garantie (${montant}€) dépasse le maximum légal de 2 mois de loyer (${max}€).`,
    };
  }

  return { conforme: true, max };
}
