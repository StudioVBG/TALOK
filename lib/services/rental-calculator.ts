/**
 * Calculateur de rentabilité locative
 * 
 * Calcule différents indicateurs de rentabilité pour un bien immobilier :
 * - Rentabilité brute
 * - Rentabilité nette
 * - Cash-flow
 * - TRI (Taux de Rendement Interne)
 * - Capacité d'emprunt
 */

// Types
export interface PropertyFinancials {
  // Prix d'achat
  purchasePrice: number;
  notaryFees?: number; // Frais de notaire (défaut: 8%)
  agencyFees?: number; // Frais d'agence
  renovationCosts?: number; // Travaux
  
  // Revenus
  monthlyRent: number;
  monthlyCharges?: number; // Charges récupérables
  annualVacancyRate?: number; // Taux de vacance en % (défaut: 5%)
  
  // Charges propriétaire
  propertyTax?: number; // Taxe foncière annuelle
  condoFees?: number; // Charges copropriété annuelles
  insurance?: number; // Assurance PNO annuelle
  managementFees?: number; // Frais de gestion en % du loyer
  maintenanceReserve?: number; // Provision travaux en % du loyer
  otherCharges?: number; // Autres charges annuelles
  
  // Financement
  loanAmount?: number;
  loanRate?: number; // Taux annuel en %
  loanDuration?: number; // Durée en années
  
  // Fiscalité
  taxRegime?: "micro_foncier" | "reel" | "lmnp_micro" | "lmnp_reel";
  marginalTaxRate?: number; // Tranche marginale d'imposition en %
}

export interface RentalYieldResult {
  // Investissement total
  totalInvestment: number;
  
  // Revenus
  grossAnnualRent: number;
  effectiveAnnualRent: number; // Après vacance
  
  // Charges
  totalAnnualCharges: number;
  chargesBreakdown: {
    propertyTax: number;
    condoFees: number;
    insurance: number;
    managementFees: number;
    maintenanceReserve: number;
    otherCharges: number;
  };
  
  // Rentabilités
  grossYield: number; // Rendement brut en %
  netYield: number; // Rendement net avant impôts en %
  netNetYield: number; // Rendement net net (après impôts) en %
  
  // Cash-flow
  monthlyCashFlow: number;
  annualCashFlow: number;
  monthlyLoanPayment?: number;
  
  // Indicateurs avancés
  pricePerSqm?: number;
  rentPerSqm?: number;
  yearsToPayoff: number;
  
  // Fiscalité estimée
  estimatedAnnualTax: number;
  taxableIncome: number;
}

export interface LoanSimulation {
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
  amortizationSchedule: Array<{
    month: number;
    payment: number;
    principal: number;
    interest: number;
    remainingBalance: number;
  }>;
}

/**
 * Calcule les frais de notaire estimés
 */
export function calculateNotaryFees(purchasePrice: number, isNew: boolean = false): number {
  // Ancien: ~8%, Neuf: ~3%
  const rate = isNew ? 0.03 : 0.08;
  return Math.round(purchasePrice * rate);
}

/**
 * Calcule la mensualité d'un prêt
 */
export function calculateLoanPayment(
  principal: number,
  annualRate: number,
  durationYears: number
): number {
  if (annualRate === 0) return principal / (durationYears * 12);
  
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = durationYears * 12;
  
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  return Math.round(payment * 100) / 100;
}

/**
 * Simule un prêt avec tableau d'amortissement
 */
export function simulateLoan(
  principal: number,
  annualRate: number,
  durationYears: number
): LoanSimulation {
  const monthlyPayment = calculateLoanPayment(principal, annualRate, durationYears);
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = durationYears * 12;
  
  let remainingBalance = principal;
  let totalInterest = 0;
  const schedule: LoanSimulation["amortizationSchedule"] = [];
  
  for (let month = 1; month <= numPayments; month++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;
    totalInterest += interestPayment;
    
    // Ne garder que les 12 premiers mois et le dernier pour économiser la mémoire
    if (month <= 12 || month === numPayments) {
      schedule.push({
        month,
        payment: Math.round(monthlyPayment * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interestPayment * 100) / 100,
        remainingBalance: Math.max(0, Math.round(remainingBalance * 100) / 100),
      });
    }
  }
  
  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: Math.round((principal + totalInterest) * 100) / 100,
    amortizationSchedule: schedule,
  };
}

