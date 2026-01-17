export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendTicketUpdateNotification } from "@/lib/emails";

/**
 * POST /api/work-orders/[id]/accept
 * Accepter une demande d'intervention (pour prestataires)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil et vérifier le rôle
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "provider") {
      return NextResponse.json(
        { error: "Accès réservé aux prestataires" },
        { status: 403 }
      );
    }

    // Récupérer l'ordre de travail
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        *,
        ticket:tickets!inner(
          id,
          titre,
          property:properties!inner(
            owner_id,
            adresse_complete
          )
        )
      `)
      .eq("id", params.id)
      .eq("provider_id", profile.id)
      .single();

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: "Ordre de travail non trouvé ou non assigné à vous" },
        { status: 404 }
      );
    }

    const workOrderData = workOrder as any;

    // Vérifier que le statut permet l'acceptation
    if (workOrderData.statut !== "assigned") {
      return NextResponse.json(
        { error: `Impossible d'accepter un ordre au statut "${workOrderData.statut}"` },
        { status: 400 }
      );
    }

    // Récupérer la date d'intervention du body si fournie
    const body = await request.json().catch(() => ({}));
    const dateIntervention = body.date_intervention_prevue;

    // Mettre à jour le statut
    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update({
        statut: "scheduled",
        date_intervention_prevue: dateIntervention || null,
        accepted_at: new Date().toISOString(),
      } as any)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Mettre à jour le ticket en "in_progress"
    await supabase
      .from("tickets")
      .update({ statut: "in_progress" } as any)
      .eq("id", workOrderData.ticket_id);

    // Notifier le propriétaire
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("user_id, prenom, nom")
      .eq("id", workOrderData.ticket.property.owner_id)
      .single();

    if (ownerProfile) {
      const { data: ownerAuth } = await supabase.auth.admin.getUserById(ownerProfile.user_id);
      
      if (ownerAuth?.user?.email) {
        const providerName = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Prestataire";
        
        try {
          await sendTicketUpdateNotification({
            recipientEmail: ownerAuth.user.email,
            recipientName: `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire",
            ticketTitle: workOrderData.ticket.titre,
            newStatus: "En cours - Intervention programmée",
            updatedBy: providerName,
            comment: dateIntervention 
              ? `Intervention prévue le ${new Date(dateIntervention).toLocaleDateString("fr-FR")}`
              : "Le prestataire a accepté l'intervention",
            ticketId: workOrderData.ticket_id,
          });
        } catch (emailError) {
          console.error("[accept] Erreur envoi email:", emailError);
        }
      }
    }

    // Créer une notification
    await supabase.from("notifications").insert({
      profile_id: workOrderData.ticket.property.owner_id,
      type: "work_order_accepted",
      title: "Intervention acceptée",
      message: `Le prestataire a accepté l'intervention pour "${workOrderData.ticket.titre}"`,
      data: { workOrderId: params.id, ticketId: workOrderData.ticket_id },
    });

    return NextResponse.json({
      success: true,
      workOrder: updated,
      message: "Intervention acceptée avec succès",
    });
  } catch (error: unknown) {
    console.error("[accept] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

