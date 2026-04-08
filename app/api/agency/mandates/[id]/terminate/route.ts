export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/agency/mandates/[id]/terminate — Terminate a mandate
 *
 * Validates that no pending operations exist before termination.
 * Sets status to 'terminated' and end_date to today.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    if (!profile || profile.role !== "agency") {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    // Check mandate exists and belongs to this agency
    const { data: mandate } = await supabase
      .from("agency_mandates")
      .select("id, status")
      .eq("id", id)
      .eq("agency_profile_id", profile.id)
      .single();

    if (!mandate) {
      return NextResponse.json({ error: "Mandat non trouve" }, { status: 404 });
    }

    if (mandate.status === "terminated") {
      return NextResponse.json({ error: "Mandat deja resilie" }, { status: 400 });
    }

    // Check for pending CRGs
    const { count: pendingCrgs } = await supabase
      .from("agency_crg")
      .select("id", { count: "exact", head: true })
      .eq("mandate_id", id)
      .in("status", ["draft", "generated"]);

    if (pendingCrgs && pendingCrgs > 0) {
      return NextResponse.json(
        { error: "Impossible de resilier : CRG en cours non envoyes. Envoyez-les d'abord." },
        { status: 400 }
      );
    }

    // Check mandant account balance
    const { data: account } = await supabase
      .from("agency_mandant_accounts")
      .select("balance_cents")
      .eq("mandate_id", id)
      .single();

    if (account && account.balance_cents > 0) {
      return NextResponse.json(
        { error: "Impossible de resilier : solde mandant positif. Effectuez le reversement d'abord." },
        { status: 400 }
      );
    }

    // Terminate
    const { data: updated, error: updateError } = await supabase
      .from("agency_mandates")
      .update({
        status: "terminated",
        end_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ mandate: updated });
  } catch (error: unknown) {
    console.error("[agency/mandates/[id]/terminate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