/**
 * Calcule l'impôt estimé selon le régime fiscal
 */
export function calculateTax(
  annualRent: number,
  annualCharges: number,
  loanInterest: number,
  taxRegime: PropertyFinancials["taxRegime"],
  marginalTaxRate: number
): { taxableIncome: number; tax: number } {
  let taxableIncome = 0;
  
  switch (taxRegime) {
    case "micro_foncier":
      // Abattement forfaitaire de 30%
      taxableIncome = annualRent * 0.7;
      break;
      
    case "reel":
      // Déduction des charges réelles
      taxableIncome = Math.max(0, annualRent - annualCharges - loanInterest);
      break;
      
    case "lmnp_micro":
      // Abattement forfaitaire de 50%
      taxableIncome = annualRent * 0.5;
      break;
      
    case "lmnp_reel":
      // Déduction des charges + amortissement (simplifié)
      const depreciation = annualRent * 0.3; // Estimation
      taxableIncome = Math.max(0, annualRent - annualCharges - loanInterest - depreciation);
      break;
      
    default:
      taxableIncome = annualRent - annualCharges;
  }
  
  // Impôt sur le revenu + prélèvements sociaux (17.2%)
  const incomeTax = taxableIncome * (marginalTaxRate / 100);
  const socialCharges = taxableIncome * 0.172;
  
  return {
    taxableIncome: Math.round(taxableIncome),
    tax: Math.round(incomeTax + socialCharges),
  };
}

/**
 * Calcule la rentabilité complète d'un bien
 */
export function calculateRentalYield(financials: PropertyFinancials): RentalYieldResult {
  // Valeurs par défaut
  const {
    purchasePrice,
    notaryFees = calculateNotaryFees(purchasePrice),
    agencyFees = 0,
    renovationCosts = 0,
    monthlyRent,
    monthlyCharges = 0,
    annualVacancyRate = 5,
    propertyTax = 0,
    condoFees = 0,
    insurance = 0,
    managementFees = 0,
    maintenanceReserve = 5,
    otherCharges = 0,
    loanAmount = 0,
    loanRate = 0,
    loanDuration = 20,
    taxRegime = "micro_foncier",
    marginalTaxRate = 30,
  } = financials;
  
  // Investissement total
  const totalInvestment = purchasePrice + notaryFees + agencyFees + renovationCosts;
  
  // Revenus annuels
  const grossAnnualRent = monthlyRent * 12;
  const effectiveAnnualRent = grossAnnualRent * (1 - annualVacancyRate / 100);
  
  // Charges annuelles
  const managementFeesAmount = (grossAnnualRent * managementFees) / 100;
  const maintenanceAmount = (grossAnnualRent * maintenanceReserve) / 100;
  
  const chargesBreakdown = {
    propertyTax,
    condoFees,
    insurance,
    managementFees: managementFeesAmount,
    maintenanceReserve: maintenanceAmount,
    otherCharges,
  };
  
  const totalAnnualCharges = Object.values(chargesBreakdown).reduce((sum, v) => sum + v, 0);
  
  // Calcul du prêt
  let monthlyLoanPayment = 0;
  let annualLoanInterest = 0;
  
  if (loanAmount > 0 && loanRate > 0) {
    const loanSim = simulateLoan(loanAmount, loanRate, loanDuration);
    monthlyLoanPayment = loanSim.monthlyPayment;
    annualLoanInterest = loanSim.totalInterest / loanDuration;
  }
  
  // Rentabilités
  const grossYield = (grossAnnualRent / totalInvestment) * 100;
  const netYield = ((effectiveAnnualRent - totalAnnualCharges) / totalInvestment) * 100;
  
  // Fiscalité
  const { taxableIncome, tax } = calculateTax(
    effectiveAnnualRent,
    totalAnnualCharges,
    annualLoanInterest,
    taxRegime,
    marginalTaxRate
  );
  
  const netNetYield =
    ((effectiveAnnualRent - totalAnnualCharges - tax) / totalInvestment) * 100;
  
  // Cash-flow
  const annualCashFlow =
    effectiveAnnualRent - totalAnnualCharges - tax - monthlyLoanPayment * 12;
  const monthlyCashFlow = annualCashFlow / 12;
  
  // Années pour rembourser
  const yearsToPayoff =
    netYield > 0 ? totalInvestment / (effectiveAnnualRent - totalAnnualCharges) : Infinity;
  
  return {
    totalInvestment: Math.round(totalInvestment),
    grossAnnualRent: Math.round(grossAnnualRent),
    effectiveAnnualRent: Math.round(effectiveAnnualRent),
    totalAnnualCharges: Math.round(totalAnnualCharges),
    chargesBreakdown: {
      propertyTax: Math.round(propertyTax),
      condoFees: Math.round(condoFees),
      insurance: Math.round(insurance),
      managementFees: Math.round(managementFeesAmount),
      maintenanceReserve: Math.round(maintenanceAmount),
      otherCharges: Math.round(otherCharges),
    },
    grossYield: Math.round(grossYield * 100) / 100,
    netYield: Math.round(netYield * 100) / 100,
    netNetYield: Math.round(netNetYield * 100) / 100,
    monthlyCashFlow: Math.round(monthlyCashFlow),
    annualCashFlow: Math.round(annualCashFlow),
    monthlyLoanPayment: monthlyLoanPayment > 0 ? Math.round(monthlyLoanPayment) : undefined,
    yearsToPayoff: Math.round(yearsToPayoff * 10) / 10,
    estimatedAnnualTax: tax,
    taxableIncome,
  };
}

