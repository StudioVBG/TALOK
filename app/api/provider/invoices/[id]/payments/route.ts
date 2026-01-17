export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les paiements sur une facture
 * GET /api/provider/invoices/[id]/payments - Liste des paiements
 * POST /api/provider/invoices/[id]/payments - Enregistrer un paiement
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

const createPaymentSchema = z.object({
  amount: z.number().positive('Le montant doit être positif'),
  payment_type: z.enum(['deposit', 'partial', 'final', 'refund']),
  payment_method: z.enum(['card', 'transfer', 'check', 'cash', 'platform']).optional(),
  transaction_id: z.string().optional(),
  check_number: z.string().optional(),
  paid_at: z.string().optional(),
  notes: z.string().optional(),
});

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

    // Vérifier l'accès à la facture
    const { data: invoice } = await supabase
      .from('provider_invoices')
      .select('id, provider_profile_id, owner_profile_id')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    const isProvider = invoice.provider_profile_id === profile.id;
    const isOwner = invoice.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Récupérer les paiements
    const { data: payments, error } = await supabase
      .from('provider_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ payments });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/invoices/[id]/payments:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // Vérifier l'accès à la facture (seul le prestataire peut enregistrer les paiements)
    const { data: invoice } = await supabase
      .from('provider_invoices')
      .select('id, provider_profile_id, total_amount, status')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    const isProvider = invoice.provider_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isAdmin) {
      return NextResponse.json({ error: 'Seul le prestataire peut enregistrer des paiements' }, { status: 403 });
    }

    // Vérifier que la facture est dans un état permettant les paiements
    if (!['sent', 'viewed', 'partial', 'overdue'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Les paiements ne peuvent être enregistrés que sur une facture envoyée' },
        { status: 400 }
      );
    }

    // Parser et valider le body
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Vérifier le solde restant
    const { data: currentBalance } = await supabase.rpc('get_invoice_balance', {
      p_invoice_id: invoiceId,
    });

    if (data.payment_type !== 'refund' && data.amount > (currentBalance || invoice.total_amount)) {
      return NextResponse.json(
        { error: `Le montant dépasse le solde dû (${currentBalance}€)` },
        { status: 400 }
      );
    }

    // Créer le paiement
    const { data: payment, error: createError } = await supabase
      .from('provider_invoice_payments')
      .insert({
        invoice_id: invoiceId,
        amount: data.amount,
        payment_type: data.payment_type,
        payment_method: data.payment_method,
        transaction_id: data.transaction_id,
        check_number: data.check_number,
        paid_at: data.paid_at || new Date().toISOString(),
        notes: data.notes,
        created_by: profile.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating payment:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Le statut de la facture sera mis à jour automatiquement par le trigger

    // Récupérer la facture mise à jour
    const { data: updatedInvoice } = await supabase
      .from('provider_invoices')
      .select('status')
      .eq('id', invoiceId)
      .single();

    return NextResponse.json({
      payment,
      invoice_status: updatedInvoice?.status,
      message: updatedInvoice?.status === 'paid' ? 'Facture entièrement payée' : 'Paiement enregistré',
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/invoices/[id]/payments:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

