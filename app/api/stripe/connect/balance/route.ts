export const runtime = "nodejs";

/**
 * API Route pour récupérer le solde Stripe Connect
 *
 * GET /api/stripe/connect/balance - Récupère le solde disponible et en attente
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";

export async function GET() {
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
        { error: "Seuls les propriétaires peuvent consulter leur solde" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect
    const { data: connectAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("profile_id", profile.id)
      .single();

    if (!connectAccount) {
      return NextResponse.json(
        { error: "Aucun compte Stripe Connect configuré" },
        { status: 404 }
      );
    }

    if (!connectAccount.charges_enabled) {
      return NextResponse.json({
        available: 0,
        pending: 0,
        currency: "eur",
        account_not_ready: true,
      });
    }

    // Récupérer le solde depuis Stripe
    const balance = await connectService.getAccountBalance(connectAccount.stripe_account_id);

    // Extraire les montants en EUR
    const available = balance.available.find((b) => b.currency === "eur")?.amount || 0;
    const pending = balance.pending.find((b) => b.currency === "eur")?.amount || 0;

    return NextResponse.json({
      available: available / 100, // Convertir en euros
      pending: pending / 100,
      available_cents: available,
      pending_cents: pending,
      currency: "eur",
    });
  } catch (error) {
    console.error("[Stripe Connect] Erreur balance:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