/**
 * Calcule la capacité d'emprunt
 */
export function calculateBorrowingCapacity(
  monthlyIncome: number,
  existingLoans: number = 0,
  loanRate: number = 4,
  loanDuration: number = 20,
  maxDebtRatio: number = 35
): {
  maxLoanAmount: number;
  maxMonthlyPayment: number;
  debtRatio: number;
} {
  // Capacité de remboursement max (35% des revenus)
  const maxMonthlyPayment = (monthlyIncome * maxDebtRatio) / 100 - existingLoans;
  
  // Calcul inverse pour trouver le capital empruntable
  const monthlyRate = loanRate / 100 / 12;
  const numPayments = loanDuration * 12;
  
  let maxLoanAmount: number;
  if (monthlyRate === 0) {
    maxLoanAmount = maxMonthlyPayment * numPayments;
  } else {
    maxLoanAmount =
      (maxMonthlyPayment * (Math.pow(1 + monthlyRate, numPayments) - 1)) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
  }
  
  const debtRatio = ((existingLoans + maxMonthlyPayment) / monthlyIncome) * 100;
  
  return {
    maxLoanAmount: Math.round(maxLoanAmount),
    maxMonthlyPayment: Math.round(maxMonthlyPayment),
    debtRatio: Math.round(debtRatio * 100) / 100,
  };
}

/**
 * Compare plusieurs scénarios d'investissement
 */
export function compareScenarios(
  scenarios: Array<{ name: string; financials: PropertyFinancials }>
): Array<{ name: string; result: RentalYieldResult }> {
  return scenarios.map((scenario) => ({
    name: scenario.name,
    result: calculateRentalYield(scenario.financials),
  }));
}

/**
 * Recommandation de loyer basée sur le marché
 */
export function suggestRent(
  purchasePrice: number,
  targetYield: number = 5,
  estimatedCharges: number = 0
): {
  suggestedMonthlyRent: number;
  minRent: number;
  maxRent: number;
} {
  // Loyer pour atteindre le rendement cible
  const suggestedAnnualRent = (purchasePrice * targetYield) / 100 + estimatedCharges;
  const suggestedMonthlyRent = suggestedAnnualRent / 12;
  
  return {
    suggestedMonthlyRent: Math.round(suggestedMonthlyRent),
    minRent: Math.round(suggestedMonthlyRent * 0.85), // -15%
    maxRent: Math.round(suggestedMonthlyRent * 1.15), // +15%
  };
}

// ============================================
// BIC COMPLIANCE: Amortissement bien + mobilier
// ============================================

