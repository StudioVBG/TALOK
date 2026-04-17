export const runtime = 'nodejs';

/**
 * POST /api/notifications/sms/send
 * Envoi d'un SMS transactionnel (admin ou owner).
 * Délègue toute la logique à lib/sms (Twilio SDK + tracking + DROM).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createRouteHandlerClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  withFeatureAccess,
  createSubscriptionErrorResponse,
} from '@/lib/middleware/subscription-check';
import { sendSMS } from '@/lib/sms';
import { renderTemplate, type SmsTemplateKey } from '@/lib/sms/templates';

const sendSmsSchema = z.object({
  profile_id: z.string().uuid().optional(),
  phone_number: z.string().optional(),
  message: z.string().min(1).max(1600).optional(),
  template: z
    .enum(['payment_reminder', 'payment_late', 'ticket_urgent', 'edl_reminder', 'lease_expiring', 'custom'])
    .optional(),
  template_data: z.record(z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (profile.role === 'owner') {
      const featureCheck = await withFeatureAccess(profile.id, 'auto_reminders_sms');
      if (!featureCheck.allowed) {
        return createSubscriptionErrorResponse(featureCheck);
      }
    }

    const parsed = sendSmsSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const data = parsed.data;

    if (!data.profile_id && !data.phone_number) {
      return NextResponse.json(
        { error: 'profile_id ou phone_number requis' },
        { status: 400 }
      );
    }

    const serviceClient = createServiceRoleClient();
    let phoneNumber = data.phone_number;
    let targetProfileId = data.profile_id;

    if (data.profile_id && !phoneNumber) {
      const { data: targetProfile } = await serviceClient
        .from('profiles')
        .select('id, telephone')
        .eq('id', data.profile_id)
        .single();

      if (!targetProfile?.telephone) {
        return NextResponse.json(
          { error: 'Numéro de téléphone non trouvé pour ce profil' },
          { status: 400 }
        );
      }

      phoneNumber = targetProfile.telephone;
      targetProfileId = targetProfile.id;
    }

    if (targetProfileId) {
      const { data: prefs } = await serviceClient
        .from('notification_preferences')
        .select('sms_enabled')
        .eq('profile_id', targetProfileId)
        .maybeSingle();

      if (prefs && !prefs.sms_enabled) {
        return NextResponse.json({
          success: false,
          reason: "SMS désactivé par l'utilisateur",
        });
      }
    }

    let body: string;
    if (data.template && data.template !== 'custom') {
      body = renderTemplate(data.template as SmsTemplateKey, data.template_data ?? {});
    } else if (data.message) {
      body = data.message;
    } else {
      return NextResponse.json(
        { error: 'message requis pour template=custom ou absent' },
        { status: 400 }
      );
    }

    const result = await sendSMS({
      to: phoneNumber!,
      body,
      context: {
        type: 'notification',
        profileId: targetProfileId,
        userId: user.id,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          error_code: result.errorCode,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      twilio_sid: result.sid,
      status: result.status,
    });
  } catch (error: unknown) {
    console.error('Erreur envoi SMS:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
