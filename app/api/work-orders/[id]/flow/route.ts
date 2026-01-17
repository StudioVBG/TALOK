export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour les actions du flux d'intervention
 * POST /api/work-orders/[id]/flow
 * 
 * Actions possibles:
 * - accept: Accepter la mission
 * - refuse: Refuser la mission
 * - schedule_visit: Planifier la visite
 * - complete_visit: Marquer visite effectuée
 * - start_work: Démarrer les travaux
 * - complete_work: Terminer les travaux
 * - request_review: Demander un avis
 * - close: Clôturer l'intervention
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

const actionSchema = z.object({
  action: z.enum([
    'accept',
    'refuse',
    'schedule_visit',
    'complete_visit',
    'start_work',
    'complete_work',
    'request_review',
    'close',
    'cancel',
  ]),
  // Données optionnelles selon l'action
  visit_date: z.string().datetime().optional(),
  visit_notes: z.string().optional(),
  refusal_reason: z.string().optional(),
  completion_report: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

// Mapping des actions vers les statuts
const ACTION_STATUS_MAP: Record<string, { from: string[]; to: string }> = {
  accept: { from: ['assigned'], to: 'accepted' },
  refuse: { from: ['assigned', 'accepted'], to: 'refused' },
  schedule_visit: { from: ['accepted'], to: 'visit_scheduled' },
  complete_visit: { from: ['visit_scheduled'], to: 'visit_completed' },
  start_work: { from: ['deposit_paid', 'work_scheduled'], to: 'in_progress' },
  complete_work: { from: ['in_progress'], to: 'work_completed' },
  request_review: { from: ['fully_paid'], to: 'pending_review' },
  close: { from: ['pending_review', 'fully_paid'], to: 'closed' },
  cancel: { from: ['assigned', 'accepted', 'visit_scheduled', 'visit_completed', 'quote_sent'], to: 'cancelled' },
};

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

    // Parser et valider le body
    const body = await request.json();
    const validationResult = actionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { action, visit_date, visit_notes, refusal_reason, completion_report, photos } = validationResult.data;

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Récupérer le work_order avec les relations
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        ticket:tickets(
          id,
          property_id,
          properties(owner_id)
        )
      `)
      .eq('id', workOrderId)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    const isProvider = workOrder.provider_id === profile.id;
    const isOwner = workOrder.ticket?.properties?.owner_id === profile.id;
    const isAdmin = profile.role === 'admin';

    // Définir qui peut faire quelle action
    const providerActions = ['accept', 'refuse', 'complete_visit', 'start_work', 'complete_work'];
    const ownerActions = ['schedule_visit', 'request_review', 'close', 'cancel'];
    const bothActions = ['cancel'];

    const canPerform = 
      (providerActions.includes(action) && isProvider) ||
      (ownerActions.includes(action) && isOwner) ||
      (bothActions.includes(action) && (isProvider || isOwner)) ||
      isAdmin;

    if (!canPerform) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas autorisé à effectuer cette action' },
        { status: 403 }
      );
    }

    // Vérifier que le statut actuel permet cette action
    const actionConfig = ACTION_STATUS_MAP[action];
    if (!actionConfig) {
      return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
    }

    if (!actionConfig.from.includes(workOrder.statut)) {
      return NextResponse.json(
        { 
          error: `Cette action n'est pas possible depuis le statut "${workOrder.statut}"`,
          current_status: workOrder.statut,
          allowed_from: actionConfig.from,
        },
        { status: 400 }
      );
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, any> = {
      statut: actionConfig.to,
      updated_at: new Date().toISOString(),
    };

    // Ajouter les données spécifiques à l'action
    switch (action) {
      case 'accept':
        updateData.accepted_at = new Date().toISOString();
        break;

      case 'refuse':
        updateData.refused_at = new Date().toISOString();
        updateData.refusal_reason = refusal_reason || 'Non spécifié';
        break;

      case 'schedule_visit':
        if (!visit_date) {
          return NextResponse.json({ error: 'Date de visite requise' }, { status: 400 });
        }
        updateData.visit_scheduled_at = visit_date;
        updateData.date_intervention_prevue = visit_date.split('T')[0];
        break;

      case 'complete_visit':
        updateData.visit_completed_at = new Date().toISOString();
        if (visit_notes) updateData.visit_notes = visit_notes;
        if (photos) updateData.visit_photos = photos;
        break;

      case 'start_work':
        updateData.work_started_at = new Date().toISOString();
        if (photos) updateData.before_photos = photos;
        break;

      case 'complete_work':
        updateData.work_completed_at = new Date().toISOString();
        updateData.date_intervention_reelle = new Date().toISOString().split('T')[0];
        if (completion_report) updateData.completion_report = completion_report;
        if (photos) updateData.after_photos = photos;
        break;

      case 'close':
        updateData.closed_at = new Date().toISOString();
        break;
    }

    // Mettre à jour le work_order
    const { error: updateError } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', workOrderId);

    if (updateError) {
      console.error('Error updating work_order:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Ajouter l'événement au timeline
    await supabase.from('work_order_timeline').insert({
      work_order_id: workOrderId,
      event_type: action === 'accept' ? 'accepted' : 
                  action === 'refuse' ? 'refused' :
                  action === 'schedule_visit' ? 'visit_scheduled' :
                  action === 'complete_visit' ? 'visit_completed' :
                  action === 'start_work' ? 'work_started' :
                  action === 'complete_work' ? 'work_completed' :
                  action === 'close' ? 'closed' :
                  action === 'cancel' ? 'cancelled' : 'status_changed',
      actor_profile_id: profile.id,
      actor_role: profile.role,
      old_status: workOrder.statut,
      new_status: actionConfig.to,
      event_data: { action, ...validationResult.data },
      description: `Action "${action}" effectuée`,
    }).catch(err => {
      console.error('Error adding timeline event:', err);
    });

    // Créer une notification pour l'autre partie
    const notifyProfileId = isProvider 
      ? workOrder.ticket?.properties?.owner_id 
      : workOrder.provider_id;

    if (notifyProfileId) {
      const notificationMessages: Record<string, { title: string; message: string }> = {
        accept: { title: 'Mission acceptée', message: 'Le prestataire a accepté la mission' },
        refuse: { title: 'Mission refusée', message: 'Le prestataire a refusé la mission' },
        schedule_visit: { title: 'Visite planifiée', message: `Visite planifiée pour le ${visit_date}` },
        complete_visit: { title: 'Visite effectuée', message: 'La visite a été effectuée' },
        start_work: { title: 'Travaux commencés', message: 'Les travaux ont commencé' },
        complete_work: { title: 'Travaux terminés', message: 'Les travaux sont terminés' },
        close: { title: 'Intervention clôturée', message: 'L\'intervention a été clôturée' },
        cancel: { title: 'Intervention annulée', message: 'L\'intervention a été annulée' },
      };

      const notif = notificationMessages[action];
      if (notif) {
        await supabase.from('notifications').insert({
          profile_id: notifyProfileId,
          type: `work_order_${action}`,
          title: notif.title,
          message: notif.message,
          data: { work_order_id: workOrderId, action },
        }).catch(err => {
          console.error('Error creating notification:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      old_status: workOrder.statut,
      new_status: actionConfig.to,
      message: `Action "${action}" effectuée avec succès`,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/work-orders/[id]/flow:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/work-orders/[id]/flow
 * Récupère l'état actuel et les actions possibles
 */
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

    // Récupérer le work_order avec timeline
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select(`
        *,
        ticket:tickets(
          id,
          titre,
          property_id,
          properties(owner_id, adresse_complete, ville)
        ),
        provider:profiles!work_orders_provider_id_fkey(id, prenom, nom)
      `)
      .eq('id', workOrderId)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 });
    }

    // Récupérer le timeline
    const { data: timeline } = await supabase
      .from('work_order_timeline')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Récupérer les paiements
    const { data: payments } = await supabase
      .from('work_order_payments')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });

    // Déterminer les actions possibles
    const isProvider = workOrder.provider_id === profile.id;
    const isOwner = workOrder.ticket?.properties?.owner_id === profile.id;
    const currentStatus = workOrder.statut;

    const availableActions: string[] = [];

    // Actions prestataire
    if (isProvider) {
      if (currentStatus === 'assigned') availableActions.push('accept', 'refuse');
      if (currentStatus === 'visit_scheduled') availableActions.push('complete_visit');
      if (['deposit_paid', 'work_scheduled'].includes(currentStatus)) availableActions.push('start_work');
      if (currentStatus === 'in_progress') availableActions.push('complete_work');
    }

    // Actions propriétaire
    if (isOwner) {
      if (currentStatus === 'accepted') availableActions.push('schedule_visit');
      if (currentStatus === 'fully_paid') availableActions.push('request_review', 'close');
      if (currentStatus === 'pending_review') availableActions.push('close');
      if (['assigned', 'accepted', 'visit_scheduled'].includes(currentStatus)) {
        availableActions.push('cancel');
      }
    }

    return NextResponse.json({
      work_order: {
        id: workOrder.id,
        status: currentStatus,
        ticket: workOrder.ticket,
        provider: workOrder.provider,
        dates: {
          created_at: workOrder.created_at,
          accepted_at: workOrder.accepted_at,
          visit_scheduled_at: workOrder.visit_scheduled_at,
          visit_completed_at: workOrder.visit_completed_at,
          work_started_at: workOrder.work_started_at,
          work_completed_at: workOrder.work_completed_at,
          closed_at: workOrder.closed_at,
        },
        costs: {
          estimated: workOrder.cout_estime,
          final: workOrder.cout_final,
        },
      },
      available_actions: availableActions,
      timeline: timeline || [],
      payments: payments || [],
      user_role: isProvider ? 'provider' : isOwner ? 'owner' : 'other',
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/work-orders/[id]/flow:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