export interface DepreciationScheduleItem {
  year: number;
  startValue: number;
  annualDepreciation: number;
  cumulativeDepreciation: number;
  remainingValue: number;
}

export interface DepreciationResult {
  annualDepreciation: number;
  totalDepreciation: number;
  duration: number;
  schedule: DepreciationScheduleItem[];
}

export interface BICAmortizationInput {
  // Bien immobilier
  propertyValue: number; // Valeur du bien (hors terrain)
  landPercentage?: number; // Part du terrain en % (défaut: 15%, non amortissable)
  propertyDepreciationYears?: number; // Durée amortissement (défaut: 25 ans)

  // Mobilier
  furnitureValue: number; // Valeur totale du mobilier
  furnitureDepreciationYears?: number; // Durée amortissement (défaut: 7 ans)

  // Travaux d'amélioration
  improvementValue?: number; // Valeur des travaux
  improvementDepreciationYears?: number; // Durée (défaut: 10 ans)

  // Frais d'acquisition
  acquisitionFees?: number; // Frais de notaire, agence
  acquisitionDepreciationYears?: number; // Durée (défaut: 25 ans, ou déduit en 1 an)
  deductAcquisitionImmediately?: boolean; // Déduire immédiatement ou amortir
}

export interface BICAmortizationResult {
  property: DepreciationResult;
  furniture: DepreciationResult;
  improvement: DepreciationResult | null;
  acquisitionFees: DepreciationResult | null;
  totalAnnualDepreciation: number;
  totalDepreciableBase: number;
  landExcluded: number;
}

/**
 * Calcule un tableau d'amortissement linéaire
 */
function calculateLinearDepreciation(
  value: number,
  durationYears: number
): DepreciationResult {
  if (value <= 0 || durationYears <= 0) {
    return {
      annualDepreciation: 0,
      totalDepreciation: 0,
      duration: 0,
      schedule: [],
    };
  }

  const annualDepreciation = Math.round((value / durationYears) * 100) / 100;
  const schedule: DepreciationScheduleItem[] = [];
  let remaining = value;

  for (let year = 1; year <= durationYears; year++) {
    const depreciation = year === durationYears
      ? remaining // Dernière année : prendre le reste
      : annualDepreciation;
    const cumulative = value - remaining + depreciation;
    remaining = Math.max(0, remaining - depreciation);

    schedule.push({
      year,
      startValue: remaining + depreciation,
      annualDepreciation: Math.round(depreciation * 100) / 100,
      cumulativeDepreciation: Math.round(cumulative * 100) / 100,
      remainingValue: Math.round(remaining * 100) / 100,
    });
  }

  return {
    annualDepreciation: Math.round(annualDepreciation),
    totalDepreciation: Math.round(value),
    duration: durationYears,
    schedule,
  };
}

/**
 * Calcule l'amortissement BIC complet (bien + mobilier + travaux)
 * Conforme aux règles LMNP/LMP
 */
export function calculateBICAmortization(
  input: BICAmortizationInput
): BICAmortizationResult {
  const {
    propertyValue,
    landPercentage = 15,
    propertyDepreciationYears = 25,
    furnitureValue,
    furnitureDepreciationYears = 7,
    improvementValue = 0,
    improvementDepreciationYears = 10,
    acquisitionFees = 0,
    acquisitionDepreciationYears = 25,
    deductAcquisitionImmediately = false,
  } = input;

  // Exclure le terrain (non amortissable)
  const landExcluded = Math.round(propertyValue * (landPercentage / 100));
  const depreciablePropertyValue = propertyValue - landExcluded;

  // Calculer chaque composante
  const property = calculateLinearDepreciation(
    depreciablePropertyValue,
    propertyDepreciationYears
  );
  const furniture = calculateLinearDepreciation(
    furnitureValue,
    furnitureDepreciationYears
  );
  const improvement = improvementValue > 0
    ? calculateLinearDepreciation(improvementValue, improvementDepreciationYears)
    : null;
  const acqFees = acquisitionFees > 0
    ? calculateLinearDepreciation(
        acquisitionFees,
        deductAcquisitionImmediately ? 1 : acquisitionDepreciationYears
      )
    : null;

  // Total annuel
  const totalAnnualDepreciation =
    property.annualDepreciation +
    furniture.annualDepreciation +
    (improvement?.annualDepreciation || 0) +
    (acqFees?.annualDepreciation || 0);

  const totalDepreciableBase =
    depreciablePropertyValue +
    furnitureValue +
    improvementValue +
    acquisitionFees;

  return {
    property,
    furniture,
    improvement,
    acquisitionFees: acqFees,
    totalAnnualDepreciation: Math.round(totalAnnualDepreciation),
    totalDepreciableBase: Math.round(totalDepreciableBase),
    landExcluded: Math.round(landExcluded),
  };
}

