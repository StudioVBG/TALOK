export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/privacy/anonymize - Anonymiser les données d'un utilisateur (RGPD)
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    if (profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut anonymiser des données" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_id, reason } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id requis" },
        { status: 400 }
      );
    }

    // Anonymiser le profil
    await supabase
      .from("profiles")
      .update({
        prenom: "ANONYME",
        nom: "ANONYME",
        telephone: null,
        avatar_url: null,
        date_naissance: null,
      } as any)
      .eq("user_id", user_id);

    // Anonymiser les données sensibles dans les autres tables
    // (à compléter selon les besoins RGPD)

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "data_anonymized",
      entity_type: "user",
      entity_id: user_id,
      metadata: { reason },
    } as any);

    return NextResponse.json({
      success: true,
      message: "Données anonymisées avec succès",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

