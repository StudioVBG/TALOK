export const runtime = 'nodejs';

/**
 * API Route: Mise à jour du statut locatif d'un logement
 * POST /api/properties/:id/status
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const statusSchema = z.object({
  rental_status: z.enum(["vacant", "end_of_lease", "renovation", "ready_to_rent", "occupied"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = statusSchema.parse(body);

    // Vérifier que le logement appartient bien à l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement non trouvé" }, { status: 404 });
    }

    if (property.owner_id !== profile.id) {
      return NextResponse.json({ error: "Ce logement ne vous appartient pas" }, { status: 403 });
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from("properties")
      .update({ rental_status: validatedData.rental_status })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true,
      rental_status: validatedData.rental_status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API properties/status:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

