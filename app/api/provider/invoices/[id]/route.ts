export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour une facture spécifique
 * GET /api/provider/invoices/[id] - Détails d'une facture
 * PUT /api/provider/invoices/[id] - Modifier une facture
 * DELETE /api/provider/invoices/[id] - Supprimer une facture (brouillon uniquement)
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

    const invoiceId = params.id;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Récupérer la facture avec les relations
    const { data: invoice, error } = await supabase
      .from('provider_invoices')
      .select(`
        *,
        owner:profiles!provider_invoices_owner_profile_id_fkey (
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
        work_order:work_orders (
          id,
          ticket:tickets (
            titre
          )
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    const isProvider = invoice.provider_profile_id === profile.id;
    const isOwner = invoice.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Marquer comme vue si c'est le propriétaire qui consulte
    if (isOwner && !invoice.viewed_at) {
      await supabase
        .from('provider_invoices')
        .update({ viewed_at: new Date().toISOString(), status: invoice.status === 'sent' ? 'viewed' : invoice.status })
        .eq('id', invoiceId);
    }

    // Récupérer les lignes
    const { data: items } = await supabase
      .from('provider_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    // Récupérer les paiements
    const { data: payments } = await supabase
      .from('provider_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at');

    // Calculer le solde
    const { data: balance } = await supabase.rpc('get_invoice_balance', {
      p_invoice_id: invoiceId,
    });

    return NextResponse.json({
      invoice: {
        ...invoice,
        items: items || [],
        payments: payments || [],
        balance: balance || invoice.total_amount,
      },
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/invoices/[id]:', error);
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

    const invoiceId = params.id;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Vérifier que la facture existe et appartient au prestataire
    const { data: invoice } = await supabase
      .from('provider_invoices')
      .select('id, status, provider_profile_id')
      .eq('id', invoiceId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Seuls les brouillons peuvent être supprimés
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés. Pour annuler une facture envoyée, utilisez l\'action "Annuler".' },
        { status: 400 }
      );
    }

    // Supprimer la facture (les items seront supprimés en cascade)
    const { error: deleteError } = await supabase
      .from('provider_invoices')
      .delete()
      .eq('id', invoiceId);

    if (deleteError) {
      console.error('Error deleting invoice:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/provider/invoices/[id]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

