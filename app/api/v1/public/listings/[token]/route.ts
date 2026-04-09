export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * GET /api/v1/public/listings/[token] — Page publique d'une annonce (pas d'auth)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const serviceClient = getServiceClient();

    const { data: listing, error } = await serviceClient
      .from('property_listings')
      .select(`
        id, title, description, rent_amount_cents, charges_cents,
        available_from, bail_type, photos, public_url_token, views_count,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces, cover_url,
          dpe_classe, ges_classe, etage, nb_etages, balcon, terrasse, parking, cave,
          chauffage_type, chauffage_mode
        )
      `)
      .eq('public_url_token', token)
      .eq('is_published', true)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    // Incrémenter le compteur de vues
    const listingData = listing as any;
    await serviceClient
      .from('property_listings')
      .update({ views_count: (listingData.views_count || 0) + 1 } as any)
      .eq('id', listingData.id);

    return NextResponse.json({ listing });
  } catch (error: unknown) {
    console.error('[GET /api/v1/public/listings/[token]] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
