/**
 * API Route: Export syndic budget as CSV
 * GET /api/accounting/syndic/budget/[id]/export
 *
 * Exports the budget lines (account, label, amount) as a CSV the syndic
 * can attach to the AG convocation. Format: semicolon-separated, FR locale
 * (decimal comma), UTF-8 with BOM so Excel-FR opens it cleanly.
 *
 * Auth: admin or syndic with access to the budget's entity.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface BudgetLine {
  accountNumber: string;
  label: string;
  amountCents: number;
}

function csvEscape(value: string): string {
  const needsQuote = /[";\n\r]/.test(value);
  const safe = value.replace(/"/g, '""');
  return needsQuote ? `"${safe}"` : safe;
}

function formatAmount(cents: number): string {
  const euros = cents / 100;
  return euros
    .toFixed(2)
    .replace(".", ",");
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
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

    if (!profile) throw new ApiError(403, "Profil introuvable");
    if (
      profile.role !== "admin" &&
      profile.role !== "syndic" &&
      profile.role !== "owner"
    ) {
      throw new ApiError(403, "Acces refuse");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: budget } = await supabase
      .from("copro_budgets")
      .select("id, entity_id, budget_name, budget_lines, total_budget_cents, status")
      .eq("id", params.id)
      .maybeSingle();

    if (!budget) throw new ApiError(404, "Budget introuvable");

    if (profile.role !== "admin") {
      const { data: membership } = await supabase
        .from("entity_members")
        .select("entity_id")
        .eq("user_id", user.id)
        .eq("entity_id", (budget as { entity_id: string }).entity_id)
        .maybeSingle();
      if (!membership) throw new ApiError(403, "Acces refuse a ce budget");
    }

    const rawLines = ((budget as { budget_lines?: unknown }).budget_lines ??
      []) as BudgetLine[];

    const header = ["Compte", "Libelle", "Montant (EUR)"]
      .map(csvEscape)
      .join(";");

    const body = rawLines
      .map((l) =>
        [
          csvEscape(l.accountNumber ?? ""),
          csvEscape(l.label ?? ""),
          formatAmount(Number(l.amountCents ?? 0)),
        ].join(";"),
      )
      .join("\n");

    const total = formatAmount(
      Number((budget as { total_budget_cents?: number }).total_budget_cents ?? 0),
    );
    const totalRow = [csvEscape(""), csvEscape("TOTAL"), total].join(";");

    const csv = `﻿${header}\n${body}\n${totalRow}\n`;
    const filename = `budget-copro-${params.id.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
