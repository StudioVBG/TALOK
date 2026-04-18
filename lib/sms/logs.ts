/**
 * Persistance unifiée des envois SMS dans la table `sms_messages`.
 *
 * Utilisé par lib/sms/send.ts et le webhook de status callback Twilio.
 */

import { getServiceClient } from '@/lib/supabase/service-client';
import { detectTerritory, maskPhone } from './phone';
import { logger } from '@/lib/monitoring';

export interface SmsContext {
  userId?: string;
  profileId?: string;
  type: 'reminder' | 'notification' | 'custom' | 'otp';
  relatedId?: string;
}

export interface SmsLogRecord {
  sid: string | null;
  verifySid?: string | null;
  to: string;
  body?: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  context: SmsContext;
}

/**
 * Enregistre un envoi SMS (non-OTP). Ne throw jamais — loggue en cas d'échec.
 */
export async function recordSmsMessage(record: SmsLogRecord): Promise<void> {
  try {
    const supabase = getServiceClient();
    const territory = detectTerritory(record.to);

    await (supabase as any).from('sms_messages').insert({
      profile_id: record.context.profileId ?? null,
      from_number: process.env.TWILIO_PHONE_NUMBER || 'Talok',
      to_number: record.to,
      message: record.body ?? '',
      twilio_sid: record.sid,
      twilio_status: record.status,
      status: normalizeStatus(record.status),
      error_code: record.errorCode ?? null,
      error_message: record.errorMessage ?? null,
      territory,
      verify_sid: record.verifySid ?? null,
      segments: record.body ? Math.ceil(record.body.length / 160) : 1,
    });
  } catch (err) {
    logger.error('sms.log.insert_failed', {
      error: err instanceof Error ? err.message : String(err),
      to_masked: maskPhone(record.to),
    });
  }
}

function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    queued: 'queued',
    accepted: 'queued',
    sending: 'queued',
    sent: 'sent',
    delivered: 'delivered',
    undelivered: 'undelivered',
    failed: 'failed',
  };
  return map[raw] ?? raw;
}
