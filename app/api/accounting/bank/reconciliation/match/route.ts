/**
 * API Route: Manual bank transaction matching
 * POST /api/accounting/bank/reconciliation/match
 *
 * Manually matches a bank transaction to an accounting entry.
 * Attempts to apply lettrage if possible.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { manualMatch } from "@/lib/accounting/reconciliation";
import { applyLettrage } from "@/lib/accounting/engine";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MatchSchema = z.object({
  transactionId: z.string().uuid(),
  entryId: z.string().uuid(),
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
    const validation = MatchSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { transactionId, entryId } = validation.data;

    // Perform the manual match
    await manualMatch(supabase, transactionId, entryId);

    // Attempt lettrage on the entry's bank-account lines
    let lettrageApplied = false;
    try {
      // Fetch the entry lines that use a bank account (512xxx)
      const { data: lines } = await supabase
        .from("accounting_entry_lines")
        .select("id, account_number, debit_cents, credit_cents")
        .eq("entry_id", entryId)
        .like("account_number", "512%");

      if (lines && lines.length > 0) {
        const lineIds = lines.map((l: { id: string }) => l.id);

        // Generate lettrage code from transaction ID prefix
        const lettrageCode = `BK-${transactionId.substring(0, 8).toUpperCase()}`;

        // Only apply if the lines themselves balance (which they may not for a single-side)
        const totalDebit = lines.reduce(
          (s: number, l: { debit_cents: number }) => s + l.debit_cents,
          0,
        );
        const totalCredit = lines.reduce(
          (s: number, l: { credit_cents: number }) => s + l.credit_cents,
          0,
        );

        if (totalDebit === totalCredit && lineIds.length >= 2) {
          await applyLettrage(supabase, lineIds, lettrageCode);
          lettrageApplied = true;
        }
      }
    } catch {
      // Lettrage is best-effort, don't fail the match
    }

    return NextResponse.json({
      success: true,
      data: { matched: true, lettrageApplied },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
