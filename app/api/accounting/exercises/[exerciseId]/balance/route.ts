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

    const featureGate = await requireAccountingAccess(profile.id, "balance");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const format = (searchParams.get("format") ?? "json") as "json" | "pdf" | "xlsx";

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    // Ownership enforcement — service client bypasses RLS.
    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    const balance = await getBalance(serviceClient, entityId, exerciseId);

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
