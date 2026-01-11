/**
 * Plan Comptable Général - Gestion Locative
 * Comptes spécifiques à l'activité de gestion immobilière
 */

// ============================================================================
// JOURNAUX COMPTABLES
// ============================================================================

export const JOURNAUX = {
  VE: { code: 'VE', libelle: 'Ventes', description: 'Facturation honoraires' },
  AC: { code: 'AC', libelle: 'Achats', description: 'Factures fournisseurs' },
  BQ: { code: 'BQ', libelle: 'Banque Agence', description: 'Compte courant agence' },
  BM: { code: 'BM', libelle: 'Banque Mandant', description: 'Compte mandant' },
  OD: { code: 'OD', libelle: 'Opérations Diverses', description: 'Régularisations' },
  AN: { code: 'AN', libelle: 'À Nouveau', description: 'Report à nouveau' },
} as const;

export type JournalCode = keyof typeof JOURNAUX;

// ============================================================================
// COMPTES DE LA CLASSE 4 - TIERS
// ============================================================================

export const COMPTES_TIERS = {
  // Fournisseurs
  '401000': { numero: '401000', libelle: 'Fournisseurs', sens: 'credit' },
  '401100': { numero: '401100', libelle: 'Fournisseurs - Prestataires', sens: 'credit' },

  // Clients (Propriétaires mandants)
  '411000': { numero: '411000', libelle: 'Clients', sens: 'debit' },

  // Personnel
  '421000': { numero: '421000', libelle: 'Personnel - Rémunérations dues', sens: 'credit' },
  '431000': { numero: '431000', libelle: 'Sécurité sociale', sens: 'credit' },

  // État et collectivités
  '444000': { numero: '444000', libelle: 'État - Impôt sur les sociétés', sens: 'credit' },
  '445510': { numero: '445510', libelle: 'TVA à décaisser', sens: 'credit' },
  '445660': { numero: '445660', libelle: 'TVA déductible sur ABS', sens: 'debit' },
  '445670': { numero: '445670', libelle: 'TVA déductible sur immobilisations', sens: 'debit' },
  '445710': { numero: '445710', libelle: 'TVA collectée', sens: 'credit' },

  // Comptes mandants - CLASSE 467
  '467000': { numero: '467000', libelle: 'Autres comptes débiteurs ou créditeurs', sens: 'mixte' },
  '467100': { numero: '467100', libelle: 'Propriétaires - Comptes mandants', sens: 'credit' },
  '467200': { numero: '467200', libelle: 'Locataires - Comptes mandants', sens: 'debit' },
  '467300': { numero: '467300', libelle: 'Dépôts de garantie reçus', sens: 'credit' },
} as const;

// ============================================================================
// COMPTES DE LA CLASSE 5 - FINANCIERS
// ============================================================================

export const COMPTES_FINANCIERS = {
  '512000': { numero: '512000', libelle: 'Banque compte courant', sens: 'debit' },
  '512100': { numero: '512100', libelle: 'Banque compte épargne', sens: 'debit' },
  '530000': { numero: '530000', libelle: 'Caisse', sens: 'debit' },
  '545000': { numero: '545000', libelle: 'Banque compte mandant', sens: 'debit' },
} as const;

// ============================================================================
// COMPTES DE LA CLASSE 6 - CHARGES
// ============================================================================

