export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/agency/accounts — List all mandant accounts with balances
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "agency" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    const { data: accounts, error } = await supabase
      .from("agency_mandant_accounts")
      .select(`
        *,
        mandate:agency_mandates!agency_mandant_accounts_mandate_id_fkey(
          id, mandate_number, status, management_fee_rate,
          owner:profiles!agency_mandates_owner_profile_id_fkey(
            id, prenom, nom, email
          )
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute summary
    const totalBalance = (accounts || []).reduce((sum, a) => sum + (a.balance_cents || 0), 0);
    const overdueCount = (accounts || []).filter((a) => a.reversement_overdue).length;

    return NextResponse.json({
      accounts: accounts || [],
      summary: {
        total_balance_cents: totalBalance,
        overdue_count: overdueCount,
        total_accounts: (accounts || []).length,
      },
    });
  } catch (error: unknown) {
    console.error("[agency/accounts GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
