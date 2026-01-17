export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { getVisitSlotsQuerySchema, generateSlotsSchema } from "@/lib/validations";

/**
 * GET /api/visit-scheduling/slots
 * Récupère les créneaux disponibles pour une propriété
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const status = searchParams.get("status");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id est requis" },
        { status: 400 }
      );
    }

    // Validation avec Zod
    const queryParams = getVisitSlotsQuerySchema.parse({
      property_id: propertyId,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      status: status || undefined,
    });

    // Récupérer le profil pour vérifier le rôle
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const isOwner = (profile as any)?.role === "owner";

    // Déterminer les dates par défaut (30 jours)
    const today = new Date();
    const defaultStartDate = today.toISOString().split("T")[0];
    const defaultEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    let query = supabaseClient
      .from("visit_slots")
      .select(`
        *,
        property:properties!property_id(
          id,
          adresse_complete,
          ville,
          code_postal,
          cover_url
        )
      `)
      .eq("property_id", queryParams.property_id as any)
      .gte("slot_date", (queryParams.start_date || defaultStartDate) as any)
      .lte("slot_date", (queryParams.end_date || defaultEndDate) as any)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });

    // Les locataires ne voient que les créneaux disponibles
    if (!isOwner) {
      query = query.eq("status", "available" as any);
    } else if (queryParams.status) {
      query = query.eq("status", queryParams.status as any);
    }

    const { data: slots, error } = await query;

    if (error) throw error;

    // Grouper par date pour faciliter l'affichage
    const slotsByDate = (slots || []).reduce((acc: any, slot: any) => {
      const date = slot.slot_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {});

    return NextResponse.json({
      slots,
      slotsByDate,
      total: slots?.length || 0,
    });
  } catch (error: unknown) {
    console.error("GET /api/visit-scheduling/slots error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Paramètres invalides", details: error.errors },
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
 * POST /api/visit-scheduling/slots
 * Génère les créneaux pour une propriété (propriétaire uniquement)
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
    const validated = generateSlotsSchema.parse(body);

    // Vérifier que la propriété appartient au propriétaire
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

    // Générer les créneaux
    const { data: count, error } = await supabaseClient.rpc(
      "generate_visit_slots",
      {
        p_property_id: validated.property_id,
        p_start_date: validated.start_date,
        p_end_date: validated.end_date,
      }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      slotsGenerated: count,
      message: `${count} créneaux générés avec succès`,
    });
  } catch (error: unknown) {
    console.error("POST /api/visit-scheduling/slots error:", error);
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
