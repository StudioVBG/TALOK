export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { createVisitBookingSchema } from "@/lib/validations";

/**
 * GET /api/visit-scheduling/bookings
 * Récupère les réservations de visites
 * - Pour les propriétaires: toutes les réservations de leurs biens
 * - Pour les locataires: leurs propres réservations
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const status = searchParams.get("status");
    const upcoming = searchParams.get("upcoming") === "true";

    // Récupérer le profil
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const isOwner = (profile as any).role === "owner";
    const isTenant = (profile as any).role === "tenant";

    let query = supabaseClient
      .from("visit_bookings")
      .select(`
        *,
        slot:visit_slots!slot_id(
          id,
          slot_date,
          start_time,
          end_time,
          status
        ),
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
      .order("booked_at", { ascending: false });

    // Filtrer selon le rôle
    if (isOwner) {
      // Le propriétaire voit les réservations de ses biens
      const { data: properties } = await supabaseClient
        .from("properties")
        .select("id")
        .eq("owner_id", (profile as any).id as any);

      const propertyIds = (properties || []).map((p: any) => p.id);

      if (propertyId) {
        // Vérifier que la propriété appartient au propriétaire
        if (!propertyIds.includes(propertyId)) {
          return NextResponse.json(
            { error: "Accès non autorisé à cette propriété" },
            { status: 403 }
          );
        }
        query = query.eq("property_id", propertyId as any);
      } else {
        query = query.in("property_id", propertyIds as any);
      }
    } else if (isTenant) {
      // Le locataire voit ses propres réservations
      query = query.eq("tenant_id", (profile as any).id as any);

      if (propertyId) {
        query = query.eq("property_id", propertyId as any);
      }
    } else {
      return NextResponse.json(
        { error: "Rôle non autorisé" },
        { status: 403 }
      );
    }

    // Filtrer par statut
    if (status) {
      query = query.eq("status", status as any);
    }

    // Filtrer les visites à venir
    if (upcoming) {
      const now = new Date().toISOString();
      query = query
        .in("status", ["pending", "confirmed"] as any)
        .gte("slot.start_time", now as any);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    // Statistiques pour le propriétaire
    let stats = null;
    if (isOwner) {
      const allBookings = bookings || [];
      stats = {
        total: allBookings.length,
        pending: allBookings.filter((b: any) => b.status === "pending").length,
        confirmed: allBookings.filter((b: any) => b.status === "confirmed").length,
        completed: allBookings.filter((b: any) => b.status === "completed").length,
        cancelled: allBookings.filter((b: any) => b.status === "cancelled").length,
        noShow: allBookings.filter((b: any) => b.status === "no_show").length,
      };
    }

    return NextResponse.json({
      bookings,
      stats,
      total: bookings?.length || 0,
    });
  } catch (error: unknown) {
    console.error("GET /api/visit-scheduling/bookings error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/visit-scheduling/bookings
 * Crée une nouvelle réservation de visite (locataire)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil locataire
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role, prenom, nom, email, telephone")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || (profile as any).role !== "tenant") {
      return NextResponse.json(
        { error: "Accès réservé aux locataires" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createVisitBookingSchema.parse(body);

    // Utiliser la fonction book_visit_slot pour une réservation atomique
    const { data: bookingId, error } = await supabaseClient.rpc(
      "book_visit_slot",
      {
        p_slot_id: validated.slot_id,
        p_tenant_id: (profile as any).id,
        p_message: validated.tenant_message || null,
        p_contact_phone: validated.contact_phone || (profile as any).telephone || null,
        p_contact_email: validated.contact_email || (profile as any).email || null,
        p_party_size: validated.party_size || 1,
      }
    );

    if (error) {
      // Gérer les erreurs métier
      if (error.message.includes("plus disponible")) {
        return NextResponse.json(
          { error: "Ce créneau n'est plus disponible" },
          { status: 409 }
        );
      }
      if (error.message.includes("déjà une réservation")) {
        return NextResponse.json(
          { error: "Vous avez déjà une réservation en cours pour ce bien" },
          { status: 409 }
        );
      }
      throw error;
    }

    // Récupérer la réservation complète
    const { data: booking } = await supabaseClient
      .from("visit_bookings")
      .select(`
        *,
        slot:visit_slots!slot_id(*),
        property:properties!property_id(
          id,
          adresse_complete,
          ville,
          owner_id
        )
      `)
      .eq("id", bookingId as any)
      .single();

    // Émettre des événements pour les notifications
    await supabaseClient.from("outbox").insert({
      event_type: "VisitScheduling.BookingCreated",
      payload: {
        booking_id: bookingId,
        slot_id: validated.slot_id,
        tenant_id: (profile as any).id,
        tenant_name: `${(profile as any).prenom} ${(profile as any).nom}`,
        property_id: (booking as any)?.property?.id,
        property_address: (booking as any)?.property?.adresse_complete,
        owner_id: (booking as any)?.property?.owner_id,
        visit_date: (booking as any)?.slot?.slot_date,
        visit_time: (booking as any)?.slot?.start_time,
      },
    } as any);

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/visit-scheduling/bookings error:", error);
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
