export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les rapports d'intervention
 * GET /api/work-orders/[id]/reports - Liste des rapports
 * POST /api/work-orders/[id]/reports - Créer un rapport
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

    const workOrderId = params.id;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Vérifier l'accès au work order
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select(`
        id,
        provider_id,
        ticket:tickets (
          property:properties (
            owner_id
          )
        )
      `)
      .eq('id', workOrderId)
      .single();

    if (!workOrder) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    const isProvider = workOrder.provider_id === profile.id;
    const isOwner = (workOrder as any).ticket?.property?.owner_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Récupérer les rapports
    const { data: reports, error: reportsError } = await supabase
      .from('work_order_reports')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('reported_at', { ascending: true });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      return NextResponse.json({ error: reportsError.message }, { status: 500 });
    }

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    console.error('Error in GET /api/work-orders/[id]/reports:', error);
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

    const workOrderId = params.id;

    // Récupérer le profil prestataire
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Seuls les prestataires peuvent créer des rapports' }, { status: 403 });
    }

    // Vérifier que le prestataire est assigné à ce work order
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('id, provider_id, statut')
      .eq('id', workOrderId)
      .eq('provider_id', profile.id)
      .single();

    if (!workOrder) {
      return NextResponse.json({ error: 'Intervention non trouvée ou non autorisée' }, { status: 404 });
    }

    const body = await request.json();
    const {
      report_type,
      gps_latitude,
      gps_longitude,
      gps_accuracy,
      gps_address,
      media_items,
      checklist_template_id,
      checklist_responses,
      technician_notes,
      anomalies_detected,
      recommendations,
    } = body;

    // Valider le type de rapport
    const validTypes = ['arrival', 'before', 'during', 'after', 'completion'];
    if (!report_type || !validTypes.includes(report_type)) {
      return NextResponse.json({ error: 'Type de rapport invalide' }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas déjà un rapport du même type (sauf 'during')
    if (report_type !== 'during') {
      const { data: existingReport } = await supabase
        .from('work_order_reports')
        .select('id')
        .eq('work_order_id', workOrderId)
        .eq('report_type', report_type)
        .single();

      if (existingReport) {
        return NextResponse.json(
          { error: `Un rapport de type "${report_type}" existe déjà pour cette intervention` },
          { status: 400 }
        );
      }
    }

    // Créer le rapport
    const { data: report, error: createError } = await supabase
      .from('work_order_reports')
      .insert({
        work_order_id: workOrderId,
        report_type,
        gps_latitude,
        gps_longitude,
        gps_accuracy,
        gps_address,
        media_items: media_items || [],
        checklist_template_id,
        checklist_responses: checklist_responses || {},
        technician_notes,
        anomalies_detected: anomalies_detected || [],
        recommendations: recommendations || [],
        created_by: profile.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating report:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Mettre à jour le work order selon le type de rapport
    const workOrderUpdates: Record<string, unknown> = {};

    if (report_type === 'arrival') {
      workOrderUpdates.actual_start_at = new Date().toISOString();
      if (workOrder.statut === 'scheduled') {
        workOrderUpdates.statut = 'in_progress';
      }
    }

    if (report_type === 'completion') {
      workOrderUpdates.actual_end_at = new Date().toISOString();
      workOrderUpdates.final_report_id = report.id;
    }

    if (Object.keys(workOrderUpdates).length > 0) {
      await supabase
        .from('work_orders')
        .update(workOrderUpdates)
        .eq('id', workOrderId);
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/work-orders/[id]/reports:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

