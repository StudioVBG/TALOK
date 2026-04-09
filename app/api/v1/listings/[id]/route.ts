export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { updateListingSchema } from '@/lib/validations/candidatures';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

/**
 * GET /api/v1/listings/[id] — Détail d'une annonce
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
    const { data, error } = await serviceClient
      .from('property_listings')
      .select(`
        *,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces, cover_url
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    return NextResponse.json({ listing: data });
  } catch (error: unknown) {
    console.error('[GET /api/v1/listings/[id]] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/listings/[id] — Modifier une annonce
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateListingSchema.parse(body);

    const serviceClient = getServiceClient();

    // Vérifier la propriété
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const { data: listing } = await serviceClient
      .from('property_listings')
      .select('owner_id')
      .eq('id', id)
      .single();

    if (!listing || (listing as any).owner_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const updates: Record<string, unknown> = {};
    if (validated.title !== undefined) updates.title = validated.title;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.rent_amount_cents !== undefined) updates.rent_amount_cents = validated.rent_amount_cents;
    if (validated.charges_cents !== undefined) updates.charges_cents = validated.charges_cents;
    if (validated.available_from !== undefined) updates.available_from = validated.available_from;
    if (validated.bail_type !== undefined) updates.bail_type = validated.bail_type;
    if (validated.photos !== undefined) updates.photos = validated.photos;

    const { data, error } = await serviceClient
      .from('property_listings')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ listing: data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      );
    }
    console.error('[PATCH /api/v1/listings/[id]] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
