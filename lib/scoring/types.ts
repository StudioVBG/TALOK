/**
 * Types pour le système de scoring de solvabilité
 * 
 * Sources:
 * - ANIL (Agence Nationale pour l'Information sur le Logement): Taux d'effort max 33%
 * - INSEE: Statistiques emploi France
 * - Banque de France: Critères GLI (Garantie Loyers Impayés)
 */

// ============================================
// TYPES DE BASE
// ============================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type Recommendation = 'accept' | 'review' | 'reject';
export type EmploymentType = 'cdi' | 'cdd' | 'interim' | 'freelance' | 'retraite' | 'etudiant' | 'chomage' | 'autre';

// ============================================
// DONNÉES D'ENTRÉE
// ============================================

export interface TenantScoreInput {
  // Identité
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  
  // Revenus
  monthlyIncome: number;          // Revenus nets mensuels
  incomeType: 'salary' | 'pension' | 'benefits' | 'rental' | 'other';
  hasSecondaryIncome?: boolean;
  secondaryIncome?: number;
  
  // Emploi
  employmentType: EmploymentType;
  employmentDuration?: number;     // En mois
  companyName?: string;
  
  // Loyer demandé
  rentAmount: number;              // Loyer HC
  chargesAmount: number;           // Charges
  
  // Documents fournis
  documentsProvided: {
    idCard: boolean;
    proofOfIncome: boolean;        // Bulletins de salaire
    taxNotice: boolean;            // Avis d'imposition
    employmentContract: boolean;
    previousRentReceipts: boolean; // Quittances anciens loyers
    bankStatements?: boolean;
  };
  
  // Garant
  hasGuarantor: boolean;
  guarantorIncome?: number;
  guarantorType?: 'person' | 'visale' | 'insurance' | 'bank';
  
  // Historique
  previousRentHistory?: 'excellent' | 'good' | 'average' | 'poor' | 'unknown';
  hasUnpaidRentHistory?: boolean;
  
  // Extraction OCR (optionnel)
  ocrData?: {
    extractedIncome?: number;
    extractedEmployer?: string;
    extractedTaxIncome?: number;
    confidence?: number;
  };
}

// ============================================
// RÉSULTAT DU SCORING
// ============================================

export interface ScoreFactor {
  name: string;
  score: number;           // 0-100
  weight: number;          // Poids dans le calcul
  weightedScore: number;   // score * weight
  description: string;
  status: 'pass' | 'warning' | 'fail';
}

export interface SolvabilityScore {
  // Score global
  totalScore: number;                    // 0-100
  recommendation: Recommendation;
  riskLevel: RiskLevel;
  
  // Détail des facteurs
  factors: {
    effortRate: ScoreFactor;             // Taux d'effort
    employmentStability: ScoreFactor;    // Stabilité emploi
    incomeLevel: ScoreFactor;            // Niveau de revenus
    documentCompleteness: ScoreFactor;   // Complétude dossier
    guarantorStrength: ScoreFactor;      // Force du garant
    rentalHistory: ScoreFactor;          // Historique locatif
  };
  
  // Métriques clés
  metrics: {
    effortRate: number;                  // Taux d'effort en %
    totalMonthlyRent: number;            // Loyer + charges
    requiredIncomeRatio: number;         // Ratio revenus/loyer
    isGLIEligible: boolean;              // Éligibilité GLI
  };
  
  // Risques identifiés
  risks: RiskItem[];
  
  // Points positifs
  strengths: string[];
  
  // Recommandations
  recommendations: string[];
  
  // Métadonnées
  calculatedAt: string;
  version: string;
}

export interface RiskItem {
  id: string;
  severity: RiskLevel;
  title: string;
  description: string;
  mitigation?: string;
}

// ============================================
// SEUILS ET CONFIGURATION
// ============================================

export interface ScoringConfig {
  // Seuils taux d'effort (Source: ANIL)
  effortRateThresholds: {
    excellent: number;     // < 25%
    good: number;          // < 30%
    acceptable: number;    // < 33%
    risky: number;         // < 40%
    critical: number;      // >= 40%
  };
  
  // Poids des facteurs
  factorWeights: {
    effortRate: number;
    employmentStability: number;
    incomeLevel: number;
    documentCompleteness: number;
    guarantorStrength: number;
    rentalHistory: number;
  };
  
  // Seuils de décision
  decisionThresholds: {
    accept: number;        // Score >= pour acceptation directe
    review: number;        // Score >= pour revue manuelle
    reject: number;        // Score < pour refus
  };
  
  // Bonus/Malus
  modifiers: {
    gliEligibleBonus: number;
    visaleBonus: number;
    unpaidHistoryPenalty: number;
    incompleteDocsPenalty: number;
  };
}

// ============================================
// CONSTANTES PAR DÉFAUT
// ============================================

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  effortRateThresholds: {
    excellent: 25,
    good: 30,
    acceptable: 33,
    risky: 40,
    critical: 50,
  },
  factorWeights: {
    effortRate: 0.30,          // 30% du score
    employmentStability: 0.25, // 25%
    incomeLevel: 0.15,         // 15%
    documentCompleteness: 0.10,// 10%
    guarantorStrength: 0.10,   // 10%
    rentalHistory: 0.10,       // 10%
  },
  decisionThresholds: {
    accept: 75,
    review: 50,
    reject: 50,
  },
  modifiers: {
    gliEligibleBonus: 5,
    visaleBonus: 10,
    unpaidHistoryPenalty: -20,
    incompleteDocsPenalty: -10,
  },
};

// ============================================
// BARÈMES EMPLOI (Source: INSEE 2024)
// ============================================

export const EMPLOYMENT_STABILITY_SCORES: Record<EmploymentType, number> = {
  cdi: 100,
  retraite: 95,
  cdd: 60,
  freelance: 50,
  interim: 40,
  etudiant: 35,
  chomage: 20,
  autre: 30,
};

// Bonus ancienneté (en mois)
export const SENIORITY_BONUSES: Record<string, number> = {
  '0-6': 0,
  '6-12': 5,
  '12-24': 10,
  '24-60': 15,
  '60+': 20,
};

