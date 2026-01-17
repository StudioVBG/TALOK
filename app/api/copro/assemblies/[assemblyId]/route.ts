export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Assemblée Générale COPRO individuelle
// GET /api/copro/assemblies/[assemblyId] - Détails d'une AG
// PUT /api/copro/assemblies/[assemblyId] - Modifier une AG
// POST /api/copro/assemblies/[assemblyId]/actions - Actions sur l'AG
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteParams {
  params: { assemblyId: string };
}

// Schéma de mise à jour
const UpdateAssemblySchema = z.object({
  label: z.string().min(5).optional(),
  scheduled_at: z.string().datetime().optional(),
  location_type: z.enum(['physical', 'video', 'hybrid']).optional(),
  location_address: z.string().nullable().optional(),
  location_room: z.string().nullable().optional(),
  video_link: z.string().url().nullable().optional(),
  video_password: z.string().nullable().optional(),
  quorum_required: z.number().min(0).max(100).optional(),
  president_name: z.string().nullable().optional(),
  president_unit_id: z.string().uuid().nullable().optional(),
  secretary_name: z.string().nullable().optional(),
  secretary_unit_id: z.string().uuid().nullable().optional(),
  scrutineer_name: z.string().nullable().optional(),
  scrutineer_unit_id: z.string().uuid().nullable().optional(),
  agenda: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// GET: Détails d'une AG
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { assemblyId } = params;
    const { searchParams } = new URL(request.url);
    const include = searchParams.get('include')?.split(',') || [];
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer l'AG
    const { data: assembly, error } = await supabase
      .from('assemblies')
      .select(`
        *,
        site:sites(name, total_tantiemes_general)
      `)
      .eq('id', assemblyId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'AG non trouvée' }, { status: 404 });
      }
      throw error;
    }
    
    const result: any = { ...assembly };
    
    // Inclure les motions
    if (include.includes('motions') || include.includes('all')) {
      const { data: motions } = await supabase
        .from('motions')
        .select('*')
        .eq('assembly_id', assemblyId)
        .order('motion_number');
      result.motions = motions || [];
    }
    
    // Inclure les présences
    if (include.includes('attendance') || include.includes('all')) {
      const { data: attendance } = await supabase
        .from('assembly_attendance')
        .select(`
          *,
          unit:copro_units(lot_number)
        `)
        .eq('assembly_id', assemblyId)
        .order('owner_name');
      result.attendance = attendance || [];
    }
    
    // Inclure les pouvoirs
    if (include.includes('proxies') || include.includes('all')) {
      const { data: proxies } = await supabase
        .from('proxies')
        .select(`
          *,
          grantor_unit:copro_units!proxies_grantor_unit_id_fkey(lot_number)
        `)
        .eq('assembly_id', assemblyId)
        .order('grantor_name');
      result.proxies = proxies || [];
    }
    
    // Inclure les documents
    if (include.includes('documents') || include.includes('all')) {
      const { data: documents } = await supabase
        .from('assembly_documents')
        .select('*')
        .eq('assembly_id', assemblyId)
        .order('display_order');
      result.documents = documents || [];
    }
    
    // Calculer le quorum actuel
    const { data: quorumData } = await supabase
      .rpc('calculate_assembly_quorum', { p_assembly_id: assemblyId });
    if (quorumData && quorumData.length > 0) {
      result.quorum = quorumData[0];
    }
    
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/assemblies/[assemblyId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// PUT: Modifier une AG
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { assemblyId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const validationResult = UpdateAssemblySchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { data: assembly, error } = await supabase
      .from('assemblies')
      .update(validationResult.data)
      .eq('id', assemblyId)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(assembly);
  } catch (error: unknown) {
    console.error('Erreur PUT /api/copro/assemblies/[assemblyId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Actions sur l'AG (démarrer, suspendre, clôturer, etc.)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { assemblyId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action } = body;
    
    let updateData: any = {};
    
    switch (action) {
      case 'convoke':
        updateData = {
          status: 'convoked',
          convocation_sent_at: new Date().toISOString(),
        };
        break;
        
      case 'start':
        updateData = {
          status: 'in_progress',
          started_at: new Date().toISOString(),
        };
        break;
        
      case 'suspend':
        updateData = { status: 'suspended' };
        break;
        
      case 'resume':
        updateData = { status: 'in_progress' };
        break;
        
      case 'close':
        updateData = {
          status: 'closed',
          ended_at: new Date().toISOString(),
        };
        break;
        
      case 'cancel':
        updateData = { status: 'cancelled' };
        break;
        
      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }
    
    const { data: assembly, error } = await supabase
      .from('assemblies')
      .update(updateData)
      .eq('id', assemblyId)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, assembly });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/assemblies/[assemblyId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// DELETE: Supprimer une AG (uniquement brouillon)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { assemblyId } = params;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Vérifier que l'AG est en brouillon
    const { data: assembly } = await supabase
      .from('assemblies')
      .select('status')
      .eq('id', assemblyId)
      .single();
    
    if (assembly?.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les AG en brouillon peuvent être supprimées' },
        { status: 400 }
      );
    }
    
    // Supprimer (cascade supprimera les motions, votes, etc.)
    const { error } = await supabase
      .from('assemblies')
      .delete()
      .eq('id', assemblyId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Erreur DELETE /api/copro/assemblies/[assemblyId]:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