/**
 * Calcule le résultat fiscal BIC (réel simplifié)
 */
export function calculateBICTaxResult(input: {
  annualRent: number;
  annualCharges: number;
  amortization: BICAmortizationResult;
  loanInterest: number;
  marginalTaxRate: number;
  isLMP: boolean;
}): {
  taxableIncome: number;
  incomeTax: number;
  socialCharges: number;
  totalTax: number;
  deficit: number;
  isDeficit: boolean;
} {
  const { annualRent, annualCharges, amortization, loanInterest, marginalTaxRate, isLMP } = input;

  // Résultat avant amortissement
  const resultBeforeAmort = annualRent - annualCharges - loanInterest;

  // Résultat après amortissement (ne peut pas créer de déficit via amortissement)
  // L'amortissement ne peut pas rendre le résultat négatif
  const maxAmort = Math.max(0, resultBeforeAmort);
  const usedAmort = Math.min(amortization.totalAnnualDepreciation, maxAmort);
  const taxableIncome = Math.max(0, resultBeforeAmort - usedAmort);

  // Déficit (sans amortissement, report possible)
  const deficit = resultBeforeAmort < 0 ? Math.abs(resultBeforeAmort) : 0;
  const isDeficit = deficit > 0;

  // Impôts
  const incomeTax = Math.round(taxableIncome * (marginalTaxRate / 100));

  // Prélèvements sociaux : 17.2% (LMNP) ou SSI (LMP ~22-45%)
  const socialRate = isLMP ? 0.30 : 0.172; // Estimation SSI pour LMP
  const socialCharges = Math.round(taxableIncome * socialRate);

  const totalTax = incomeTax + socialCharges;

  return {
    taxableIncome: Math.round(taxableIncome),
    incomeTax,
    socialCharges,
    totalTax,
    deficit: Math.round(deficit),
    isDeficit,
  };
}

/**
 * Détermine le statut LMNP vs LMP
 */
export function determineLMNPStatus(input: {
  furnishedRentalIncome: number;
  otherProfessionalIncome: number;
}): {
  status: "lmnp" | "lmp";
  reason: string;
  incomeThresholdMet: boolean;
  majorityThresholdMet: boolean;
} {
  const { furnishedRentalIncome, otherProfessionalIncome } = input;
  const totalIncome = furnishedRentalIncome + otherProfessionalIncome;

  const incomeThresholdMet = furnishedRentalIncome > 23000;
  const majorityThresholdMet = totalIncome > 0
    ? furnishedRentalIncome > totalIncome / 2
    : false;

  // LMP si les DEUX conditions sont réunies
  const isLMP = incomeThresholdMet && majorityThresholdMet;

  let reason: string;
  if (isLMP) {
    reason = `LMP : recettes meublées (${furnishedRentalIncome.toLocaleString("fr-FR")} €) > 23 000 € ET > 50% des revenus professionnels`;
  } else if (incomeThresholdMet && !majorityThresholdMet) {
    reason = `LMNP : recettes > 23 000 € mais < 50% des revenus professionnels`;
  } else {
    reason = `LMNP : recettes meublées < 23 000 €/an`;
  }

  return {
    status: isLMP ? "lmp" : "lmnp",
    reason,
    incomeThresholdMet,
    majorityThresholdMet,
  };
}

export default {
  calculateNotaryFees,
  calculateLoanPayment,
  simulateLoan,
  calculateTax,
  calculateRentalYield,
  calculateBorrowingCapacity,
  compareScenarios,
  suggestRent,
  calculateBICAmortization,
  calculateBICTaxResult,
  determineLMNPStatus,
};

