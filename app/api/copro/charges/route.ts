export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Charges COPRO
// GET /api/copro/charges?siteId= - Liste des charges
// POST /api/copro/charges/allocate - Répartir une dépense
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// GET: Liste des charges
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const unitId = searchParams.get('unitId');
    const fiscalYear = searchParams.get('fiscalYear');
    const view = searchParams.get('view'); // 'summary', 'balances', 'detail'
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Vue synthèse par service
    if (view === 'summary' && siteId) {
      let query = supabase
        .from('v_charges_summary')
        .select('*')
        .eq('site_id', siteId);
      
      if (fiscalYear) {
        query = query.eq('fiscal_year', parseInt(fiscalYear));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }
    
    // Vue soldes par lot
    if (view === 'balances' && siteId) {
      const { data, error } = await supabase
        .from('v_unit_balance')
        .select('*')
        .eq('site_id', siteId)
        .order('lot_number');
      
      if (error) throw error;
      return NextResponse.json(data || []);
    }
    
    // Charges d'un lot spécifique
    if (unitId) {
      let query = supabase
        .from('charges_copro')
        .select(`
          *,
          expense:service_expenses(label, invoice_date, provider_name),
          service:copro_services(label, service_type)
        `)
        .eq('unit_id', unitId)
        .order('period_start', { ascending: false });
      
      if (fiscalYear) {
        query = query.eq('fiscal_year', parseInt(fiscalYear));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }
    
    // Liste globale des charges du site
    if (siteId) {
      let query = supabase
        .from('charges_copro')
        .select(`
          *,
          unit:copro_units(lot_number, unit_type),
          expense:service_expenses(label, invoice_date),
          service:copro_services(label, service_type)
        `)
        .eq('unit_id.site_id', siteId)
        .order('period_start', { ascending: false })
        .limit(100);
      
      if (fiscalYear) {
        query = query.eq('fiscal_year', parseInt(fiscalYear));
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }
    
    return NextResponse.json({ error: 'siteId ou unitId requis' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/charges:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// Schéma pour l'allocation
const AllocateSchema = z.object({
  expense_id: z.string().uuid().optional(),
  site_id: z.string().uuid().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
});

// POST: Répartir une dépense ou une période
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const validationResult = AllocateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { expense_id, site_id, period_start, period_end } = validationResult.data;
    
    // Répartir une dépense spécifique
    if (expense_id) {
      const { data, error } = await supabase
        .rpc('allocate_expense', { p_expense_id: expense_id });
      
      if (error) throw error;
      
      return NextResponse.json({
        success: true,
        allocated_count: data,
      });
    }
    
    // Répartir toutes les dépenses d'une période
    if (site_id && period_start && period_end) {
      // Récupérer les dépenses non réparties
      const { data: expenses, error: fetchError } = await supabase
        .from('service_expenses')
        .select('id')
        .eq('site_id', site_id)
        .eq('status', 'validated')
        .eq('is_allocated', false)
        .gte('period_start', period_start)
        .lte('period_end', period_end);
      
      if (fetchError) throw fetchError;
      
      let totalAllocated = 0;
      
      for (const expense of expenses || []) {
        const { data, error } = await supabase
          .rpc('allocate_expense', { p_expense_id: expense.id });
        
        if (!error && data) {
          totalAllocated += data;
        }
      }
      
      return NextResponse.json({
        success: true,
        expenses_processed: expenses?.length || 0,
        allocated_count: totalAllocated,
      });
    }
    
    return NextResponse.json({ error: 'expense_id ou site_id + période requis' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/charges:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

