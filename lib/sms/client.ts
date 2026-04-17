/**
 * Client Twilio singleton + accès au Verify Service SID.
 *
 * Récupère les credentials depuis la DB (Admin > Intégrations) avec
 * fallback sur les variables d'environnement via credentials-service.
 */

import twilio from 'twilio';
import type { Twilio } from 'twilio';
import { getTwilioCredentials } from '@/lib/services/credentials-service';

let cachedClient: Twilio | null = null;
let cachedSid: string | null = null;

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  phoneNumber: string | null;
  messagingServiceSid: string | null;
}

/**
 * Résout les credentials Twilio (DB → env).
 * Throw explicitement si incomplets.
 */
export async function resolveTwilioCredentials(): Promise<TwilioCredentials> {
  const creds = await getTwilioCredentials();
  const accountSid = creds?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = creds?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = creds?.phoneNumber || process.env.TWILIO_PHONE_NUMBER || null;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || null;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials missing (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }

  return { accountSid, authToken, phoneNumber, messagingServiceSid };
}

/**
 * Retourne un client Twilio singleton lié au compte courant.
 * Le cache est invalidé automatiquement si le SID change (rotation).
 */
export async function getTwilioClient(): Promise<Twilio> {
  const creds = await resolveTwilioCredentials();
  if (cachedClient && cachedSid === creds.accountSid) {
    return cachedClient;
  }
  cachedClient = twilio(creds.accountSid, creds.authToken);
  cachedSid = creds.accountSid;
  return cachedClient;
}

/**
 * Invalide le client en cache (à appeler après rotation des credentials).
 */
export function invalidateTwilioClient(): void {
  cachedClient = null;
  cachedSid = null;
}

/**
 * Récupère le SID du service Twilio Verify dédié aux OTP.
 */
export function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) {
    throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
  }
  return sid;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ||
    // Credentials DB : on ne peut pas vérifier synchrone, on laisse l'appelant tenter
    false
  );
}
