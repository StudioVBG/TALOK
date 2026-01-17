export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendTicketUpdateNotification } from "@/lib/emails";

/**
 * POST /api/work-orders/[id]/complete
 * Marquer une intervention comme terminée (pour prestataires)
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
          created_by_profile_id,
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

    // Vérifier que le statut permet la complétion
    if (workOrderData.statut !== "scheduled") {
      return NextResponse.json(
        { error: `Impossible de terminer un ordre au statut "${workOrderData.statut}"` },
        { status: 400 }
      );
    }

    // Récupérer les détails de completion
    const body = await request.json().catch(() => ({}));
    const { cout_final, notes, date_intervention_reelle } = body;

    // Mettre à jour le statut
    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update({
        statut: "done",
        cout_final: cout_final || workOrderData.cout_estime,
        notes: notes || null,
        date_intervention_reelle: date_intervention_reelle || new Date().toISOString().split("T")[0],
        completed_at: new Date().toISOString(),
      } as any)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Mettre à jour le ticket en "resolved"
    await supabase
      .from("tickets")
      .update({ statut: "resolved" } as any)
      .eq("id", workOrderData.ticket_id);

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Ticket.Done",
      payload: {
        ticket_id: workOrderData.ticket_id,
        work_order_id: params.id,
      },
    } as any);

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
        const finalCost = cout_final || workOrderData.cout_estime;
        
        try {
          await sendTicketUpdateNotification({
            recipientEmail: ownerAuth.user.email,
            recipientName: `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire",
            ticketTitle: workOrderData.ticket.titre,
            newStatus: "Résolu - Intervention terminée",
            updatedBy: providerName,
            comment: finalCost 
              ? `Intervention terminée. Coût final : ${finalCost}€${notes ? `\n${notes}` : ""}`
              : notes || "L'intervention a été réalisée avec succès",
            ticketId: workOrderData.ticket_id,
          });
        } catch (emailError) {
          console.error("[complete] Erreur envoi email:", emailError);
        }
      }
    }

    // Notifier aussi le créateur du ticket si différent du propriétaire
    if (workOrderData.ticket.created_by_profile_id !== workOrderData.ticket.property.owner_id) {
      const { data: creatorProfile } = await supabase
        .from("profiles")
        .select("user_id, prenom, nom")
        .eq("id", workOrderData.ticket.created_by_profile_id)
        .single();

      if (creatorProfile) {
        const { data: creatorAuth } = await supabase.auth.admin.getUserById(creatorProfile.user_id);
        
        if (creatorAuth?.user?.email) {
          try {
            await sendTicketUpdateNotification({
              recipientEmail: creatorAuth.user.email,
              recipientName: `${creatorProfile.prenom || ""} ${creatorProfile.nom || ""}`.trim() || "Utilisateur",
              ticketTitle: workOrderData.ticket.titre,
              newStatus: "Résolu",
              updatedBy: "Le prestataire",
              comment: "L'intervention a été réalisée. Votre demande est maintenant résolue.",
              ticketId: workOrderData.ticket_id,
            });
          } catch (emailError) {
            console.error("[complete] Erreur envoi email créateur:", emailError);
          }
        }
      }
    }

    // Créer une notification
    await supabase.from("notifications").insert({
      profile_id: workOrderData.ticket.property.owner_id,
      type: "work_order_completed",
      title: "Intervention terminée",
      message: `L'intervention pour "${workOrderData.ticket.titre}" a été réalisée`,
      data: { 
        workOrderId: params.id, 
        ticketId: workOrderData.ticket_id,
        cout_final: cout_final || workOrderData.cout_estime,
      },
    });

    return NextResponse.json({
      success: true,
      workOrder: updated,
      message: "Intervention marquée comme terminée",
    });
  } catch (error: unknown) {
    console.error("[complete] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

