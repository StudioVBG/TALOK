/**
 * API Route: Run automatic bank reconciliation
 * POST /api/accounting/bank/reconciliation/run
 *
 * Triggers the scoring engine on all pending bank transactions.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { reconcileTransactions } from "@/lib/accounting/reconciliation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RunSchema = z.object({
  entityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Acces reserve aux administrateurs");
    }

    const featureGate = await requireAccountingAccess(
      profile.id,
      "reconciliation",
    );
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = RunSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, exerciseId } = validation.data;

    const { results, summary } = await reconcileTransactions(
      supabase,
      entityId,
      exerciseId,
    );

    return NextResponse.json({
      success: true,
      data: { results, summary },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
