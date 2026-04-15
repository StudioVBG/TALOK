export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/stripe — Liste des comptes Stripe Connect depuis Supabase
 */
export async function GET(request: Request) {
  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  // Fetch owners with Stripe Connect accounts
  const { data: connectAccounts, error } = await supabase
    .from("stripe_connect_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch profiles with stripe_customer_id for stats
  const { count: totalCustomers } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("stripe_customer_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    accounts: connectAccounts || [],
    stats: {
      total_connect_accounts: connectAccounts?.length || 0,
      total_stripe_customers: totalCustomers || 0,
    },
  });
}
