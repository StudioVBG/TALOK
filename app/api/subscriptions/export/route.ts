export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/subscriptions/export
 * Exporte les données d'abonnement et factures de l'utilisateur (RGPD Art. 20 - Portabilité)
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom, email, telephone")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer l'abonnement actuel
    let subscription = null;
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = data;
    } catch {
      // Table may not exist in dev
    }

    // Récupérer les factures
    let invoices: unknown[] = [];
    try {
      const { data } = await supabase
        .from("subscription_invoices")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      invoices = data || [];
    } catch {
      // Table may not exist in dev
    }

    // Récupérer le profil propriétaire si owner
    let ownerProfile = null;
    if (profile.role === "owner") {
      try {
        const { data } = await supabase
          .from("owner_profiles")
          .select("type, siret, tva, iban, adresse_facturation, raison_sociale")
          .eq("profile_id", profile.id)
          .maybeSingle();
        ownerProfile = data;
      } catch {
        // Column may not exist
      }
    }

    const exportData = {
      export_date: new Date().toISOString(),
      export_version: "1.0",
      user: {
        id: user.id,
        email: user.email,
        prenom: profile.prenom,
        nom: profile.nom,
        telephone: profile.telephone,
        role: profile.role,
      },
      owner_profile: ownerProfile,
      subscription,
      invoices,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="talok-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: unknown) {
    console.error("[POST /api/subscriptions/export]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
