export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour la facturation prestataire
 * GET /api/provider/invoices - Liste des factures
 * POST /api/provider/invoices - Créer une facture
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour la création de facture
const createInvoiceSchema = z.object({
  owner_profile_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  work_order_id: z.string().uuid().optional(),
  document_type: z.enum(['invoice', 'quote', 'credit_note']).default('invoice'),
  title: z.string().min(1, 'Le titre est requis'),
  description: z.string().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  payment_terms_days: z.number().min(0).default(30),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(100).default(20),
  late_payment_rate: z.number().min(0).default(10),
  fixed_recovery_fee: z.number().min(0).default(40),
  early_payment_discount_rate: z.number().min(0).max(100).optional(),
  early_payment_discount_days: z.number().min(0).optional(),
  custom_legal_mentions: z.string().optional(),
  custom_payment_info: z.string().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().default('unité'),
    unit_price: z.number().min(0),
    tax_rate: z.number().min(0).max(100).default(20),
    discount_percent: z.number().min(0).max(100).default(0),
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
    const documentType = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Construire la requête
    let query = supabase
      .from('provider_invoices')
      .select(`
        *,
        owner:profiles!provider_invoices_owner_profile_id_fkey (
          prenom,
          nom
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `, { count: 'exact' })
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (documentType && documentType !== 'all') {
      query = query.eq('document_type', documentType);
    }

    const { data: invoices, error, count } = await query;

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Calculer les stats
    const { data: stats } = await supabase
      .from('provider_invoices')
      .select('status, total_amount')
      .eq('provider_profile_id', profile.id);

    const summary = {
      total: stats?.length || 0,
      draft: stats?.filter(i => i.status === 'draft').length || 0,
      sent: stats?.filter(i => ['sent', 'viewed'].includes(i.status)).length || 0,
      paid: stats?.filter(i => i.status === 'paid').length || 0,
      overdue: stats?.filter(i => i.status === 'overdue').length || 0,
      total_paid: stats?.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0,
      total_pending: stats?.filter(i => ['sent', 'viewed', 'partial'].includes(i.status)).reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0,
    };

    return NextResponse.json({
      invoices: invoices?.map(inv => ({
        ...inv,
        owner_name: inv.owner ? `${inv.owner.prenom || ''} ${inv.owner.nom || ''}`.trim() : null,
        property_address: inv.property ? `${inv.property.adresse_complete}, ${inv.property.ville}` : null,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
      summary,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/invoices:', error);
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
    const validationResult = createInvoiceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Calculer la date d'échéance si non fournie
    const invoiceDate = data.invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = data.due_date || new Date(
      new Date(invoiceDate).getTime() + data.payment_terms_days * 24 * 60 * 60 * 1000
    ).toISOString().split('T')[0];

    // Créer la facture (le numéro sera généré automatiquement par le trigger)
    const { data: invoice, error: createError } = await supabase
      .from('provider_invoices')
      .insert({
        provider_profile_id: profile.id,
        owner_profile_id: data.owner_profile_id,
        property_id: data.property_id,
        work_order_id: data.work_order_id,
        document_type: data.document_type,
        title: data.title,
        description: data.description,
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms_days: data.payment_terms_days,
        discount_percent: data.discount_percent,
        tax_rate: data.tax_rate,
        late_payment_rate: data.late_payment_rate,
        fixed_recovery_fee: data.fixed_recovery_fee,
        early_payment_discount_rate: data.early_payment_discount_rate,
        early_payment_discount_days: data.early_payment_discount_days,
        custom_legal_mentions: data.custom_legal_mentions,
        custom_payment_info: data.custom_payment_info,
        status: 'draft',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating invoice:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Ajouter les lignes de facture
    const items = data.items.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      discount_percent: item.discount_percent,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('provider_invoice_items')
      .insert(items);

    if (itemsError) {
      // Supprimer la facture en cas d'erreur
      await supabase.from('provider_invoices').delete().eq('id', invoice.id);
      console.error('Error creating invoice items:', itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Les totaux seront calculés automatiquement par le trigger

    // Récupérer la facture mise à jour
    const { data: updatedInvoice } = await supabase
      .from('provider_invoices')
      .select('*')
      .eq('id', invoice.id)
      .single();

    return NextResponse.json({ invoice: updatedInvoice }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/invoices:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

