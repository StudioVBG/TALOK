export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { createServiceRoleClient } from '@/lib/supabase/service-client';

/**
 * POST /api/identity/skip-phone
 * Marque le profil comme `phone_skipped` pour autoriser l'accès au
 * dashboard sans vérification SMS. Les actions sensibles (signature
 * de bail, paiements) restent gardées par les niveaux d'identité
 * supérieurs (document_uploaded, identity_verified).
 */
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const serviceClient = createServiceRoleClient();

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, identity_status')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  }

  // Idempotence : ne pas régresser un statut déjà supérieur.
  if (
    profile.identity_status === 'phone_verified' ||
    profile.identity_status === 'document_uploaded' ||
    profile.identity_status === 'identity_review' ||
    profile.identity_status === 'identity_verified'
  ) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const { error: updateError } = await (serviceClient as any)
    .from('profiles')
    .update({
      identity_status: 'phone_skipped',
      onboarding_step: 'phone_pending',
    })
    .eq('id', profile.id);

  if (updateError) {
    return NextResponse.json(
      { error: 'Impossible de différer la vérification.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
