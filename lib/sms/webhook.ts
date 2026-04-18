/**
 * Validation des webhooks Twilio via le SDK officiel.
 *
 * Fail-closed : rejette si le token est absent ou la signature invalide.
 */

import twilio from 'twilio';

export interface ValidateWebhookOptions {
  /** URL complète telle que Twilio l'a signée (après reverse proxy). */
  url: string;
  /** Paramètres POST en form-urlencoded, déjà parsés. */
  params: Record<string, string>;
  /** Valeur du header X-Twilio-Signature. */
  signature: string | null;
  /** Auth token à utiliser pour la vérification. */
  authToken: string | undefined;
}

/**
 * Valide la signature d'une requête webhook Twilio.
 * Utilise `twilio.validateRequest` (HMAC-SHA1 + timing-safe côté SDK).
 *
 * Fail-closed :
 * - Pas de token → false
 * - Pas de signature → false
 */
export function validateTwilioWebhook(opts: ValidateWebhookOptions): boolean {
  if (!opts.authToken) return false;
  if (!opts.signature) return false;
  try {
    return twilio.validateRequest(opts.authToken, opts.signature, opts.url, opts.params);
  } catch {
    return false;
  }
}

/**
 * Convertit une URLSearchParams en objet clé/valeur plat (premier occurrence).
 */
export function formDataToObject(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (!(key in out)) {
      out[key] = value;
    }
  }
  return out;
}
