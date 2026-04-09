export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/v1/applications/[id] — Détail d'une candidature
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data, error } = await serviceClient
      .from('applications')
      .select(`
        *,
        listing:property_listings!inner(
          id, title, rent_amount_cents, charges_cents, bail_type,
          property:properties!inner(
            id, adresse_complete, ville, code_postal, type, surface, nb_pieces
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    // Vérifier que le propriétaire est bien le owner
    const appData = data as any;
    if (appData.owner_id !== (profile as any)?.id && appData.applicant_profile_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ application: data });
  } catch (error: unknown) {
    console.error('[GET /api/v1/applications/[id]] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
