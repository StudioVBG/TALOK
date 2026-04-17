export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { checkVerification, normalizePhoneE164 } from '@/lib/sms';
import { checkOtpVerifyRateLimit, rateLimitHeaders } from '@/lib/rate-limit';

/**
 * POST /api/identity/verify-otp
 * Valide un code OTP via Twilio Verify et met à jour le profil.
 * Twilio gère max attempts / expiration — le client relaie ses erreurs.
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const guard = await checkOtpVerifyRateLimit(user.id);
  if (!guard.allowed) {
    return NextResponse.json(
      {
        error: guard.reason,
        code: 'otp_rate_limited',
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

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: 'Code invalide (6 chiffres requis)' },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, telephone')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile?.telephone) {
    return NextResponse.json(
      { error: 'Aucun numéro en attente de vérification. Demandez un nouveau code.' },
      { status: 400 }
    );
  }

  let e164: string;
  try {
    e164 = normalizePhoneE164(profile.telephone);
  } catch {
    return NextResponse.json(
      { error: 'Numéro du profil invalide. Contactez le support.' },
      { status: 400 }
    );
  }

  const result = await checkVerification(e164, code);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Code expiré ou introuvable. Demandez un nouveau code.' },
      { status: 400 }
    );
  }
  if (!result.approved) {
    return NextResponse.json(
      { error: 'Code incorrect.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  await (serviceClient as any)
    .from('profiles')
    .update({
      telephone: e164,
      phone_verified: true,
      phone_verified_at: now,
      identity_status: 'phone_verified',
      onboarding_step: 'phone_done',
    })
    .eq('id', profile.id);

  return NextResponse.json({ success: true });
}
