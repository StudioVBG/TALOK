export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/leases/[id]/roommates/replace
 *
 * Workflow complet de remplacement d'un colocataire :
 * 1. Départ du colocataire sortant (left_on, désactivation signataire)
 * 2. Création d'un EDL partiel (pièce(s) du colocataire sortant)
 * 3. Calcul de la restitution partielle du dépôt de garantie
 * 4. Entrée du nouveau colocataire (roommate + signataire + invitation)
 * 5. Création automatique d'un avenant (si table lease_amendments existe)
 * 6. Recalcul des parts de paiement
 *
 * Obligations légales :
 * - Avenant obligatoire pour toute modification des parties au bail
 * - EDL contradictoire pour la chambre du sortant
 * - Restitution DG proportionnelle au sortant (sauf clause de solidarité)
 */

const replaceRoommateSchema = z.object({
  // Colocataire sortant
  departing_roommate_id: z.string().uuid(),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure_rooms: z.array(z.string()).optional(), // Pièces pour EDL partiel

  // Colocataire entrant
  new_roommate: z.object({
    email: z.string().email(),
    name: z.string().optional(),
    room_label: z.string().optional(),
    weight: z.number().min(0).max(1).optional(),
    has_guarantor: z.boolean().optional(),
    guarantor_email: z.string().email().optional(),
    guarantor_name: z.string().optional(),
  }),

  // Options
  partial_deposit_refund: z.boolean().default(true),
  create_partial_edl: z.boolean().default(true),
  solidarity_clause: z.boolean().default(false), // Clause de solidarité active
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = replaceRoommateSchema.parse(body);

    const serviceClient = getServiceClient();

    // 1. Vérifier les droits (propriétaire uniquement)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut gérer le remplacement" },
        { status: 403 }
      );
    }

    // 2. Vérifier le bail
    const { data: lease } = await serviceClient
      .from("leases")
      .select(`
        id, statut, type_bail, depot_de_garantie, loyer,
        property_id,
        properties:properties!leases_property_id_fkey (id, owner_id, adresse_complete)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease || !["active", "notice_given"].includes(lease.statut)) {
      return NextResponse.json(
        { error: "Le bail doit être actif pour remplacer un colocataire" },
        { status: 400 }
      );
    }

    // 3. Vérifier le colocataire sortant
    const { data: departingRoommate } = await serviceClient
      .from("roommates")
      .select("*, profile:profiles!roommates_profile_id_fkey(id, user_id, prenom, nom, email)")
      .eq("id", validated.departing_roommate_id)
      .eq("lease_id", leaseId)
      .single();

    if (!departingRoommate) {
      return NextResponse.json(
        { error: "Colocataire sortant non trouvé dans ce bail" },
        { status: 404 }
      );
    }

    if (departingRoommate.left_on) {
      return NextResponse.json(
        { error: "Ce colocataire a déjà quitté le bail" },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {
      departing: {},
      incoming: {},
      edl: null,
      deposit: null,
      amendment: null,
    };

    // ── STEP 1: Enregistrer le départ ──
    await serviceClient
      .from("roommates")
      .update({ left_on: validated.departure_date })
      .eq("id", validated.departing_roommate_id);

    // Désactiver le signataire correspondant
    if (departingRoommate.profile_id) {
      await serviceClient
        .from("lease_signers")
        .update({
          is_active: false,
          metadata: {
            departed_on: validated.departure_date,
            replaced: true,
          },
        } as any)
        .eq("lease_id", leaseId)
        .eq("profile_id", departingRoommate.profile_id);
    }

    results.departing = {
      roommate_id: validated.departing_roommate_id,
      name: departingRoommate.profile
        ? `${(departingRoommate.profile as any).prenom} ${(departingRoommate.profile as any).nom}`
        : departingRoommate.name,
      departure_date: validated.departure_date,
    };

    // ── STEP 2: EDL partiel (chambre du sortant) ──
    if (validated.create_partial_edl) {
      const { data: partialEdl } = await serviceClient
        .from("edl")
        .insert({
          lease_id: leaseId,
          property_id: lease.property_id,
          type: "sortie",
          status: "draft",
          scheduled_date: validated.departure_date,
          metadata: {
            partial: true,
            type: "roommate_departure",
            roommate_id: validated.departing_roommate_id,
            rooms: validated.departure_rooms || [departingRoommate.room_label || "chambre"],
            departing_name: results.departing.name,
          },
        } as any)
        .select()
        .single();

      results.edl = partialEdl ? {
        id: partialEdl.id,
        type: "sortie_partielle",
        rooms: validated.departure_rooms || [departingRoommate.room_label || "chambre"],
        status: "draft",
      } : null;
    }

    // ── STEP 3: Calcul restitution partielle DG ──
    if (validated.partial_deposit_refund && !validated.solidarity_clause) {
      const { data: allRoommates } = await serviceClient
        .from("roommates")
        .select("id, weight")
        .eq("lease_id", leaseId)
        .is("left_on", null);

      // Nombre total de colocataires AVANT le départ
      const totalBefore = (allRoommates?.length || 0) + 1;
      const depositTotal = (lease as any).depot_de_garantie || 0;
      const departingWeight = departingRoommate.weight || (1 / totalBefore);
      const refundAmount = Math.round(depositTotal * departingWeight * 100) / 100;

      // Enregistrer l'opération de DG
      const { data: depositOp } = await serviceClient
        .from("deposit_operations")
        .insert({
          lease_id: leaseId,
          operation_type: "partial_refund",
          amount: refundAmount,
          date: validated.departure_date,
          description: `Restitution partielle DG - Départ de ${results.departing.name}`,
          metadata: {
            roommate_id: validated.departing_roommate_id,
            weight: departingWeight,
            total_deposit: depositTotal,
            solidarity_clause: false,
          },
        } as any)
        .select()
        .single();

      results.deposit = {
        refund_amount: refundAmount,
        total_deposit: depositTotal,
        weight: departingWeight,
        operation_id: depositOp?.id,
        note: "Restitution proportionnelle au poids du colocataire sortant",
      };
    } else if (validated.solidarity_clause) {
      results.deposit = {
        refund_amount: 0,
        note: "Clause de solidarité active : le DG n'est restitué qu'à la fin du bail pour tous les colocataires",
      };
    }

    // ── STEP 4: Entrée du nouveau colocataire ──
    // Chercher ou créer le profil
    let newProfileId: string | null = null;
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", validated.new_roommate.email)
      .maybeSingle();

    if (existingProfile) {
      newProfileId = existingProfile.id;
    }

    // Créer le roommate
    const activeRoommates = await serviceClient
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId)
      .is("left_on", null);

    const totalActive = (activeRoommates.data?.length || 0) + 1; // +1 pour le nouveau
    const defaultWeight = 1 / totalActive;

    const { data: newRoommate } = await serviceClient
      .from("roommates")
      .insert({
        lease_id: leaseId,
        profile_id: newProfileId,
        email: validated.new_roommate.email,
        name: validated.new_roommate.name || validated.new_roommate.email,
        role: "tenant",
        weight: validated.new_roommate.weight || defaultWeight,
        room_label: validated.new_roommate.room_label || departingRoommate.room_label,
        joined_on: validated.departure_date,
      } as any)
      .select()
      .single();

    // Créer le signataire
    const { data: newSigner } = await serviceClient
      .from("lease_signers")
      .insert({
        lease_id: leaseId,
        role: "colocataire",
        invited_email: validated.new_roommate.email,
        profile_id: newProfileId,
        signature_status: "pending",
        metadata: {
          joined_on: validated.departure_date,
          replaces_roommate: validated.departing_roommate_id,
        },
      } as any)
      .select()
      .single();

    results.incoming = {
      roommate_id: newRoommate?.id,
      signer_id: newSigner?.id,
      email: validated.new_roommate.email,
      room: validated.new_roommate.room_label || departingRoommate.room_label,
      weight: validated.new_roommate.weight || defaultWeight,
    };

    // ── STEP 5: Créer un avenant automatique ──
    try {
      const { data: amendment } = await serviceClient
        .from("lease_amendments")
        .insert({
          lease_id: leaseId,
          amendment_type: "occupant_retrait",
          status: "draft",
          description: `Remplacement de colocataire : départ de ${results.departing.name}, arrivée de ${validated.new_roommate.name || validated.new_roommate.email}`,
          old_values: {
            departing_roommate: {
              id: validated.departing_roommate_id,
              name: results.departing.name,
              weight: departingRoommate.weight,
              room: departingRoommate.room_label,
            },
          },
          new_values: {
            incoming_roommate: {
              email: validated.new_roommate.email,
              name: validated.new_roommate.name,
              weight: validated.new_roommate.weight || defaultWeight,
              room: validated.new_roommate.room_label || departingRoommate.room_label,
            },
          },
          effective_date: validated.departure_date,
          created_by: user.id,
        } as any)
        .select()
        .single();

      results.amendment = amendment ? {
        id: amendment.id,
        status: "draft",
        note: "Avenant créé automatiquement — à signer par toutes les parties",
      } : null;
    } catch {
      // Table lease_amendments peut ne pas exister
      results.amendment = null;
    }

    // ── STEP 6: Recalculer les parts de paiement ──
    try {
      await serviceClient.rpc("recalculate_payment_shares", {
        p_lease_id: leaseId,
        p_month: new Date().toISOString().slice(0, 7) + "-01",
        p_trigger_type: "roommate_replaced",
        p_triggered_by: validated.departing_roommate_id,
        p_created_by: user.id,
      });
    } catch {
      // RPC peut ne pas exister, les parts seront gérées manuellement
    }

    // ── Audit & Outbox ──
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "roommate_replaced",
      entity_type: "lease",
      entity_id: leaseId,
      metadata: {
        departing: results.departing,
        incoming: results.incoming,
        deposit: results.deposit,
        edl_created: !!results.edl,
        amendment_created: !!results.amendment,
      },
    });

    await serviceClient.from("outbox").insert({
      event_type: "Lease.RoommateReplaced",
      aggregate_id: leaseId,
      payload: {
        lease_id: leaseId,
        departing_roommate_id: validated.departing_roommate_id,
        new_roommate_email: validated.new_roommate.email,
        departure_date: validated.departure_date,
      },
    });

    // Notifier le colocataire sortant
    if ((departingRoommate.profile as any)?.user_id) {
      await serviceClient.from("notifications").insert({
        user_id: (departingRoommate.profile as any).user_id,
        type: "roommate_departure_confirmed",
        title: "Votre départ est enregistré",
        message: `Votre départ de la colocation à ${(lease as any).properties?.adresse_complete} est enregistré pour le ${validated.departure_date}.${results.deposit?.refund_amount ? ` Restitution DG prévue : ${results.deposit.refund_amount}€.` : ""}`,
        data: {
          lease_id: leaseId,
          departure_date: validated.departure_date,
          deposit_refund: results.deposit?.refund_amount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Remplacement de colocataire enregistré",
      ...results,
      next_steps: [
        results.edl ? "Réaliser l'EDL partiel de sortie" : null,
        results.amendment ? "Faire signer l'avenant par toutes les parties" : null,
        results.deposit?.refund_amount ? `Restituer ${results.deposit.refund_amount}€ de DG au sortant` : null,
        "Le nouveau colocataire recevra une invitation par email",
      ].filter(Boolean),
    });
  } catch (error: unknown) {
    console.error("[roommate-replace] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
