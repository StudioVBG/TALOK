export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/twilio
 * Status callback Twilio (livraison / échec SMS).
 * Signature validée fail-closed via twilio.validateRequest().
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { validateTwilioWebhook, formDataToObject } from '@/lib/sms/webhook';
import { trackSmsEvent } from '@/lib/sms/monitoring';

export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = request.headers.get('x-twilio-signature');
    const rawBody = await request.text();

    const params = formDataToObject(rawBody);
    const url = request.url;

    const valid = validateTwilioWebhook({ url, params, signature, authToken });
    if (!valid) {
      trackSmsEvent('webhook_invalid_signature', {
        errorCode: signature ? 'invalid_signature' : 'missing_signature',
      });
      return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;
    const errorCode = params.ErrorCode || null;
    const errorMessage = params.ErrorMessage || null;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const statusMap: Record<string, string> = {
      queued: 'queued',
      accepted: 'queued',
      sending: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'undelivered',
      failed: 'failed',
    };
    const mappedStatus = statusMap[messageStatus] ?? messageStatus;

    const updateData: Record<string, unknown> = {
      twilio_status: messageStatus,
      status: mappedStatus,
    };
    if (messageStatus === 'delivered') updateData.delivered_at = new Date().toISOString();
    if (messageStatus === 'sent') updateData.sent_at = new Date().toISOString();
    if (errorCode) {
      updateData.error_code = errorCode;
      updateData.error_message = errorMessage;
    }

    const { error: updateError } = await supabase
      .from('sms_messages')
      .update(updateData)
      .eq('twilio_sid', messageSid);

    if (updateError) {
      console.error('[twilio-webhook] update failed:', updateError);
    }

    // Désactiver les SMS pour ce profil sur erreur permanente (numéro mort / bloqué).
    if (messageStatus === 'undelivered' || messageStatus === 'failed') {
      console.error(
        `[twilio-webhook] SMS non livré — sid=${messageSid} code=${errorCode} msg=${errorMessage}`
      );

      const permanentErrors = new Set(['30003', '30004', '30005', '30006', '21211', '21610', '21614']);
      if (errorCode && permanentErrors.has(errorCode)) {
        const { data: smsRecord } = await supabase
          .from('sms_messages')
          .select('profile_id')
          .eq('twilio_sid', messageSid)
          .single();

        if (smsRecord?.profile_id) {
          await supabase
            .from('notification_preferences')
            .update({ sms_enabled: false })
            .eq('profile_id', smsRecord.profile_id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error('[twilio-webhook] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
