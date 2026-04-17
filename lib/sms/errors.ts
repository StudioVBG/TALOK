/**
 * Traduction FR des codes d'erreur Twilio (Messages + Verify).
 * Référence : https://www.twilio.com/docs/api/errors
 *
 * Règle : un message est "user-facing" s'il est compréhensible par
 * un utilisateur final non technique. Les erreurs de configuration
 * ou d'auth renvoient un message générique (on ne veut pas fuiter
 * de détails d'infra).
 */

export const TWILIO_ERROR_MESSAGES_FR: Record<number, string> = {
  // ===== Send / Messages =====
  21211: 'Numéro de téléphone invalide.',
  21212: 'Numéro invalide pour ce type d\'envoi.',
  21408: 'Envoi vers ce pays non autorisé.',
  21608: 'Compte SMS en mode test : ce numéro n\'est pas vérifié. Contactez le support.',
  21610: 'Ce destinataire a bloqué les SMS (STOP).',
  21614: 'Ce numéro n\'est pas valide pour les SMS.',
  30003: 'Téléphone du destinataire éteint ou hors zone.',
  30004: 'Message bloqué par l\'opérateur.',
  30005: 'Numéro inconnu (inexistant ou désactivé).',
  30006: 'Accès opérateur bloqué.',
  30007: 'Message filtré (probablement spam).',
  30008: 'Erreur inconnue côté opérateur.',

  // ===== Verify =====
  60200: 'Numéro invalide pour la vérification.',
  60202: 'Trop d\'envois de code sur ce numéro. Réessayez plus tard.',
  60203: 'Trop de tentatives incorrectes. Redemandez un nouveau code.',
  60212: 'Trop de vérifications sur ce numéro aujourd\'hui.',
  60223: 'Code expiré. Redemandez un nouveau code.',

  // ===== Auth / configuration (NE PAS exposer tel quel) =====
  20003: 'Erreur de configuration SMS. Contactez le support.',
  20404: 'Service Verify introuvable. Contactez le support.',
  20422: 'Paramètres d\'envoi invalides.',
};

/** Codes dont le message peut être remonté tel quel à l'utilisateur. */
const SAFE_USER_FACING_CODES = new Set<number>([
  21211, 21212, 21408, 21610, 21614,
  30003, 30004, 30005, 30006, 30007,
  60200, 60202, 60203, 60212, 60223,
]);

export interface TranslatedTwilioError {
  /** Message FR pour l'utilisateur ou message générique. */
  message: string;
  /** true si le message peut être exposé côté client sans filtre. */
  userFacing: boolean;
  /** Code Twilio d'origine (utile pour les tags Sentry). */
  code: number | null;
}

/**
 * Traduit un code Twilio en message FR sûr à afficher.
 * - Code connu + user-facing → message dédié
 * - Code connu + infra → message générique (pas d'exposition)
 * - Code inconnu → message générique
 */
export function translateTwilioError(code: number | string | null | undefined): TranslatedTwilioError {
  const numeric = typeof code === 'string' ? Number.parseInt(code, 10) : code ?? null;
  if (numeric != null && Number.isFinite(numeric)) {
    const mapped = TWILIO_ERROR_MESSAGES_FR[numeric];
    if (mapped && SAFE_USER_FACING_CODES.has(numeric)) {
      return { message: mapped, userFacing: true, code: numeric };
    }
    if (mapped) {
      return { message: mapped, userFacing: false, code: numeric };
    }
    return {
      message: 'Échec d\'envoi du SMS. Réessayez dans quelques instants.',
      userFacing: false,
      code: numeric,
    };
  }
  return {
    message: 'Échec d\'envoi du SMS. Réessayez dans quelques instants.',
    userFacing: false,
    code: null,
  };
}
