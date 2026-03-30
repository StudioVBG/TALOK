/**
 * Dictionnaire de traduction des codes d'erreur Stripe en français.
 * Couvre les 25 codes les plus fréquents pour les paiements locatifs.
 *
 * @see https://stripe.com/docs/error-codes
 */

const STRIPE_ERRORS_FR: Record<string, string> = {
  card_declined: "Votre carte a été refusée. Vérifiez vos informations ou essayez une autre carte.",
  insufficient_funds: "Fonds insuffisants sur votre carte bancaire.",
  expired_card: "Votre carte a expiré. Mettez à jour vos informations de paiement.",
  incorrect_cvc: "Le code de sécurité (CVC) est incorrect.",
  incorrect_number: "Le numéro de carte est incorrect.",
  invalid_expiry_month: "Le mois d'expiration est invalide.",
  invalid_expiry_year: "L'année d'expiration est invalide.",
  processing_error: "Erreur lors du traitement. Veuillez réessayer dans quelques instants.",
  authentication_required: "Authentification requise. Veuillez confirmer le paiement.",
  payment_intent_authentication_failure: "L'authentification 3D Secure a échoué. Veuillez réessayer.",
  setup_intent_authentication_failure: "L'authentification du mandat a échoué.",
  amount_too_large: "Le montant dépasse la limite autorisée par votre carte.",
  amount_too_small: "Le montant est trop faible pour être traité.",
  balance_insufficient: "Solde insuffisant sur votre compte.",
  bank_account_declined: "Votre banque a refusé le prélèvement.",
  bank_account_unusable: "Ce compte bancaire ne peut pas être utilisé pour ce paiement.",
  charge_already_refunded: "Ce paiement a déjà été remboursé.",
  country_unsupported: "Les paiements depuis ce pays ne sont pas pris en charge.",
  coupon_expired: "Ce code promotionnel a expiré.",
  debit_not_authorized: "Le prélèvement n'a pas été autorisé par votre banque.",
  email_invalid: "L'adresse email est invalide.",
  instant_payouts_unsupported: "Les virements instantanés ne sont pas disponibles pour ce compte.",
  invalid_charge_amount: "Le montant du paiement est invalide.",
  sepa_unsupported_account: "Ce compte ne supporte pas les prélèvements SEPA.",
  transfer_not_allowed: "Le virement n'est pas autorisé.",
};

/**
 * Traduit un code d'erreur Stripe en message français lisible.
 * Retourne un message générique si le code n'est pas dans le dictionnaire.
 */
export function getStripeFrenchError(
  code: string | undefined | null,
  fallbackMessage?: string
): string {
  if (code && STRIPE_ERRORS_FR[code]) {
    return STRIPE_ERRORS_FR[code];
  }
  return fallbackMessage || "Une erreur est survenue lors du paiement. Veuillez réessayer.";
}
