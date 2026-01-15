export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { error, user, profile, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 403 }
      );
    }

    if (!user || !profile || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const propertyId = params.id;

    const body = await request.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : null;

    if (!reason) {
      return NextResponse.json(
        { error: "Un motif de rejet est requis" },
        { status: 400 }
      );
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    if (!["pending", "published"].includes(property.etat)) {
      // Permettre le rejet même après publication (pour retrait), sinon restreindre aux pending
      return NextResponse.json(
        { error: "Le logement ne peut pas être rejeté dans son état actuel" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { data: updatedProperty, error: updateError } = await supabase
      .from("properties")
      .update({
        etat: "rejected",
        validated_at: now,
        validated_by: (profile as any).id,
        rejection_reason: reason,
      })
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de rejeter le logement" },
        { status: 500 }
      );
    }

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "property_rejected",
      entity_type: "property",
      entity_id: propertyId,
      metadata: {
        previous_status: property.etat,
        new_status: "rejected",
        reason,
      },
    });

    return NextResponse.json({ property: updatedProperty });
  } catch (error: any) {
    console.error("Error in POST /api/admin/properties/[id]/reject:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

