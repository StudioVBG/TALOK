export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/v1/listings/[id]/applications — Candidatures reçues pour une annonce
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

    // Vérifier que l'annonce appartient au propriétaire
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data: listing } = await serviceClient
      .from('property_listings')
      .select('id, owner_id')
      .eq('id', id)
      .single();

    if (!listing || (listing as any).owner_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Filtrer par statut si demandé
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let query = serviceClient
      .from('applications')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ applications: data || [] });
  } catch (error: unknown) {
    console.error('[GET /api/v1/listings/[id]/applications] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
