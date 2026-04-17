/**
 * Module SMS Talok — point d'entrée unifié.
 *
 * - `sendSMS`                → transactionnel (rappels, notifications)
 * - `startVerification`      → OTP (Twilio Verify)
 * - `checkVerification`      → validation OTP (Twilio Verify)
 * - `normalizePhoneE164`     → normalisation E.164 + DROM-COM
 * - `validateTwilioWebhook`  → vérification signature webhooks
 */

export { sendSMS } from './send';
export type { SendSmsParams, SendSmsResult } from './send';

export { startVerification, checkVerification } from './verify';
export type {
  VerifyChannel,
  StartVerificationResult,
  CheckVerificationResult,
} from './verify';

export {
  normalizePhoneE164,
  detectTerritory,
  maskPhone,
  isNormalizablePhone,
} from './phone';
export type { Territory } from './phone';

export { validateTwilioWebhook, formDataToObject } from './webhook';
export type { ValidateWebhookOptions } from './webhook';

export { recordSmsMessage } from './logs';
export type { SmsContext, SmsLogRecord } from './logs';

export { renderTemplate, SMS_TEMPLATES } from './templates';
export type { SmsTemplateKey, TemplateData } from './templates';

export {
  getTwilioClient,
  getVerifyServiceSid,
  resolveTwilioCredentials,
  invalidateTwilioClient,
} from './client';
