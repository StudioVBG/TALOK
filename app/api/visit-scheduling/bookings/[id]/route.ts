export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import {
  updateVisitBookingSchema,
  cancelVisitBookingSchema,
  visitFeedbackSchema,
} from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/visit-scheduling/bookings/[id]
 * Récupère une réservation spécifique
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: booking, error } = await supabaseClient
      .from("visit_bookings")
      .select(`
        *,
        slot:visit_slots!slot_id(*),
        property:properties!property_id(
          id,
          adresse_complete,
          ville,
          code_postal,
          cover_url,
          owner_id
        ),
        tenant:profiles!tenant_id(
          id,
          prenom,
          nom,
          telephone,
          email
        )
      `)
      .eq("id", id as any)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking });
  } catch (error: unknown) {
    console.error("GET /api/visit-scheduling/bookings/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/visit-scheduling/bookings/[id]
 * Met à jour une réservation (propriétaire: confirmer/annuler/compléter)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer la réservation existante
    const { data: existingBooking } = await supabaseClient
      .from("visit_bookings")
      .select(`
        *,
        slot:visit_slots!slot_id(*),
        property:properties!property_id(id, owner_id, adresse_complete)
      `)
      .eq("id", id as any)
      .single();

    if (!existingBooking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const isOwner = (profile as any).role === "owner";
    const isTenant = (profile as any).role === "tenant";

    // Vérifier les permissions
    if (isOwner) {
      // Le propriétaire peut modifier les réservations de ses biens
      if ((existingBooking as any).property?.owner_id !== (profile as any).id) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        );
      }

      const validated = updateVisitBookingSchema.parse(body);

      const updateData: any = {
        owner_notes: validated.owner_notes,
        updated_at: new Date().toISOString(),
      };

      if (validated.status) {
        updateData.status = validated.status;

        if (validated.status === "confirmed") {
          updateData.confirmed_at = new Date().toISOString();
        } else if (validated.status === "cancelled") {
          updateData.cancelled_at = new Date().toISOString();
          updateData.cancelled_by = (profile as any).id;
          updateData.cancellation_reason = validated.cancellation_reason;

          // Libérer le créneau via la fonction cancel_visit_booking
          await supabaseClient.rpc("cancel_visit_booking", {
            p_booking_id: id,
            p_cancelled_by: (profile as any).id,
            p_reason: validated.cancellation_reason || "Annulé par le propriétaire",
          });

          // Retourner la réservation mise à jour
          const { data: updatedBooking } = await supabaseClient
            .from("visit_bookings")
            .select("*")
            .eq("id", id as any)
            .single();

          // Émettre un événement
          await supabaseClient.from("outbox").insert({
            event_type: "VisitScheduling.BookingCancelled",
            payload: {
              booking_id: id,
              cancelled_by: "owner",
              reason: validated.cancellation_reason,
              tenant_id: (existingBooking as any).tenant_id,
            },
          } as any);

          return NextResponse.json({ booking: updatedBooking });
        } else if (validated.status === "completed") {
          updateData.completed_at = new Date().toISOString();

          // Mettre à jour le statut du créneau
          await supabaseClient
            .from("visit_slots")
            .update({ status: "completed" } as any)
            .eq("id", (existingBooking as any).slot_id as any);
        }
      }

      const { data: booking, error } = await supabaseClient
        .from("visit_bookings")
        .update(updateData)
        .eq("id", id as any)
        .select()
        .single();

      if (error) throw error;

      // Émettre un événement si confirmé
      if (validated.status === "confirmed") {
        await supabaseClient.from("outbox").insert({
          event_type: "VisitScheduling.BookingConfirmed",
          payload: {
            booking_id: id,
            tenant_id: (existingBooking as any).tenant_id,
            property_address: (existingBooking as any).property?.adresse_complete,
            visit_date: (existingBooking as any).slot?.slot_date,
            visit_time: (existingBooking as any).slot?.start_time,
          },
        } as any);
      }

      return NextResponse.json({ booking });
    } else if (isTenant) {
      // Le locataire peut annuler sa propre réservation ou laisser un feedback
      if ((existingBooking as any).tenant_id !== (profile as any).id) {
        return NextResponse.json(
          { error: "Accès non autorisé" },
          { status: 403 }
        );
      }

      // Vérifier si c'est un feedback (après visite complétée)
      if (body.feedback_rating !== undefined) {
        if ((existingBooking as any).status !== "completed") {
          return NextResponse.json(
            { error: "Le feedback n'est possible qu'après une visite complétée" },
            { status: 400 }
          );
        }

        const validated = visitFeedbackSchema.parse(body);

        const { data: booking, error } = await supabaseClient
          .from("visit_bookings")
          .update({
            feedback_rating: validated.feedback_rating,
            feedback_comment: validated.feedback_comment,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", id as any)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ booking });
      }

      // Sinon, c'est une annulation
      const validated = cancelVisitBookingSchema.parse(body);

      // Vérifier que la visite peut encore être annulée
      if (!["pending", "confirmed"].includes((existingBooking as any).status)) {
        return NextResponse.json(
          { error: "Cette réservation ne peut plus être annulée" },
          { status: 400 }
        );
      }

      // Utiliser la fonction cancel_visit_booking
      await supabaseClient.rpc("cancel_visit_booking", {
        p_booking_id: id,
        p_cancelled_by: (profile as any).id,
        p_reason: validated.cancellation_reason || "Annulé par le locataire",
      });

      const { data: booking } = await supabaseClient
        .from("visit_bookings")
        .select("*")
        .eq("id", id as any)
        .single();

      // Émettre un événement
      await supabaseClient.from("outbox").insert({
        event_type: "VisitScheduling.BookingCancelled",
        payload: {
          booking_id: id,
          cancelled_by: "tenant",
          reason: validated.cancellation_reason,
          owner_id: (existingBooking as any).property?.owner_id,
        },
      } as any);

      return NextResponse.json({ booking });
    } else {
      return NextResponse.json(
        { error: "Rôle non autorisé" },
        { status: 403 }
      );
    }
  } catch (error: unknown) {
    console.error("PUT /api/visit-scheduling/bookings/[id] error:", error);
    if (error.name === "ZodError") {
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

/**
 * DELETE /api/visit-scheduling/bookings/[id]
 * Annule une réservation (raccourci pour PUT avec status=cancelled)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer la réservation
    const { data: booking } = await supabaseClient
      .from("visit_bookings")
      .select(`
        *,
        property:properties!property_id(id, owner_id)
      `)
      .eq("id", id as any)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const isOwner =
      (profile as any).role === "owner" &&
      (booking as any).property?.owner_id === (profile as any).id;
    const isTenant =
      (profile as any).role === "tenant" &&
      (booking as any).tenant_id === (profile as any).id;

    if (!isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier que la visite peut être annulée
    if (!["pending", "confirmed"].includes((booking as any).status)) {
      return NextResponse.json(
        { error: "Cette réservation ne peut plus être annulée" },
        { status: 400 }
      );
    }

    // Utiliser la fonction cancel_visit_booking
    await supabaseClient.rpc("cancel_visit_booking", {
      p_booking_id: id,
      p_cancelled_by: (profile as any).id,
      p_reason: isOwner ? "Annulé par le propriétaire" : "Annulé par le locataire",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/visit-scheduling/bookings/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
