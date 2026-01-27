export const runtime = "nodejs";

/**
 * API Route pour accéder au dashboard Stripe Express
 *
 * POST /api/stripe/connect/dashboard - Génère un lien vers le dashboard Stripe
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";

export async function POST() {
  try {
    const supabase = await createRouteHandlerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent accéder au dashboard" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect
    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled")
      .eq("profile_id", profile.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json(
        { error: "Aucun compte Stripe Connect configuré" },
        { status: 404 }
      );
    }

    if (!connectAccount.charges_enabled || !connectAccount.payouts_enabled) {
      return NextResponse.json(
        { error: "Votre compte Stripe Connect n'est pas encore activé. Terminez l'onboarding." },
        { status: 400 }
      );
    }

    // Créer le lien de dashboard
    const loginLink = await connectService.createLoginLink(connectAccount.stripe_account_id);

    return NextResponse.json({
      success: true,
      dashboard_url: loginLink.url,
    });
  } catch (error) {
    console.error("[Stripe Connect] Erreur dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
