export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * POST /api/colocation/expenses/settle
 * Regler les soldes entre deux colocataires
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const { property_id, expense_ids, payer_id, debtor_id } = body;

    if (!property_id || !payer_id || !debtor_id) {
      return NextResponse.json(
        { error: "property_id, payer_id et debtor_id requis" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("colocation_expenses")
      .update({ is_settled: true })
      .eq("property_id", property_id)
      .eq("is_settled", false);

    if (expense_ids && expense_ids.length > 0) {
      query = query.in("id", expense_ids);
    } else {
      // Settle all expenses between these two members
      query = query.eq("paid_by_member_id", payer_id);
    }

    const { data, error: updateError } = await query.select();
    if (updateError) throw updateError;

    return NextResponse.json({ settled: (data || []).length });
  } catch (err) {
    return handleApiError(err);
  }
}