export const COMPTES_CHARGES = {
  // Achats
  '606100': { numero: '606100', libelle: 'Fournitures non stockables (eau, énergie)', sens: 'debit' },
  '606400': { numero: '606400', libelle: 'Fournitures administratives', sens: 'debit' },

  // Services extérieurs
  '611000': { numero: '611000', libelle: 'Sous-traitance générale', sens: 'debit' },
  '613200': { numero: '613200', libelle: 'Locations immobilières', sens: 'debit' },
  '613500': { numero: '613500', libelle: 'Locations mobilières (SaaS)', sens: 'debit' },
  '614000': { numero: '614000', libelle: 'Charges locatives et de copropriété', sens: 'debit' },
  '615500': { numero: '615500', libelle: 'Entretien et réparations', sens: 'debit' },
  '616000': { numero: '616000', libelle: "Primes d'assurance", sens: 'debit' },

  // Autres services extérieurs
  '622600': { numero: '622600', libelle: 'Honoraires (comptables, juridiques)', sens: 'debit' },
  '623100': { numero: '623100', libelle: 'Annonces et insertions', sens: 'debit' },
  '625100': { numero: '625100', libelle: 'Voyages et déplacements', sens: 'debit' },
  '626000': { numero: '626000', libelle: 'Frais postaux et télécommunications', sens: 'debit' },
  '627100': { numero: '627100', libelle: 'Frais bancaires', sens: 'debit' },
  '628100': { numero: '628100', libelle: 'Cotisations professionnelles', sens: 'debit' },

  // Impôts et taxes
  '635100': { numero: '635100', libelle: 'Taxe foncière', sens: 'debit' },
  '635400': { numero: '635400', libelle: 'Autres droits', sens: 'debit' },

  // Charges de personnel
  '641100': { numero: '641100', libelle: 'Salaires et traitements', sens: 'debit' },
  '645100': { numero: '645100', libelle: 'Charges de sécurité sociale', sens: 'debit' },

  // Dotations
  '681100': { numero: '681100', libelle: 'Dotations aux amortissements', sens: 'debit' },

  // Charges exceptionnelles
  '671000': { numero: '671000', libelle: 'Charges exceptionnelles', sens: 'debit' },

  // IS
  '695000': { numero: '695000', libelle: 'Impôt sur les sociétés', sens: 'debit' },
} as const;

// ============================================================================
// COMPTES DE LA CLASSE 7 - PRODUITS
// ============================================================================

export const COMPTES_PRODUITS = {
  // Ventes de services
  '706000': { numero: '706000', libelle: 'Prestations de services', sens: 'credit' },
  '706100': { numero: '706100', libelle: 'Honoraires de gestion locative', sens: 'credit' },
  '706200': { numero: '706200', libelle: 'Honoraires de mise en location', sens: 'credit' },
  '706300': { numero: '706300', libelle: "Honoraires d'état des lieux", sens: 'credit' },
  '706400': { numero: '706400', libelle: 'Honoraires de syndic', sens: 'credit' },

  // Produits divers
  '708300': { numero: '708300', libelle: 'Locations diverses', sens: 'credit' },
  '758000': { numero: '758000', libelle: 'Produits divers de gestion courante', sens: 'credit' },

  // Produits exceptionnels
  '771000': { numero: '771000', libelle: 'Produits exceptionnels', sens: 'credit' },
} as const;

// ============================================================================
// PLAN COMPTABLE COMPLET
// ============================================================================

export const PLAN_COMPTABLE = {
  ...COMPTES_TIERS,
  ...COMPTES_FINANCIERS,
  ...COMPTES_CHARGES,
  ...COMPTES_PRODUITS,
} as const;

export type NumeroCompte = keyof typeof PLAN_COMPTABLE;

// ============================================================================
// TAUX TVA
// ============================================================================

export const TAUX_TVA = {
  NORMAL: 0.20,        // 20% - Taux normal (métropole)
  INTERMEDIAIRE: 0.10, // 10% - Taux intermédiaire
  REDUIT: 0.055,       // 5.5% - Taux réduit
  SUPER_REDUIT: 0.021, // 2.1% - Taux super réduit
  EXONERE: 0,          // 0% - Exonéré

  // DOM-TOM
  GUADELOUPE: 0.085,   // 8.5%
  MARTINIQUE: 0.085,   // 8.5%
  REUNION: 0.085,      // 8.5%
  GUYANE: 0,           // Exonéré
  MAYOTTE: 0,          // Exonéré
} as const;

// ============================================================================
// TAUX HONORAIRES PAR DÉFAUT
// ============================================================================

export const TAUX_HONORAIRES = {
  GESTION_LOCATIVE: 0.07,        // 7% HT du loyer HC encaissé
  MISE_EN_LOCATION: 1.0,         // 1 mois de loyer HC
  ETAT_DES_LIEUX: 3.0,           // 3€/m² (plafonné par décret)
  RENOUVELLEMENT_BAIL: 0.5,      // 0.5 mois de loyer
} as const;

// ============================================================================
// CATÉGORIES DE CHARGES DÉDUCTIBLES (2044)
// ============================================================================

