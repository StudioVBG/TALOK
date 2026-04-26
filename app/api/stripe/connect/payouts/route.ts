export const runtime = "nodejs";

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
        { error: "Seuls les propriétaires et syndics peuvent consulter leurs versements bancaires" },
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

    if (!connectAccount?.id) {
      return NextResponse.json([]);
    }

    const { data: payouts, error } = await serviceClient
      .from("stripe_payouts")
      .select("id, stripe_payout_id, amount, currency, status, arrival_date, paid_at, failure_code, failure_message, created_at")
      .eq("connect_account_id", connectAccount.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(payouts ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
