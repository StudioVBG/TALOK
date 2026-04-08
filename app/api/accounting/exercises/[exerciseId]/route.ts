// @ts-nocheck
/**
 * API Route: Single Accounting Exercise
 * GET /api/accounting/exercises/[exerciseId] - Fetch exercise with balance summary
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]
 * Fetch a single exercise with a summary of total debits/credits.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  try {
    const { exerciseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    // Fetch the exercise
    const { data: exercise, error } = await (supabase as any)
      .from("accounting_exercises")
      .select("*")
      .eq("id", exerciseId)
      .single();

    if (error || !exercise) {
      throw new ApiError(404, "Exercice non trouve");
    }

    // Fetch balance summary: total debits/credits for validated entries
    const { data: lines } = await (supabase as any)
      .from("accounting_entry_lines")
      .select(`
        debit_cents,
        credit_cents,
        accounting_entries!inner(exercise_id, is_validated)
      `)
      .eq("accounting_entries.exercise_id", exerciseId)
      .eq("accounting_entries.is_validated", true);

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    for (const line of lines || []) {
      totalDebitCents += line.debit_cents ?? 0;
      totalCreditCents += line.credit_cents ?? 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        ...exercise,
        balanceSummary: {
          totalDebitCents,
          totalCreditCents,
          isBalanced: totalDebitCents === totalCreditCents,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
