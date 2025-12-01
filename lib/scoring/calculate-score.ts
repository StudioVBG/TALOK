/**
 * Algorithme de calcul du score de solvabilité
 * 
 * Sources et références:
 * - ANIL: Taux d'effort maximum recommandé = 33% (https://www.anil.org)
 * - Banque de France: Critères d'éligibilité GLI
 * - INSEE: Statistiques emploi et revenus France 2024
 * - Loi ALUR: Encadrement des justificatifs demandés
 */

import {
  TenantScoreInput,
  SolvabilityScore,
  ScoreFactor,
  RiskItem,
  RiskLevel,
  Recommendation,
  ScoringConfig,
  DEFAULT_SCORING_CONFIG,
  EMPLOYMENT_STABILITY_SCORES,
  SENIORITY_BONUSES,
} from './types';

// ============================================
// FONCTION PRINCIPALE
// ============================================

export function calculateSolvabilityScore(
  input: TenantScoreInput,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): SolvabilityScore {
  
  // 1. Calculer les métriques de base
  const totalRent = input.rentAmount + input.chargesAmount;
  const totalIncome = input.monthlyIncome + (input.secondaryIncome || 0);
  const effortRate = (totalRent / totalIncome) * 100;
  const requiredIncomeRatio = totalIncome / totalRent;
  
  // 2. Vérifier éligibilité GLI (revenus >= 3x loyer, CDI/retraite)
  const isGLIEligible = 
    requiredIncomeRatio >= 3 &&
    ['cdi', 'retraite'].includes(input.employmentType);
  
  // 3. Calculer chaque facteur
  const factors = {
    effortRate: calculateEffortRateFactor(effortRate, config),
    employmentStability: calculateEmploymentFactor(input, config),
    incomeLevel: calculateIncomeFactor(input, totalRent, config),
    documentCompleteness: calculateDocumentFactor(input),
    guarantorStrength: calculateGuarantorFactor(input, totalRent),
    rentalHistory: calculateHistoryFactor(input),
  };
  
  // 4. Calculer le score total pondéré
  let totalScore = Object.values(factors).reduce(
    (sum, factor) => sum + factor.weightedScore,
    0
  );
  
  // 5. Appliquer les modificateurs
  if (isGLIEligible) {
    totalScore += config.modifiers.gliEligibleBonus;
  }
  if (input.guarantorType === 'visale') {
    totalScore += config.modifiers.visaleBonus;
  }
  if (input.hasUnpaidRentHistory) {
    totalScore += config.modifiers.unpaidHistoryPenalty;
  }
  
  // Borner entre 0 et 100
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  
  // 6. Déterminer la recommandation
  const recommendation = getRecommendation(totalScore, config);
  const riskLevel = getRiskLevel(totalScore);
  
  // 7. Identifier les risques
  const risks = identifyRisks(input, effortRate, factors);
  
  // 8. Identifier les points forts
  const strengths = identifyStrengths(input, factors, isGLIEligible);
  
  // 9. Générer les recommandations
  const recommendations = generateRecommendations(input, factors, risks);
  
  return {
    totalScore,
    recommendation,
    riskLevel,
    factors,
    metrics: {
      effortRate: Math.round(effortRate * 10) / 10,
      totalMonthlyRent: totalRent,
      requiredIncomeRatio: Math.round(requiredIncomeRatio * 10) / 10,
      isGLIEligible,
    },
    risks,
    strengths,
    recommendations,
    calculatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

// ============================================
// CALCUL DES FACTEURS INDIVIDUELS
// ============================================

function calculateEffortRateFactor(
  effortRate: number,
  config: ScoringConfig
): ScoreFactor {
  const { effortRateThresholds } = config;
  
  let score: number;
  let status: 'pass' | 'warning' | 'fail';
  let description: string;
  
  if (effortRate <= effortRateThresholds.excellent) {
    score = 100;
    status = 'pass';
    description = `Excellent: ${effortRate.toFixed(1)}% (recommandé < 25%)`;
  } else if (effortRate <= effortRateThresholds.good) {
    score = 85;
    status = 'pass';
    description = `Bon: ${effortRate.toFixed(1)}% (recommandé < 30%)`;
  } else if (effortRate <= effortRateThresholds.acceptable) {
    score = 70;
    status = 'pass';
    description = `Acceptable: ${effortRate.toFixed(1)}% (limite ANIL 33%)`;
  } else if (effortRate <= effortRateThresholds.risky) {
    score = 40;
    status = 'warning';
    description = `Élevé: ${effortRate.toFixed(1)}% (dépasse la limite ANIL)`;
  } else {
    score = 15;
    status = 'fail';
    description = `Critique: ${effortRate.toFixed(1)}% (risque très élevé)`;
  }
  
  const weight = config.factorWeights.effortRate;
  
  return {
    name: 'Taux d\'effort',
    score,
    weight,
    weightedScore: score * weight,
    description,
    status,
  };
}

function calculateEmploymentFactor(
  input: TenantScoreInput,
  config: ScoringConfig
): ScoreFactor {
  // Score de base selon le type d'emploi
  let score = EMPLOYMENT_STABILITY_SCORES[input.employmentType];
  
  // Bonus d'ancienneté
  if (input.employmentDuration) {
    const months = input.employmentDuration;
    if (months >= 60) score += SENIORITY_BONUSES['60+'];
    else if (months >= 24) score += SENIORITY_BONUSES['24-60'];
    else if (months >= 12) score += SENIORITY_BONUSES['12-24'];
    else if (months >= 6) score += SENIORITY_BONUSES['6-12'];
  }
  
  // Borner à 100
  score = Math.min(100, score);
  
  let status: 'pass' | 'warning' | 'fail';
  let description: string;
  
  if (score >= 80) {
    status = 'pass';
    description = 'Situation professionnelle très stable';
  } else if (score >= 50) {
    status = 'warning';
    description = 'Situation professionnelle à surveiller';
  } else {
    status = 'fail';
    description = 'Situation professionnelle précaire';
  }
  
  const weight = config.factorWeights.employmentStability;
  
  return {
    name: 'Stabilité emploi',
    score,
    weight,
    weightedScore: score * weight,
    description,
    status,
  };
}

function calculateIncomeFactor(
  input: TenantScoreInput,
  totalRent: number,
  config: ScoringConfig
): ScoreFactor {
  const totalIncome = input.monthlyIncome + (input.secondaryIncome || 0);
  const ratio = totalIncome / totalRent;
  
  let score: number;
  let status: 'pass' | 'warning' | 'fail';
  let description: string;
  
  if (ratio >= 4) {
    score = 100;
    status = 'pass';
    description = `Revenus excellents: ${ratio.toFixed(1)}x le loyer`;
  } else if (ratio >= 3) {
    score = 85;
    status = 'pass';
    description = `Revenus solides: ${ratio.toFixed(1)}x le loyer (éligible GLI)`;
  } else if (ratio >= 2.5) {
    score = 60;
    status = 'warning';
    description = `Revenus acceptables: ${ratio.toFixed(1)}x le loyer`;
  } else if (ratio >= 2) {
    score = 35;
    status = 'warning';
    description = `Revenus justes: ${ratio.toFixed(1)}x le loyer`;
  } else {
    score = 10;
    status = 'fail';
    description = `Revenus insuffisants: ${ratio.toFixed(1)}x le loyer`;
  }
  
  const weight = config.factorWeights.incomeLevel;
  
  return {
    name: 'Niveau de revenus',
    score,
    weight,
    weightedScore: score * weight,
    description,
    status,
  };
}

function calculateDocumentFactor(input: TenantScoreInput): ScoreFactor {
  const docs = input.documentsProvided;
  const requiredDocs = ['idCard', 'proofOfIncome', 'taxNotice'];
  const optionalDocs = ['employmentContract', 'previousRentReceipts', 'bankStatements'];
  
  // Vérifier les documents obligatoires
  const requiredCount = requiredDocs.filter(
    doc => docs[doc as keyof typeof docs]
  ).length;
  
  // Vérifier les documents optionnels
  const optionalCount = optionalDocs.filter(
    doc => docs[doc as keyof typeof docs]
  ).length;
  
  // Score: 60% obligatoires, 40% optionnels
  const requiredScore = (requiredCount / requiredDocs.length) * 60;
  const optionalScore = (optionalCount / optionalDocs.length) * 40;
  const score = Math.round(requiredScore + optionalScore);
  
  let status: 'pass' | 'warning' | 'fail';
  let description: string;
  
  if (requiredCount === requiredDocs.length) {
    status = score >= 80 ? 'pass' : 'warning';
    description = `Dossier complet (${requiredCount + optionalCount}/${requiredDocs.length + optionalDocs.length} documents)`;
  } else {
    status = 'fail';
    description = `Dossier incomplet: manque ${requiredDocs.length - requiredCount} document(s) obligatoire(s)`;
  }
  
  return {
    name: 'Complétude dossier',
    score,
    weight: 0.10,
    weightedScore: score * 0.10,
    description,
    status,
  };
}

function calculateGuarantorFactor(
  input: TenantScoreInput,
  totalRent: number
): ScoreFactor {
  if (!input.hasGuarantor) {
    return {
      name: 'Garantie',
      score: 0,
      weight: 0.10,
      weightedScore: 0,
      description: 'Aucun garant fourni',
      status: 'warning',
    };
  }
  
  let score: number;
  let description: string;
  let status: 'pass' | 'warning' | 'fail';
  
  switch (input.guarantorType) {
    case 'visale':
      score = 100;
      status = 'pass';
      description = 'Garantie Visale (État français)';
      break;
    case 'insurance':
      score = 95;
      status = 'pass';
      description = 'Garantie loyers impayés (assurance)';
      break;
    case 'bank':
      score = 90;
      status = 'pass';
      description = 'Caution bancaire';
      break;
    case 'person':
      if (input.guarantorIncome) {
        const guarantorRatio = input.guarantorIncome / totalRent;
        if (guarantorRatio >= 4) {
          score = 85;
          status = 'pass';
          description = `Garant personne physique (${guarantorRatio.toFixed(1)}x le loyer)`;
        } else if (guarantorRatio >= 3) {
          score = 70;
          status = 'pass';
          description = `Garant personne physique (${guarantorRatio.toFixed(1)}x le loyer)`;
        } else {
          score = 40;
          status = 'warning';
          description = `Garant avec revenus insuffisants (${guarantorRatio.toFixed(1)}x le loyer)`;
        }
      } else {
        score = 50;
        status = 'warning';
        description = 'Garant personne physique (revenus non vérifiés)';
      }
      break;
    default:
      score = 30;
      status = 'warning';
      description = 'Type de garantie non spécifié';
  }
  
  return {
    name: 'Garantie',
    score,
    weight: 0.10,
    weightedScore: score * 0.10,
    description,
    status,
  };
}

function calculateHistoryFactor(input: TenantScoreInput): ScoreFactor {
  let score: number;
  let status: 'pass' | 'warning' | 'fail';
  let description: string;
  
  if (input.hasUnpaidRentHistory) {
    score = 10;
    status = 'fail';
    description = 'Historique d\'impayés signalé';
  } else {
    switch (input.previousRentHistory) {
      case 'excellent':
        score = 100;
        status = 'pass';
        description = 'Excellent historique locatif';
        break;
      case 'good':
        score = 85;
        status = 'pass';
        description = 'Bon historique locatif';
        break;
      case 'average':
        score = 60;
        status = 'warning';
        description = 'Historique locatif moyen';
        break;
      case 'poor':
        score = 30;
        status = 'fail';
        description = 'Historique locatif problématique';
        break;
      default:
        // Primo-accédant ou historique inconnu
        score = 50;
        status = 'warning';
        description = 'Historique locatif non renseigné';
    }
  }
  
  return {
    name: 'Historique locatif',
    score,
    weight: 0.10,
    weightedScore: score * 0.10,
    description,
    status,
  };
}

// ============================================
// HELPERS
// ============================================

function getRecommendation(
  score: number,
  config: ScoringConfig
): Recommendation {
  if (score >= config.decisionThresholds.accept) {
    return 'accept';
  } else if (score >= config.decisionThresholds.review) {
    return 'review';
  }
  return 'reject';
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

function identifyRisks(
  input: TenantScoreInput,
  effortRate: number,
  factors: SolvabilityScore['factors']
): RiskItem[] {
  const risks: RiskItem[] = [];
  
  // Taux d'effort élevé
  if (effortRate > 33) {
    risks.push({
      id: 'high_effort_rate',
      severity: effortRate > 40 ? 'high' : 'medium',
      title: 'Taux d\'effort élevé',
      description: `Le taux d'effort de ${effortRate.toFixed(1)}% dépasse la recommandation ANIL de 33%`,
      mitigation: 'Demander un garant solide ou une garantie Visale',
    });
  }
  
  // Emploi précaire
  if (['interim', 'chomage', 'etudiant'].includes(input.employmentType)) {
    risks.push({
      id: 'unstable_employment',
      severity: input.employmentType === 'chomage' ? 'high' : 'medium',
      title: 'Situation professionnelle précaire',
      description: `Statut: ${input.employmentType}`,
      mitigation: 'Exiger un garant solvable ou garantie Visale',
    });
  }
  
  // Dossier incomplet
  if (factors.documentCompleteness.status === 'fail') {
    risks.push({
      id: 'incomplete_docs',
      severity: 'medium',
      title: 'Dossier incomplet',
      description: factors.documentCompleteness.description,
      mitigation: 'Demander les documents manquants avant décision',
    });
  }
  
  // Historique impayés
  if (input.hasUnpaidRentHistory) {
    risks.push({
      id: 'unpaid_history',
      severity: 'critical',
      title: 'Historique d\'impayés',
      description: 'Le candidat a un historique d\'impayés signalé',
      mitigation: 'Refus recommandé sauf garantie très solide',
    });
  }
  
  // Pas de garant avec risques
  if (!input.hasGuarantor && effortRate > 30) {
    risks.push({
      id: 'no_guarantor',
      severity: 'medium',
      title: 'Absence de garant',
      description: 'Aucun garant avec un taux d\'effort supérieur à 30%',
      mitigation: 'Demander un garant ou souscrire une GLI',
    });
  }
  
  return risks;
}

function identifyStrengths(
  input: TenantScoreInput,
  factors: SolvabilityScore['factors'],
  isGLIEligible: boolean
): string[] {
  const strengths: string[] = [];
  
  if (factors.effortRate.score >= 85) {
    strengths.push('Taux d\'effort très favorable');
  }
  
  if (factors.employmentStability.score >= 90) {
    strengths.push('Emploi très stable (CDI ou retraite)');
  }
  
  if (isGLIEligible) {
    strengths.push('Éligible à la Garantie Loyers Impayés');
  }
  
  if (input.guarantorType === 'visale') {
    strengths.push('Couvert par la garantie Visale (État)');
  }
  
  if (factors.documentCompleteness.score >= 90) {
    strengths.push('Dossier très complet');
  }
  
  if (input.previousRentHistory === 'excellent') {
    strengths.push('Excellent historique locatif');
  }
  
  if (input.employmentDuration && input.employmentDuration >= 24) {
    strengths.push(`Ancienneté de ${Math.floor(input.employmentDuration / 12)} ans dans l'entreprise`);
  }
  
  return strengths;
}

function generateRecommendations(
  input: TenantScoreInput,
  factors: SolvabilityScore['factors'],
  risks: RiskItem[]
): string[] {
  const recs: string[] = [];
  
  // Recommandations basées sur les risques
  const hasHighRisk = risks.some(r => r.severity === 'high' || r.severity === 'critical');
  
  if (hasHighRisk) {
    recs.push('Exigez des garanties supplémentaires avant d\'accepter ce dossier');
  }
  
  if (!input.hasGuarantor && factors.effortRate.score < 70) {
    recs.push('Demandez un garant ou proposez la garantie Visale');
  }
  
  if (factors.documentCompleteness.status !== 'pass') {
    recs.push('Demandez les documents manquants pour finaliser l\'évaluation');
  }
  
  if (!input.documentsProvided.previousRentReceipts && input.previousRentHistory === 'unknown') {
    recs.push('Demandez les quittances des anciens loyers pour vérifier l\'historique');
  }
  
  // Recommandation GLI si non éligible
  if (!factors.employmentStability.score || factors.employmentStability.score < 80) {
    recs.push('Envisagez de souscrire une assurance loyers impayés');
  }
  
  // Si tout est bon
  if (risks.length === 0 && Object.values(factors).every(f => f.status === 'pass')) {
    recs.push('Dossier solide, vous pouvez procéder à la signature du bail');
  }
  
  return recs;
}

// ============================================
// EXPORTS
// ============================================

export { DEFAULT_SCORING_CONFIG };
export type { TenantScoreInput, SolvabilityScore };

