/**
 * lib/billing/tva.ts — Taux de TVA par territoire français
 *
 * Source unique de verite pour les taux de TVA applicables
 * aux abonnements SaaS selon le territoire.
 *
 * References :
 *  - Art. 278 CGI (metropole 20%)
 *  - Art. 296 CGI (Martinique/Guadeloupe/Reunion 8,5%)
 *  - Art. 296 ter CGI (Guyane 0% services electroniques — assimile 2,1% pour SaaS)
 *  - Mayotte : pas de TVA (0%)
 */

export const TVA_RATES = {
  metropole: 0.20,
  martinique: 0.085,
  guadeloupe: 0.085,
  reunion: 0.085,
  guyane: 0.021,
  mayotte: 0.0,
} as const;

export type Territory = keyof typeof TVA_RATES;

export const TERRITORY_LABELS: Record<Territory, string> = {
  metropole: 'France metropolitaine',
  martinique: 'Martinique',
  guadeloupe: 'Guadeloupe',
  reunion: 'La Reunion',
  guyane: 'Guyane',
  mayotte: 'Mayotte',
};

/**
 * Calcule le prix TTC en centimes a partir du prix HT en centimes.
 */
export function calculateTTC(priceHT: number, territory: Territory): number {
  return Math.round(priceHT * (1 + TVA_RATES[territory]));
}

/**
 * Calcule le montant de TVA en centimes.
 */
export function calculateTVAAmount(priceHT: number, territory: Territory): number {
  return Math.round(priceHT * TVA_RATES[territory]);
}

/**
 * Formate un taux de TVA pour affichage (ex: "20 %", "8,5 %", "0 %").
 */
export function formatTVARate(territory: Territory): string {
  const rate = TVA_RATES[territory] * 100;
  // Formater sans decimales inutiles (20%, 8,5%, 2,1%, 0%)
  const formatted = rate % 1 === 0
    ? rate.toFixed(0)
    : rate.toFixed(1).replace('.', ',');
  return `${formatted}\u00A0%`;
}
