export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";
import { updateAvailabilityPatternSchema } from "@/lib/validations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/visit-scheduling/availability/[id]
 * Récupère un pattern de disponibilité spécifique
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

    const { data: pattern, error } = await supabaseClient
      .from("owner_availability_patterns")
      .select("*")
      .eq("id", id as any)
      .single();

    if (error || !pattern) {
      return NextResponse.json(
        { error: "Pattern non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json({ pattern });
  } catch (error: unknown) {
    console.error("GET /api/visit-scheduling/availability/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/visit-scheduling/availability/[id]
 * Met à jour un pattern de disponibilité
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

    // Vérifier que le pattern appartient au propriétaire
    const { data: existingPattern } = await supabaseClient
      .from("owner_availability_patterns")
      .select("*")
      .eq("id", id as any)
      .eq("owner_id", (profile as any).id as any)
      .single();

    if (!existingPattern) {
      return NextResponse.json(
        { error: "Pattern non trouvé ou accès non autorisé" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = updateAvailabilityPatternSchema.parse(body);

    const { data: pattern, error } = await supabaseClient
      .from("owner_availability_patterns")
      .update({
        ...validated,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Régénérer les créneaux si nécessaire
    const propertyId = (pattern as any).property_id;
    if (propertyId) {
      const today = new Date().toISOString().split("T")[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Supprimer les créneaux disponibles futurs pour ce pattern
      await supabaseClient
        .from("visit_slots")
        .delete()
        .eq("pattern_id", id as any)
        .eq("status", "available" as any)
        .gte("slot_date", today as any);

      // Régénérer
      await supabaseClient.rpc("generate_visit_slots", {
        p_property_id: propertyId,
        p_start_date: today,
        p_end_date: endDate,
      });
    }

    return NextResponse.json({ pattern });
  } catch (error: unknown) {
    console.error("PUT /api/visit-scheduling/availability/[id] error:", error);
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
 * DELETE /api/visit-scheduling/availability/[id]
 * Supprime un pattern de disponibilité
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

    // Vérifier que le pattern appartient au propriétaire
    const { data: existingPattern } = await supabaseClient
      .from("owner_availability_patterns")
      .select("id, property_id")
      .eq("id", id as any)
      .eq("owner_id", (profile as any).id as any)
      .single();

    if (!existingPattern) {
      return NextResponse.json(
        { error: "Pattern non trouvé ou accès non autorisé" },
        { status: 404 }
      );
    }

    // Supprimer les créneaux disponibles futurs générés par ce pattern
    const today = new Date().toISOString().split("T")[0];
    await supabaseClient
      .from("visit_slots")
      .delete()
      .eq("pattern_id", id as any)
      .eq("status", "available" as any)
      .gte("slot_date", today as any);

    // Supprimer le pattern
    const { error } = await supabaseClient
      .from("owner_availability_patterns")
      .delete()
      .eq("id", id as any);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("DELETE /api/visit-scheduling/availability/[id] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
