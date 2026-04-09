export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * POST /api/v1/listings/[id]/publish — Publier / dépublier une annonce
 */
export async function POST(
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

    const { data: listing } = await serviceClient
      .from('property_listings')
      .select('id, owner_id, is_published, title, description, rent_amount_cents, available_from')
      .eq('id', id)
      .single();

    if (!listing || (listing as any).owner_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const listingData = listing as any;

    // Si on publie, vérifier les prérequis
    if (!listingData.is_published) {
      const errors: Array<{ field: string; message: string }> = [];

      if (!listingData.title || listingData.title.length < 8) {
        errors.push({ field: 'title', message: 'Le titre doit contenir au moins 8 caractères' });
      }
      if (!listingData.description || listingData.description.length < 30) {
        errors.push({ field: 'description', message: 'La description doit contenir au moins 30 caractères' });
      }
      if (!listingData.rent_amount_cents || listingData.rent_amount_cents <= 0) {
        errors.push({ field: 'rent_amount_cents', message: 'Le loyer doit être défini' });
      }
      if (!listingData.available_from) {
        errors.push({ field: 'available_from', message: 'La date de disponibilité est requise' });
      }

      if (errors.length > 0) {
        return NextResponse.json({ success: false, errors }, { status: 400 });
      }
    }

    // Toggle publication
    const newStatus = !listingData.is_published;

    const { data, error } = await serviceClient
      .from('property_listings')
      .update({ is_published: newStatus } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      listing: data,
      published: newStatus,
    });
  } catch (error: unknown) {
    console.error('[POST /api/v1/listings/[id]/publish] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
