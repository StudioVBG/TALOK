export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// =====================================================
// API Route: Site COPRO individuel
// GET /api/copro/sites/[siteId] - Détails d'un site
// PUT /api/copro/sites/[siteId] - Modifier un site
// DELETE /api/copro/sites/[siteId] - Supprimer un site
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour la mise à jour
const UpdateSiteSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['copropriete', 'lotissement', 'residence_mixte', 'asl', 'aful']).optional(),
  address_line1: z.string().min(5).optional(),
  address_line2: z.string().nullable().optional(),
  postal_code: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  siret: z.string().nullable().optional(),
  numero_immatriculation: z.string().nullable().optional(),
  date_reglement: z.string().nullable().optional(),
  fiscal_year_start_month: z.number().min(1).max(12).optional(),
  total_tantiemes_general: z.number().min(1).optional(),
  syndic_type: z.enum(['professionnel', 'benevole', 'cooperatif']).optional(),
  syndic_company_name: z.string().nullable().optional(),
  syndic_siret: z.string().nullable().optional(),
  syndic_address: z.string().nullable().optional(),
  syndic_email: z.string().email().nullable().optional(),
  syndic_phone: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
});

interface RouteParams {
  params: { siteId: string };
}

// GET: Détails d'un site
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { siteId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer le site avec les stats
    const { data: site, error } = await supabase
      .from('sites')
      .select(`
        *,
        buildings:buildings(id, name, building_type, floors_count, has_elevator),
        syndic:profiles!sites_syndic_profile_id_fkey(id, first_name, last_name, email)
      `)
      .eq('id', siteId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Site non trouvé' }, { status: 404 });
      }
      throw error;
    }
    
    // Récupérer les stats
    const { data: unitsStats } = await supabase
      .from('copro_units')
      .select('occupation_mode, tantieme_general')
      .eq('site_id', siteId)
      .eq('is_active', true);
    
    const stats = {
      buildings_count: site.buildings?.length || 0,
      units_count: unitsStats?.length || 0,
      total_tantiemes_actual: unitsStats?.reduce((sum, u) => sum + (u.tantieme_general || 0), 0) || 0,
      occupied_count: unitsStats?.filter(u => u.occupation_mode === 'owner_occupied').length || 0,
      rented_count: unitsStats?.filter(u => u.occupation_mode === 'rented').length || 0,
      vacant_count: unitsStats?.filter(u => u.occupation_mode === 'vacant').length || 0,
    };
    
    return NextResponse.json({ ...site, stats });
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/sites/[siteId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// PUT: Modifier un site
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { siteId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Parser et valider le body
    const body = await request.json();
    const validationResult = UpdateSiteSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    // Mettre à jour le site
    const { data: site, error } = await supabase
      .from('sites')
      .update(validationResult.data)
      .eq('id', siteId)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(site);
  } catch (error: unknown) {
    console.error('Erreur PUT /api/copro/sites/[siteId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// DELETE: Supprimer (soft delete) un site
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { siteId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Soft delete
    const { error } = await supabase
      .from('sites')
      .update({ 
        is_active: false, 
        archived_at: new Date().toISOString() 
      })
      .eq('id', siteId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Erreur DELETE /api/copro/sites/[siteId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

