/**
 * API Route: Exercise Balance
 * GET /api/accounting/exercises/[exerciseId]/balance - Get balance des comptes
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getBalance } from "@/lib/accounting/engine";
import { renderBalancePdf } from "@/lib/accounting/exports/pdf";
import { buildBalanceWorkbook } from "@/lib/accounting/exports/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]/balance?entityId=...
 * Get the balance des comptes for an exercise.
 *
 * Auth via user-scoped client, DB reads via service client to avoid RLS
 * recursion (42P17) on profiles that otherwise produces 500s.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ exerciseId: string }> },
) {
  try {
    const { exerciseId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const format = (searchParams.get("format") ?? "json") as
      | "json"
      | "pdf"
      | "xlsx"
      | "summary";

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    // Ownership enforcement — service client bypasses RLS. Trois chemins :
    //   1. admin : bypass complet (gate aussi sauté)
    //   2. propriétaire de l'entité → gating sur SON plan
    //   3. expert-comptable invité (lookup ec_access par user.id ou
    //      user.email) → gating sur le plan du PROPRIÉTAIRE
    const isAdmin = profile.role === "admin";
    let isOwner = false;
    let ownerProfileId: string | null = null;

    if (!isAdmin) {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id, owner_profile_id")
        .eq("id", entityId)
        .maybeSingle();
      if (!entity) throw new ApiError(404, "Entité introuvable");

      ownerProfileId = entity.owner_profile_id ?? null;
      isOwner = ownerProfileId === profile.id;

      if (!isOwner) {
        const { data: ecAccess } = await serviceClient
          .from("ec_access")
          .select("id")
          .eq("entity_id", entityId)
          .eq("is_active", true)
          .is("revoked_at", null)
          .or(`ec_user_id.eq.${user.id},ec_email.eq.${user.email ?? ""}`)
          .limit(1)
          .maybeSingle();
        if (!ecAccess) throw new ApiError(403, "Accès refusé à cette entité");
      }

      const gateProfileId = isOwner ? profile.id : ownerProfileId;
      if (!gateProfileId) {
        throw new ApiError(404, "Propriétaire de l'entité introuvable");
      }
      const featureGate = await requireAccountingAccess(gateProfileId, "balance");
      if (featureGate) return featureGate;
    }

    const balance = await getBalance(serviceClient, entityId, exerciseId);

    if (format === "summary") {
      // Aggregate the per-account balance into the dashboard-shape
      // (revenue=class 7, expenses=class 6, result, totals) plus a
      // monthly debit/credit series so the dashboard hook can render
      // KPIs and the chart without doing financial math frontend-side.
      let revenueCents = 0;
      let expensesCents = 0;
      let totalDebitCents = 0;
      let totalCreditCents = 0;
      for (const b of balance) {
        totalDebitCents += b.totalDebitCents;
        totalCreditCents += b.totalCreditCents;
        if (b.accountNumber.startsWith("7")) {
          revenueCents += b.totalCreditCents - b.totalDebitCents;
        } else if (b.accountNumber.startsWith("6")) {
          expensesCents += b.totalDebitCents - b.totalCreditCents;
        }
      }
      const resultCents = revenueCents - expensesCents;

      const { data: monthlyRows } = await serviceClient
        .from("accounting_entry_lines")
        .select(
          `debit_cents, credit_cents,
           accounting_entries!inner(entity_id, exercise_id, is_validated, entry_date)`,
        )
        .eq("accounting_entries.entity_id", entityId)
        .eq("accounting_entries.exercise_id", exerciseId)
        .eq("accounting_entries.is_validated", true);

      const monthMap = new Map<string, { debit: number; credit: number }>();
      for (const row of (monthlyRows ?? []) as Array<{
        debit_cents: number;
        credit_cents: number;
        accounting_entries:
          | { entry_date: string }
          | { entry_date: string }[];
      }>) {
        const entryMeta = Array.isArray(row.accounting_entries)
          ? row.accounting_entries[0]
          : row.accounting_entries;
        const month = (entryMeta?.entry_date ?? "").slice(0, 7);
        if (!month) continue;
        const cur = monthMap.get(month) ?? { debit: 0, credit: 0 };
        cur.debit += row.debit_cents ?? 0;
        cur.credit += row.credit_cents ?? 0;
        monthMap.set(month, cur);
      }
      const monthlySeries = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, agg]) => ({
          month,
          debitCents: agg.debit,
          creditCents: agg.credit,
        }));

      return NextResponse.json({
        success: true,
        data: {
          summary: {
            totalDebitCents,
            totalCreditCents,
            revenueCents,
            expensesCents,
            resultCents,
            monthlySeries,
          },
        },
      });
    }

    if (format === "pdf" || format === "xlsx") {
      const [{ data: exercise }, { data: entity }] = await Promise.all([
        serviceClient
          .from("accounting_exercises")
          .select("start_date, end_date")
          .eq("id", exerciseId)
          .maybeSingle(),
        serviceClient
          .from("legal_entities")
          .select("nom")
          .eq("id", entityId)
          .maybeSingle(),
      ]);

      if (format === "pdf") {
        const pdf = await renderBalancePdf(balance, {
          entityName: entity?.nom ?? "",
          startDate: exercise?.start_date ?? "",
          endDate: exercise?.end_date ?? "",
        });
        return new Response(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="balance_${exerciseId}.pdf"`,
          },
        });
      }

      const xlsx = await buildBalanceWorkbook(balance);
      return new Response(xlsx, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="balance_${exerciseId}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: { balance } });
  } catch (error) {
    return handleApiError(error);
  }
}
