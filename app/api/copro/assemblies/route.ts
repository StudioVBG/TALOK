export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Assemblées Générales COPRO
// GET /api/copro/assemblies?siteId= - Liste des AG
// POST /api/copro/assemblies - Créer une AG
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation
const CreateAssemblySchema = z.object({
  site_id: z.string().uuid(),
  label: z.string().min(5, 'Label requis'),
  assembly_type: z.enum(['AGO', 'AGE', 'AGM']),
  scheduled_at: z.string().datetime(),
  location_type: z.enum(['physical', 'video', 'hybrid']).default('physical'),
  location_address: z.string().optional(),
  location_room: z.string().optional(),
  video_link: z.string().url().optional(),
  video_password: z.string().optional(),
  quorum_required: z.number().min(0).max(100).default(25),
  agenda: z.string().optional(),
  notes: z.string().optional(),
});

// GET: Liste des AG
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    let query = supabase
      .from('v_assemblies_summary')
      .select('*')
      .order('scheduled_at', { ascending: upcoming });
    
    if (siteId) {
      query = query.eq('site_id', siteId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (upcoming) {
      query = query
        .in('status', ['draft', 'convoked'])
        .gte('scheduled_at', new Date().toISOString());
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/assemblies:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Créer une AG
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const validationResult = CreateAssemblySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const input = validationResult.data;
    
    // Générer le numéro d'AG
    const year = new Date(input.scheduled_at).getFullYear();
    const { count } = await supabase
      .from('assemblies')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', input.site_id)
      .gte('scheduled_at', `${year}-01-01`)
      .lte('scheduled_at', `${year}-12-31`);
    
    const sequence = (count || 0) + 1;
    const assemblyNumber = `${input.assembly_type}-${year}-${sequence.toString().padStart(2, '0')}`;
    
    // Récupérer le total des tantièmes du site
    const { data: site } = await supabase
      .from('sites')
      .select('total_tantiemes_general')
      .eq('id', input.site_id)
      .single();
    
    // Créer l'AG
    const { data: assembly, error } = await supabase
      .from('assemblies')
      .insert({
        ...input,
        assembly_number: assemblyNumber,
        total_tantiemes: site?.total_tantiemes_general || 0,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(assembly, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/assemblies:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

