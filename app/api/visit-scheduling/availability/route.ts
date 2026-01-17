export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import {
  createAvailabilityPatternSchema,
  updateAvailabilityPatternSchema,
} from "@/lib/validations";

/**
 * GET /api/visit-scheduling/availability
 * Récupère les patterns de disponibilité du propriétaire
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

    // Récupérer le profil propriétaire
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || (profile as any).role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const activeOnly = searchParams.get("active_only") === "true";

    let query = supabaseClient
      .from("owner_availability_patterns")
      .select("*")
      .eq("owner_id", (profile as any).id as any)
      .order("created_at", { ascending: false });

    if (propertyId) {
      query = query.eq("property_id", propertyId as any);
    }

    if (activeOnly) {
      query = query.eq("is_active", true as any);
    }

    const { data: patterns, error } = await query;

    if (error) throw error;

    return NextResponse.json({ patterns });
  } catch (error: unknown) {
    console.error("GET /api/visit-scheduling/availability error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/visit-scheduling/availability
 * Crée un nouveau pattern de disponibilité
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

    // Récupérer le profil propriétaire
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || (profile as any).role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = createAvailabilityPatternSchema.parse(body);

    // Vérifier que la propriété appartient au propriétaire (si spécifiée)
    if (validated.property_id) {
      const { data: property } = await supabaseClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", validated.property_id as any)
        .single();

      if (!property || (property as any).owner_id !== (profile as any).id) {
        return NextResponse.json(
          { error: "Propriété non trouvée ou accès non autorisé" },
          { status: 404 }
        );
      }
    }

    // Créer le pattern
    const { data: pattern, error } = await supabaseClient
      .from("owner_availability_patterns")
      .insert({
        owner_id: (profile as any).id,
        ...validated,
        valid_from: validated.valid_from || new Date().toISOString().split("T")[0],
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Générer les créneaux pour les 30 prochains jours si une propriété est spécifiée
    if (validated.property_id) {
      const today = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      await supabaseClient.rpc("generate_visit_slots", {
        p_property_id: validated.property_id,
        p_start_date: today,
        p_end_date: endDate,
      });
    }

    // Émettre un événement
    await supabaseClient.from("outbox").insert({
      event_type: "VisitScheduling.PatternCreated",
      payload: {
        pattern_id: (pattern as any).id,
        owner_id: (profile as any).id,
        property_id: validated.property_id,
      },
    } as any);

    return NextResponse.json({ pattern }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/visit-scheduling/availability error:", error);
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
