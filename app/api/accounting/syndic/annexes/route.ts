/**
 * API Route: Syndic Copropriété — Annexes
 * GET /api/accounting/syndic/annexes?exerciseId=xxx&entityId=xxx&annexe=1-5
 *
 * Returns all 5 annexes or a single one (filter by ?annexe=N).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { generateCoproAnnexes } from "@/lib/accounting/syndic/annexes";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/syndic/annexes?entityId=xxx&exerciseId=xxx&annexe=1-5
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
    const annexeFilter = searchParams.get("annexe");

    if (!entityId || !exerciseId) {
      throw new ApiError(400, "entityId et exerciseId sont requis");
    }

    // Verify exercise exists
    const { data: exercise, error: exErr } = await (supabase as any)
      .from("accounting_exercises")
      .select("id")
      .eq("id", exerciseId)
      .eq("entity_id", entityId)
      .single();

    if (exErr || !exercise) {
      throw new ApiError(404, "Exercice non trouve");
    }

    const annexes = await generateCoproAnnexes(supabase, entityId, exerciseId);

    // Filter to single annexe if requested
    if (annexeFilter) {
      const num = parseInt(annexeFilter, 10);
      if (num < 1 || num > 5 || isNaN(num)) {
        throw new ApiError(400, "annexe doit etre entre 1 et 5");
      }

      const single = annexes.find((a) => a.annexe === num);
      if (!single) {
        throw new ApiError(404, `Annexe ${num} non trouvee`);
      }

      return NextResponse.json({ success: true, data: single });
    }

    return NextResponse.json({ success: true, data: annexes });
  } catch (error) {
    return handleApiError(error);
  }
}
