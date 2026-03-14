export const runtime = "nodejs";

/**
 * API Route pour récupérer l'historique des transferts Stripe Connect
 *
 * GET /api/stripe/connect/transfers - Liste les transferts vers le compte du propriétaire
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const serviceClient = createServiceRoleClient();
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
        { error: "Seuls les propriétaires peuvent consulter leurs transferts" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect
    const { data: connectAccount } = await serviceClient
      .from("stripe_connect_accounts")
      .select("id")
      .eq("profile_id", profile.id)
      .single();

    const connectAccountId = connectAccount?.id;
    if (!connectAccountId) {
      return NextResponse.json([]);
    }

    // Récupérer les transferts
    const { data: transfers, error: transfersError } = await serviceClient
      .from("stripe_transfers")
      .select(
        "id, amount, currency, net_amount, platform_fee, stripe_fee, status, description, created_at, completed_at, invoice_id"
      )
      .eq("connect_account_id", connectAccountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (transfersError) {
      console.error("[Stripe Connect] Erreur transferts:", transfersError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des transferts" },
        { status: 500 }
      );
    }

    return NextResponse.json(transfers || []);
  } catch (error) {
    console.error("[Stripe Connect] Erreur transferts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
