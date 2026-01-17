export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Route publique pour vérifier un code d'invitation ou code logement
 * Retourne les informations publiques du logement (aperçu)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Code requis" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Chercher le logement par code unique
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select(
        `
        id,
        type,
        adresse_complete,
        code_postal,
        ville,
        surface,
        nb_pieces,
        unique_code
      `
      )
      .eq("unique_code", code)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 404 }
      );
    }

    const propertyData = property as any;

    // Retourner uniquement les informations publiques
    return NextResponse.json({
      property: {
        id: propertyData.id,
        type: propertyData.type,
        address: propertyData.adresse_complete,
        city: propertyData.ville,
        postal_code: propertyData.code_postal,
        surface: propertyData.surface,
        rooms: propertyData.nb_pieces,
      },
      code_valid: true,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

