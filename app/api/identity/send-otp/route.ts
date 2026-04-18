export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { startVerification, normalizePhoneE164, maskPhone } from '@/lib/sms';
import {
  checkSmsRateLimit,
  extractClientIp,
  rateLimitHeaders,
} from '@/lib/rate-limit';

const schema = z.object({
  phone: z.string().min(1, 'Numéro requis'),
});

/**
 * POST /api/identity/send-otp
 * Déclenche l'envoi d'un OTP via Twilio Verify pour le numéro fourni.
 * L'OTP n'est pas stocké côté Talok — Verify est la source de vérité.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let e164: string;
  try {
    e164 = normalizePhoneE164(parsed.data.phone);
  } catch {
    return NextResponse.json(
      { error: 'Format de numéro invalide. Exemple : +596696123456 ou 0696123456.' },
      { status: 400 }
    );
  }

  const guard = await checkSmsRateLimit({
    userId: user.id,
    destinationE164: e164,
    ip: extractClientIp(req),
  });
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: guard.reason,
        code: 'sms_rate_limited',
        retryAfterSec: guard.retryAfterSec,
      },
      {
        status: 429,
        headers: rateLimitHeaders({
          allowed: false,
          remaining: 0,
          resetAt: guard.resetAt,
          retryAfterSec: guard.retryAfterSec,
        }),
      },
    );
  }

  const serviceClient = createServiceRoleClient();

  const { data: existing } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('telephone', e164)
    .neq('user_id', user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Ce numéro est déjà associé à un autre compte.' },
      { status: 409 }
    );
  }

  await serviceClient
    .from('profiles')
    .update({ telephone: e164, onboarding_step: 'phone_pending' })
    .eq('user_id', user.id);

  const result = await startVerification(e164, 'sms');
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Impossible d'envoyer le code pour l'instant." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    masked_phone: maskPhone(e164),
    status: result.status,
  });
}
