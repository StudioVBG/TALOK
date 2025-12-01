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

export default {
  calculateNotaryFees,
  calculateLoanPayment,
  simulateLoan,
  calculateTax,
  calculateRentalYield,
  calculateBorrowingCapacity,
  compareScenarios,
  suggestRent,
};

