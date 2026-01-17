export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/me/guarantor - Ajouter un garant
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { lease_id, first_name, last_name, email, phone, relationship } = body;

    if (!lease_id || !first_name || !last_name) {
      return NextResponse.json(
        { error: "lease_id, first_name et last_name requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", lease_id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier si un garant existe déjà pour ce bail
    const { data: existing } = await supabase
      .from("guarantors")
      .select("id")
      .eq("lease_id", lease_id as any)
      .eq("profile_id", (profile as any).id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Un garant existe déjà pour ce bail" },
        { status: 409 }
      );
    }

    // Créer le garant
    const { data: guarantor, error } = await supabase
      .from("guarantors")
      .insert({
        lease_id,
        profile_id: (profile as any).id,
        user_id: user.id,
        first_name,
        last_name,
        email: email || user.email,
        phone,
        relationship: relationship || "other",
        status: "pending",
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ guarantor });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





