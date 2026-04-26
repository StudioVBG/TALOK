/**
 * API Route: Post annual amortization entries on demand
 * POST /api/accounting/exercises/[exerciseId]/post-amortizations
 *
 * Idempotently posts a depreciation OD entry for every active
 * amortization_schedule whose calendar line for the exercise year is
 * not yet booked. Closes the gap when the exercise is still open and
 * the user wants the dotation visible in their dashboard before closing.
 *
 * Auth: admin or owner of the exercise's entity.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { postAnnualAmortizationEntries } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { exerciseId: string } },
) {
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

    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      throw new ApiError(403, "Non autorise");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: exercise } = await supabase
      .from("accounting_exercises")
      .select("id, entity_id, status")
      .eq("id", params.exerciseId)
      .maybeSingle();

    if (!exercise) {
      throw new ApiError(404, "Exercice introuvable");
    }

    if (profile.role !== "admin") {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("id")
        .eq("id", (exercise as { entity_id: string }).entity_id)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) {
        throw new ApiError(403, "Acces refuse a cet exercice");
      }
    }

    if ((exercise as { status: string }).status === "closed") {
      throw new ApiError(
        409,
        "Exercice deja cloture — les amortissements ont ete poses lors de la cloture",
      );
    }

    const result = await postAnnualAmortizationEntries(
      supabase,
      params.exerciseId,
      user.id,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
