/**
 * API Route: Syndic Copropriété — Budget Detail
 * PATCH /api/accounting/syndic/budget/[id]       - Update lines (draft only)
 * POST  /api/accounting/syndic/budget/[id]       - Vote budget (action=vote)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const BudgetLineSchema = z.object({
  accountNumber: z.string().min(3),
  label: z.string().min(1).max(255),
  amountCents: z.number().int().positive(),
});

const UpdateBudgetSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  lines: z.array(BudgetLineSchema).min(1).optional(),
});

/**
 * PATCH /api/accounting/syndic/budget/[id]
 * Update budget lines (only if status = 'draft')
 */
export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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

    // Check budget exists and is draft
    const { data: existing, error: fetchErr } = await supabase
      .from("copro_budgets")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      throw new ApiError(404, "Budget non trouve");
    }

    if (existing.status !== "draft") {
      throw new ApiError(
        400,
        "Seul un budget en brouillon peut etre modifie",
      );
    }

    const body = await request.json();
    const validation = UpdateBudgetSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.label) {
      update.budget_name = data.label;
    }

    if (data.lines) {
      update.budget_lines = data.lines;
      update.total_budget_cents = data.lines.reduce(
        (sum, l) => sum + l.amountCents,
        0,
      );
    }

    const { data: budget, error } = await supabase
      .from("copro_budgets")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Erreur mise a jour budget: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: budget });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/syndic/budget/[id]
 * Vote budget: body { action: "vote" }
 * Updates status to 'voted' and sets voted_at
 */
export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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

    if (body.action !== "vote") {
      throw new ApiError(400, "Action invalide. Utilisez { action: 'vote' }");
    }

    // Check budget exists and is draft
    const { data: existing, error: fetchErr } = await supabase
      .from("copro_budgets")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      throw new ApiError(404, "Budget non trouve");
    }

    if (existing.status !== "draft") {
      throw new ApiError(400, "Seul un budget en brouillon peut etre vote");
    }

    const { data: budget, error } = await supabase
      .from("copro_budgets")
      .update({
        status: "voted",
        voted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, `Erreur vote budget: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "Budget vote avec succes",
      data: budget,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
