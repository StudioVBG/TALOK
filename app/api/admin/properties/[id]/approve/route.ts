export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * POST /api/admin/properties/[id]/approve - Approuver un logement
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, user, profile, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 403 }
      );
    }

    if (!user || !profile || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const propertyId = id;

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    if (property.etat !== "pending") {
      return NextResponse.json(
        { error: "Le logement n'est pas en attente de validation" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedProperty, error: updateError } = await supabase
      .from("properties")
      .update({
        etat: "published",
        validated_at: now,
        validated_by: (profile as any).id,
        rejection_reason: null,
      })
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible d'approuver le logement" },
        { status: 500 }
      );
    }

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "property_published",
      entity_type: "property",
      entity_id: propertyId,
      metadata: {
        previous_status: property.etat,
        new_status: "published",
      },
    });

    return NextResponse.json({ property: updatedProperty });
  } catch (error: unknown) {
    console.error("Error in POST /api/admin/properties/[id]/approve:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

