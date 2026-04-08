/**
 * Formate un montant en centimes vers un affichage en euros (format FR)
 */
export function formatCents(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}
