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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Récupérer le devis avec les relations
    const { data: quote, error } = await supabase
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

    // Vérifier les permissions
    const isProvider = quote.provider_profile_id === profile.id;
    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Marquer comme vu si c'est le propriétaire qui consulte
    if (isOwner && !quote.viewed_at && quote.status === 'sent') {
      await supabase
        .from('provider_quotes')
        .update({ viewed_at: new Date().toISOString(), status: 'viewed' })
        .eq('id', quoteId);
    }

    // Récupérer les lignes
    const { data: items } = await supabase
      .from('provider_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order');

    return NextResponse.json({
      quote: {
        ...quote,
        items: items || [],
        owner_name: quote.owner ? `${quote.owner.prenom || ''} ${quote.owner.nom || ''}`.trim() : null,
        property_address: quote.property ? `${quote.property.adresse_complete}, ${quote.property.ville}` : null,
      },
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quotes/[id]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Vérifier que le devis existe et appartient au prestataire
    const { data: quote } = await supabase
      .from('provider_quotes')
      .select('id, status, provider_profile_id')
      .eq('id', quoteId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Seuls les brouillons peuvent être supprimés
    if (quote.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés.' },
        { status: 400 }
      );
    }

    // Supprimer le devis (les items seront supprimés en cascade)
    const { error: deleteError } = await supabase
      .from('provider_quotes')
      .delete()
      .eq('id', quoteId);

    if (deleteError) {
      console.error('Error deleting quote:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/provider/quotes/[id]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

