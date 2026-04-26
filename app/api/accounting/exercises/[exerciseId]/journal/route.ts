/**
 * API Route: Journal général
 * GET /api/accounting/exercises/[exerciseId]/journal - Get chronological journal
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getJournal } from "@/lib/accounting/engine";
import { renderJournalPdf } from "@/lib/accounting/exports/pdf";
import { buildJournalWorkbook } from "@/lib/accounting/exports/xlsx";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]/journal?entityId=...&journal=VE&format=json|pdf|xlsx
 * Returns entries grouped by journal_code, chronologically inside each group.
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

    const featureGate = await requireAccountingAccess(profile.id, "journal");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const journalCode = searchParams.get("journal") || undefined;
    const format = (searchParams.get("format") ?? "json") as "json" | "pdf" | "xlsx";

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    // Ownership enforcement — service client bypasses RLS.
    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id, nom")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    const journal = await getJournal(serviceClient, entityId, exerciseId, journalCode);

    if (format === "pdf") {
      const { data: exercise } = await serviceClient
        .from("accounting_exercises")
        .select("start_date, end_date, status")
        .eq("id", exerciseId)
        .maybeSingle();
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("nom")
        .eq("id", entityId)
        .maybeSingle();
      const pdf = await renderJournalPdf(journal, {
        entityName: entity?.nom ?? "",
        startDate: exercise?.start_date ?? "",
        endDate: exercise?.end_date ?? "",
      });
      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="journal_${exerciseId}.pdf"`,
        },
      });
    }

    if (format === "xlsx") {
      const buffer = await buildJournalWorkbook(journal);
      return new Response(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="journal_${exerciseId}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ success: true, data: { journal } });
  } catch (error) {
    return handleApiError(error);
  }
}
