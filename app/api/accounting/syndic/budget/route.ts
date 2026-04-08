/**
 * API Route: Syndic Copropriété — Budgets
 * GET  /api/accounting/syndic/budget  - List budgets (with actual comparison)
 * POST /api/accounting/syndic/budget  - Create a budget
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

const BudgetLineSchema = z.object({
  accountNumber: z.string().min(3),
  label: z.string().min(1).max(255),
  amountCents: z.number().int().positive(),
});

const CreateBudgetSchema = z.object({
  entityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  label: z.string().min(1).max(255),
  lines: z.array(BudgetLineSchema).min(1),
});

/**
 * GET /api/accounting/syndic/budget?entityId=xxx&exerciseId=xxx
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const exerciseId = searchParams.get("exerciseId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    let query = supabase
      .from("copro_budgets")
      .select("*")
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    if (exerciseId) {
      query = query.eq("exercise_id", exerciseId);
    }

    const { data: budgets, error } = await query;

    if (error) {
      throw new ApiError(500, `Erreur chargement budgets: ${error.message}`);
    }

    // Enrich with actual amounts comparison from accounting entries
    const enriched = await Promise.all(
      (budgets ?? []).map(async (budget) => {
        const budgetLines = (budget.budget_lines ?? []) as Array<{
          accountNumber: string;
          label: string;
          amountCents: number;
        }>;

        // Fetch actual amounts from validated entries for the same accounts
        const accountNumbers = budgetLines.map((l) => l.accountNumber);

        if (accountNumbers.length === 0) {
          return { ...budget, comparison: [] };
        }

        const { data: entryLines } = await supabase
          .from("accounting_entry_lines")
          .select(
            `
            account_number,
            debit_cents,
            credit_cents,
            accounting_entries!inner(entity_id, exercise_id, is_validated)
          `,
          )
          .eq("accounting_entries.entity_id", entityId)
          .eq("accounting_entries.exercise_id", budget.exercise_id)
          .eq("accounting_entries.is_validated", true)
          .in("account_number", accountNumbers);

        // Aggregate actual amounts by account
        const actualMap = new Map<string, number>();
        for (const line of entryLines ?? []) {
          const current = actualMap.get(line.account_number) ?? 0;
          // Charges (class 6) are debits, produits (class 7) are credits
          actualMap.set(
            line.account_number,
            current + line.debit_cents - line.credit_cents,
          );
        }

        const comparison = budgetLines.map((bl) => ({
          accountNumber: bl.accountNumber,
          label: bl.label,
          budgetCents: bl.amountCents,
          actualCents: actualMap.get(bl.accountNumber) ?? 0,
          varianceCents:
            (actualMap.get(bl.accountNumber) ?? 0) - bl.amountCents,
        }));

        return { ...budget, comparison };
      }),
    );

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/syndic/budget
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateBudgetSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;
    const totalBudgetCents = data.lines.reduce(
      (sum, l) => sum + l.amountCents,
      0,
    );

    const { data: budget, error } = await supabase
      .from("copro_budgets")
      .insert({
        entity_id: data.entityId,
        exercise_id: data.exerciseId,
        budget_name: data.label,
        budget_lines: data.lines,
        total_budget_cents: totalBudgetCents,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Erreur creation budget: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
