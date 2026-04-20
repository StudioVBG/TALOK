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

    const invoiceId = params.id;
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const { data: invoice, error } = await serviceClient
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

    // RBAC explicite — la facture doit appartenir au provider, à l'owner, ou admin
    const isProvider = invoice.provider_profile_id === profile.id;
    const isOwner = invoice.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Marquer comme vue si c'est le propriétaire qui consulte
    if (isOwner && !(invoice as any).viewed_at) {
      await serviceClient
        .from('provider_invoices')
        .update({
          viewed_at: new Date().toISOString(),
          status: invoice.status === 'sent' ? 'viewed' : invoice.status,
        })
        .eq('id', invoiceId);
    }

    const { data: items } = await serviceClient
      .from('provider_invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order');

    const { data: payments } = await serviceClient
      .from('provider_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at');

    const { data: balance } = await serviceClient.rpc('get_invoice_balance', {
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
    console.error('[provider/invoices/[id]] GET error:', error);
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

    const invoiceId = params.id;
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // RBAC scoping — la facture doit appartenir au provider courant
    const { data: invoice } = await serviceClient
      .from('provider_invoices')
      .select('id, status, provider_profile_id')
      .eq('id', invoiceId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seuls les brouillons peuvent être supprimés. Pour annuler une facture envoyée, utilisez l\'action "Annuler".' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from('provider_invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('provider_profile_id', profile.id);

    if (deleteError) {
      console.error('[provider/invoices/[id]] DELETE error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('[provider/invoices/[id]] DELETE handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
