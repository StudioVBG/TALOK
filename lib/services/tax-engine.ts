/**
 * Tax Engine - SOTA 2026
 * Gère le calcul dynamique de la TVA et des taxes locales (DROM, CRL)
 */

export interface TaxResult {
  baseAmount: number;
  tvaRate: number;
  tvaAmount: number;
  totalAmount: number;
  region: string;
  isDROM: boolean;
}

// Configuration par défaut (Métropole)
const DEFAULT_TVA_RATE = 0.20;

// Mapping des préfixes de codes postaux pour les DROM
const DROM_CONFIG: Record<string, { region: string; rate: number }> = {
  "971": { region: "Guadeloupe", rate: 0.085 },
  "972": { region: "Martinique", rate: 0.085 },
  "973": { region: "Guyane", rate: 0.000 },
  "974": { region: "La Réunion", rate: 0.085 },
  "976": { region: "Mayotte", rate: 0.000 },
};

/**
 * Calcule les taxes pour un loyer ou une charge
 */
export function calculateTaxes(amount: number, zipCode: string): TaxResult {
  const prefix = zipCode.substring(0, 3);
  const drom = DROM_CONFIG[prefix];
  
  const tvaRate = drom ? drom.rate : DEFAULT_TVA_RATE;
  const tvaAmount = amount * tvaRate;
  
  return {
    baseAmount: amount,
    tvaRate,
    tvaAmount,
    totalAmount: amount + tvaAmount,
    region: drom ? drom.region : "France Métropolitaine",
    isDROM: !!drom,
  };
}

/**
 * Formate un montant avec sa TVA pour l'affichage quittance
 */
export function formatTaxBreakdown(result: TaxResult) {
  return {
    label: `${result.region} (TVA ${(result.tvaRate * 100).toFixed(1)}%)`,
    amount: result.tvaAmount,
  };
}