export const CATEGORIES_CHARGES_DEDUCTIBLES = {
  LIGNE_221: {
    code: '221',
    libelle: "Frais d'administration et de gestion",
    description: 'Honoraires de gestion, frais de procédure',
  },
  LIGNE_222: {
    code: '222',
    libelle: 'Autres frais de gestion',
    description: 'Forfait 20€ par local',
  },
  LIGNE_223: {
    code: '223',
    libelle: "Primes d'assurance",
    description: 'PNO, GLI, etc.',
  },
  LIGNE_224: {
    code: '224',
    libelle: "Dépenses de réparation et d'entretien",
    description: 'Travaux déductibles',
  },
  LIGNE_225: {
    code: '225',
    libelle: 'Charges récupérables non récupérées',
    description: 'Charges non refacturées au départ du locataire',
  },
  LIGNE_226: {
    code: '226',
    libelle: "Indemnités d'éviction et frais de relogement",
    description: 'Indemnités versées',
  },
  LIGNE_227: {
    code: '227',
    libelle: 'Taxes foncières',
    description: 'Hors ordures ménagères',
  },
  LIGNE_229: {
    code: '229',
    libelle: 'Provisions pour charges de copropriété',
    description: "Provisions de l'année",
  },
  LIGNE_230: {
    code: '230',
    libelle: 'Régularisation des provisions N-1',
    description: 'Ajustement provisions année précédente',
  },
} as const;

// ============================================================================
// CHARGES RÉCUPÉRABLES (Décret 87-713)
// ============================================================================

export const CHARGES_RECUPERABLES = {
  ASCENSEUR: { code: 'ASC', libelle: 'Ascenseur', recuperable: true, taux: 1.0 },
  EAU_FROIDE: { code: 'EAU', libelle: 'Eau froide', recuperable: true, taux: 1.0 },
  EAU_CHAUDE: { code: 'ECS', libelle: 'Eau chaude sanitaire', recuperable: true, taux: 1.0 },
  CHAUFFAGE: { code: 'CHF', libelle: 'Chauffage collectif', recuperable: true, taux: 1.0 },
  ENTRETIEN_PARTIES_COMMUNES: { code: 'EPC', libelle: 'Entretien parties communes', recuperable: true, taux: 1.0 },
  ELECTRICITE_COMMUNES: { code: 'ELC', libelle: 'Électricité parties communes', recuperable: true, taux: 1.0 },
  GARDIENNAGE: { code: 'GAR', libelle: 'Gardiennage', recuperable: true, taux: 0.75 }, // 75% récupérable
  ORDURES_MENAGERES: { code: 'OM', libelle: 'Ordures ménagères (TEOM)', recuperable: true, taux: 1.0 },
  ESPACES_VERTS: { code: 'ESV', libelle: 'Espaces verts', recuperable: true, taux: 1.0 },
  INTERPHONE: { code: 'INT', libelle: 'Interphone/Digicode', recuperable: true, taux: 1.0 },
  ANTENNE_TV: { code: 'ANT', libelle: 'Antenne TV collective', recuperable: true, taux: 1.0 },
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Génère un numéro de compte mandant pour un propriétaire
 */
export function generateCompteProprietaire(proprietaireId: string): string {
  const suffix = proprietaireId.substring(0, 5).toUpperCase();
  return `4671${suffix}`;
}

/**
 * Génère un numéro de compte mandant pour un locataire
 */
export function generateCompteLocataire(locataireId: string): string {
  const suffix = locataireId.substring(0, 5).toUpperCase();
  return `4672${suffix}`;
}

/**
 * Détermine le taux de TVA selon le code postal
 */
export function getTauxTVA(codePostal: string): number {
  const prefix = codePostal.substring(0, 3);

  switch (prefix) {
    case '971': return TAUX_TVA.GUADELOUPE;
    case '972': return TAUX_TVA.MARTINIQUE;
    case '973': return TAUX_TVA.GUYANE;
    case '974': return TAUX_TVA.REUNION;
    case '976': return TAUX_TVA.MAYOTTE;
    default: return TAUX_TVA.NORMAL;
  }
}

/**
 * Formate une date au format FEC (AAAAMMJJ)
 */
export function formatDateFEC(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formate un montant pour export comptable
 */
export function formatMontant(montant: number): string {
  return montant.toFixed(2).replace('.', ',');
}
