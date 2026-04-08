// @ts-nocheck
/**
 * API Route: Categorize & create entry from bank transaction
 * POST /api/accounting/bank/reconciliation/categorize
 *
 * Creates an accounting entry from a bank transaction (orphan categorization),
 * auto-validates it, then matches the transaction to the new entry.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createEntry, validateEntry } from "@/lib/accounting/engine";
import { manualMatch } from "@/lib/accounting/reconciliation";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CategorizeSchema = z.object({
  transactionId: z.string().uuid(),
  journalCode: z.enum(["ACH", "VE", "BQ", "OD", "AN", "CL"]),
  accountNumber: z.string().min(3),
  accountLabel: z.string().min(1),
  label: z.string().min(1),
  propertyId: z.string().uuid().optional(),
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
    const validation = CategorizeSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { transactionId, journalCode, accountNumber, accountLabel, label, propertyId } =
      validation.data;

    // Fetch the bank transaction
    const { data: tx, error: txError } = await (supabase as any)
      .from("bank_transactions")
      .select("*, bank_connections!inner(entity_id)")
      .eq("id", transactionId)
      .single();

    if (txError || !tx) {
      throw new ApiError(404, "Transaction bancaire introuvable");
    }

    const entityId = tx.bank_connections.entity_id as string;
    const amountCents = Math.abs(tx.amount_cents as number);
    const isIncome = (tx.amount_cents as number) > 0;

    // Get or create current exercise
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);

    // Determine bank account (default 512100)
    const bankAccount = "512100";

    // Build double-entry lines:
    // Income (positive amount): debit bank / credit expense account
    // Expense (negative amount): debit expense account / credit bank
    const lines = isIncome
      ? [
          {
            accountNumber: bankAccount,
            label: label,
            debitCents: amountCents,
            creditCents: 0,
          },
          {
            accountNumber,
            label: accountLabel,
            debitCents: 0,
            creditCents: amountCents,
          },
        ]
      : [
          {
            accountNumber,
            label: accountLabel,
            debitCents: amountCents,
            creditCents: 0,
          },
          {
            accountNumber: bankAccount,
            label: label,
            debitCents: 0,
            creditCents: amountCents,
          },
        ];

    // Create the accounting entry
    const entry = await createEntry(supabase, {
      entityId,
      exerciseId: exercise.id,
      journalCode,
      entryDate: tx.transaction_date as string,
      label,
      source: "reconciliation",
      reference: propertyId ?? undefined,
      lines,
      userId: user.id,
    });

    // Auto-validate the entry
    await validateEntry(supabase, entry.id, user.id);

    // Match the transaction to the new entry
    await manualMatch(supabase, transactionId, entry.id);

    return NextResponse.json({
      success: true,
      data: { entry, matched: true },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
