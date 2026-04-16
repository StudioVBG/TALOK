export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { createListingSchema } from '@/lib/validations/candidatures';
import { getServiceClient } from '@/lib/supabase/service-client';
import { fetchPropertyCoverUrls } from '@/lib/properties/cover-url';
import { z } from 'zod';

/**
 * GET /api/v1/listings — Liste des annonces du propriétaire
 */
export async function GET(request: Request) {
  try {
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

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    const { data, error } = await serviceClient
      .from('property_listings')
      .select(`
        *,
        property:properties!inner(
          id, adresse_complete, ville, code_postal, type, surface, nb_pieces
        )
      `)
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Compter les candidatures par annonce
    const listingIds = (data || []).map((l: any) => l.id);
    let applicationCounts: Record<string, number> = {};

    if (listingIds.length > 0) {
      const { data: counts } = await serviceClient
        .from('applications')
        .select('listing_id')
        .in('listing_id', listingIds);

      if (counts) {
        for (const row of counts as any[]) {
          applicationCounts[row.listing_id] = (applicationCounts[row.listing_id] || 0) + 1;
        }
      }
    }

    // Enrichir les annonces avec cover_url (depuis la table photos)
    const propertyIds = (data || [])
      .map((l: any) => l.property?.id)
      .filter((id: any): id is string => !!id);
    const coverMap = await fetchPropertyCoverUrls(serviceClient, propertyIds);

    const listings = (data || []).map((listing: any) => ({
      ...listing,
      property: listing.property
        ? { ...listing.property, cover_url: coverMap.get(listing.property.id) ?? null }
        : listing.property,
      applications_count: applicationCounts[listing.id] || 0,
    }));

    return NextResponse.json({ listings });
  } catch (error: unknown) {
    console.error('[GET /api/v1/listings] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/listings — Créer une annonce
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const validated = createListingSchema.parse(body);

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || (profile as any).role !== 'owner') {
      return NextResponse.json({ error: 'Accès réservé aux propriétaires' }, { status: 403 });
    }

    // Vérifier que le bien appartient au propriétaire
    const { data: property } = await serviceClient
      .from('properties')
      .select('id, owner_id')
      .eq('id', validated.property_id)
      .single();

    if (!property || (property as any).owner_id !== (profile as any).id) {
      return NextResponse.json({ error: 'Bien introuvable ou non autorisé' }, { status: 403 });
    }

    const { data, error } = await serviceClient
      .from('property_listings')
      .insert({
        property_id: validated.property_id,
        owner_id: (profile as any).id,
        title: validated.title,
        description: validated.description || null,
        rent_amount_cents: validated.rent_amount_cents,
        charges_cents: validated.charges_cents,
        available_from: validated.available_from,
        bail_type: validated.bail_type,
        photos: validated.photos || [],
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ listing: data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      );
    }
    console.error('[POST /api/v1/listings] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
