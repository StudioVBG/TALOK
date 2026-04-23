export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/stripe — Liste des comptes Stripe Connect depuis Supabase
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation comptes Stripe Connect",
  });
  if (isAdminAuthError(auth)) return auth;
  const supabase = await createClient();

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
