export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/properties/[id]/units - Activer le mode colocation sur un logement
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { name, capacite_max = 10, surface, auto_validation_threshold = 5 } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Nom de l'unité requis" },
        { status: 400 }
      );
    }

    if (capacite_max < 1 || capacite_max > 10) {
      return NextResponse.json(
        { error: "Capacité max doit être entre 1 et 10" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;
    if (propertyData.owner_id !== profileData?.id) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Créer l'unité
    const { data: unit, error } = await supabase
      .from("units")
      .insert({
        property_id: id,
        nom: name,
        capacite_max,
        surface: surface || null,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const unitData = unit as any;

    // Créer un code d'accès pour cette unité
    const { createClient: createSupabaseClient } = await import("@/lib/supabase/server");
    const supabaseAdmin = await createSupabaseClient();
    
    const code = await generateUniqueCode(supabaseAdmin);
    await supabaseAdmin.from("unit_access_codes").insert({
      unit_id: unitData.id,
      property_id: id as any,
      code,
      status: "active" as any,
      created_by: user.id,
    } as any);

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Cohousing.Activated",
      payload: {
        unit_id: unitData.id,
        property_id: id as any,
        capacite_max,
        auto_validation_threshold,
      },
    } as any);

    return NextResponse.json({ unit: unitData, access_code: code });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function generateUniqueCode(supabase: any): Promise<string> {
  const prefix = "UNIT";
  let code: string;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 10) {
    const randomPart = Array.from({ length: 8 }, () => {
      const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return chars[Math.floor(Math.random() * chars.length)];
    }).join("");

    code = `${prefix}-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`;

    const { data: existing } = await supabase
      .from("unit_access_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();

    exists = !!existing;
    attempts++;
  }

  if (exists) {
    throw new Error("Impossible de générer un code unique");
  }

  return code!;
}





