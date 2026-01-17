export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour changer le statut d'une intervention
 * POST /api/provider/jobs/[id]/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

const updateStatusSchema = z.object({
  action: z.enum(['accept', 'reject', 'start', 'complete', 'cancel']),
  notes: z.string().optional(),
  final_cost: z.number().min(0).optional(),
  scheduled_date: z.string().optional(),
});

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

    // Récupérer le profil
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
    const validationResult = updateStatusSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { action, notes, final_cost, scheduled_date } = validationResult.data;

    // Récupérer le work_order
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .eq('provider_id', profile.id)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json({ error: 'Intervention non trouvée' }, { status: 404 });
    }

    // Déterminer le nouveau statut et les mises à jour
    let updateData: Record<string, any> = {};
    let newStatus: string;

    switch (action) {
      case 'accept':
        if (workOrder.statut !== 'assigned') {
          return NextResponse.json(
            { error: 'Cette intervention ne peut pas être acceptée' },
            { status: 400 }
          );
        }
        newStatus = 'scheduled';
        updateData = {
          statut: newStatus,
          accepted_at: new Date().toISOString(),
          date_intervention_prevue: scheduled_date || null,
        };
        break;

      case 'reject':
        if (!['assigned', 'scheduled'].includes(workOrder.statut)) {
          return NextResponse.json(
            { error: 'Cette intervention ne peut pas être refusée' },
            { status: 400 }
          );
        }
        newStatus = 'cancelled';
        updateData = {
          statut: newStatus,
          notes: notes || 'Refusé par le prestataire',
        };
        break;

      case 'start':
        if (workOrder.statut !== 'scheduled') {
          return NextResponse.json(
            { error: 'Cette intervention ne peut pas être démarrée' },
            { status: 400 }
          );
        }
        newStatus = 'in_progress';
        updateData = {
          statut: newStatus,
          actual_start_at: new Date().toISOString(),
        };
        break;

      case 'complete':
        if (workOrder.statut !== 'in_progress') {
          return NextResponse.json(
            { error: 'Cette intervention ne peut pas être terminée' },
            { status: 400 }
          );
        }
        newStatus = 'done';
        updateData = {
          statut: newStatus,
          date_intervention_reelle: new Date().toISOString().split('T')[0],
          actual_end_at: new Date().toISOString(),
          cout_final: final_cost || workOrder.cout_estime,
          notes: notes || workOrder.notes,
        };
        break;

      case 'cancel':
        if (workOrder.statut === 'done') {
          return NextResponse.json(
            { error: 'Cette intervention est déjà terminée' },
            { status: 400 }
          );
        }
        newStatus = 'cancelled';
        updateData = {
          statut: newStatus,
          notes: notes || 'Annulé',
        };
        break;

      default:
        return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 });
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

    // Créer une notification pour le propriétaire
    const { data: ticket } = await supabase
      .from('tickets')
      .select('property_id, properties!inner(owner_id)')
      .eq('id', workOrder.ticket_id)
      .single();

    if (ticket?.properties?.owner_id) {
      const actionLabels: Record<string, string> = {
        accept: 'acceptée',
        start: 'démarrée',
        complete: 'terminée',
        reject: 'refusée',
        cancel: 'annulée',
      };

      await supabase.from('notifications').insert({
        profile_id: ticket.properties.owner_id,
        type: 'work_order_status',
        title: `Intervention ${actionLabels[action]}`,
        message: `L'intervention a été ${actionLabels[action]} par le prestataire.`,
        data: {
          work_order_id: workOrderId,
          action,
          new_status: newStatus,
        },
      }).catch(() => {
        // Ignorer les erreurs de notification
      });
    }

    return NextResponse.json({
      success: true,
      new_status: newStatus,
      message: `Intervention mise à jour avec succès`,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/jobs/[id]/status:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

