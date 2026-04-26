export const runtime = "nodejs";

/**
 * API Route pour récupérer l'historique des transferts Stripe Connect
 *
 * GET /api/stripe/connect/transfers - Liste les transferts vers le compte du propriétaire
 *   - Sans entityId : compte personnel (entity_id IS NULL)
 *   - Avec entityId : compte scopé à l'entité juridique
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["owner", "syndic"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Seuls les propriétaires et syndics peuvent consulter leurs transferts" },
        { status: 403 }
      );
    }

    const entityId = request.nextUrl.searchParams.get("entityId");

    let query = serviceClient
      .from("stripe_connect_accounts")
      .select("id")
      .eq("profile_id", profile.id);

    if (entityId) {
      query = query.eq("entity_id", entityId);
    } else {
      query = query.is("entity_id", null);
    }

    const { data: connectAccount } = await query.maybeSingle();

    const connectAccountId = connectAccount?.id;
    if (!connectAccountId) {
      return NextResponse.json([]);
    }

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
