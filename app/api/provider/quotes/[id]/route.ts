export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour un devis spécifique
 * GET /api/provider/quotes/[id] - Détails d'un devis
 * PUT /api/provider/quotes/[id] - Modifier un devis
 * DELETE /api/provider/quotes/[id] - Supprimer un devis (brouillon uniquement)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const quoteId = params.id;
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const { data: quote, error } = await serviceClient
      .from('provider_quotes')
      .select(`
        *,
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          id,
          prenom,
          nom,
          telephone
        ),
        property:properties (
          id,
          adresse_complete,
          code_postal,
          ville
        ),
        ticket:tickets (
          id,
          titre
        )
      `)
      .eq('id', quoteId)
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    const isProvider = quote.provider_profile_id === profile.id;
    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    if (isOwner && !(quote as any).viewed_at && quote.status === 'sent') {
      await serviceClient
        .from('provider_quotes')
        .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
        .eq('id', quoteId);
    }

    const { data: items } = await serviceClient
      .from('provider_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order');

    const ownerObj: any = quote.owner;
    const propertyObj: any = quote.property;

    return NextResponse.json({
      quote: {
        ...quote,
        items: items || [],
        owner_name: ownerObj
          ? `${ownerObj.prenom || ''} ${ownerObj.nom || ''}`.trim()
          : null,
        property_address: propertyObj
          ? `${propertyObj.adresse_complete}, ${propertyObj.ville}`
          : null,
      },
    });
  } catch (error: unknown) {
    console.error('[provider/quotes/[id]] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const quoteId = params.id;
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { data: quote } = await serviceClient
      .from('provider_quotes')
      .select('id, status, provider_profile_id')
      .eq('id', quoteId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés.' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from('provider_quotes')
      .delete()
      .eq('id', quoteId)
      .eq('provider_profile_id', profile.id);

    if (deleteError) {
      console.error('[provider/quotes/[id]] DELETE error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[provider/quotes/[id]] DELETE handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
