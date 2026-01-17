export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les devis prestataire
 * GET /api/provider/quotes - Liste des devis
 * POST /api/provider/quotes - Créer un devis
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createQuoteSchema = z.object({
  owner_profile_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  ticket_id: z.string().uuid().optional(),
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  valid_until: z.string().optional(),
  terms_and_conditions: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().default('unité'),
    unit_price: z.number().min(0),
    tax_rate: z.number().min(0).max(100).default(20),
  })).min(1, 'Au moins une ligne est requise'),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Paramètres de filtrage
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Construire la requête
    let query = supabase
      .from('provider_quotes')
      .select(`
        *,
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          prenom,
          nom
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `)
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: quotes, error } = await query;

    // Si la table n'existe pas, retourner des données vides
    if (error) {
      console.warn('provider_quotes table not found or error:', error.message);
      return NextResponse.json({
        quotes: [],
        stats: {
          total: 0,
          draft: 0,
          sent: 0,
          accepted: 0,
          rejected: 0,
          total_accepted_amount: 0,
        },
      });
    }

    // Calculer les stats
    const stats = {
      total: quotes?.length || 0,
      draft: quotes?.filter(q => q.status === 'draft').length || 0,
      sent: quotes?.filter(q => q.status === 'sent').length || 0,
      accepted: quotes?.filter(q => q.status === 'accepted').length || 0,
      rejected: quotes?.filter(q => q.status === 'rejected').length || 0,
      total_accepted_amount: quotes?.filter(q => q.status === 'accepted').reduce((sum, q) => sum + (q.total_amount || 0), 0) || 0,
    };

    return NextResponse.json({
      quotes: quotes?.map(q => ({
        ...q,
        owner_name: q.owner ? `${q.owner.prenom || ''} ${q.owner.nom || ''}`.trim() : null,
        property_address: q.property ? `${q.property.adresse_complete}, ${q.property.ville}` : null,
      })),
      stats,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quotes:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer le profil prestataire
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Parser et valider le body
    const body = await request.json();
    const validationResult = createQuoteSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Calculer la date de validité par défaut (30 jours)
    const validUntil = data.valid_until || new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    // Créer le devis (la référence sera générée automatiquement)
    const { data: quote, error: createError } = await supabase
      .from('provider_quotes')
      .insert({
        provider_profile_id: profile.id,
        owner_profile_id: data.owner_profile_id,
        property_id: data.property_id,
        ticket_id: data.ticket_id,
        title: data.title,
        description: data.description,
        valid_until: validUntil,
        terms_and_conditions: data.terms_and_conditions,
        tax_rate: 20,
        status: 'draft',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating quote:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Ajouter les lignes de devis
    const items = data.items.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('provider_quote_items')
      .insert(items);

    if (itemsError) {
      // Supprimer le devis en cas d'erreur
      await supabase.from('provider_quotes').delete().eq('id', quote.id);
      console.error('Error creating quote items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Récupérer le devis mis à jour (avec totaux calculés par trigger)
    const { data: updatedQuote } = await supabase
      .from('provider_quotes')
      .select('*')
      .eq('id', quote.id)
      .single();

    return NextResponse.json({ quote: updatedQuote }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

