// @ts-nocheck
/**
 * API Route: Single Amortization Schedule
 * GET   /api/accounting/amortization/[id] - Recupere un plan avec ses lignes
 * PATCH /api/accounting/amortization/[id] - Met a jour duree/montant (si aucune ligne generee)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

const PatchScheduleSchema = z.object({
  durationYears: z.number().int().positive().optional(),
  totalAmountCents: z.number().int().positive().optional(),
});

/**
 * GET /api/accounting/amortization/[id]
 * Recupere un plan d'amortissement avec toutes ses lignes
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: schedule, error } = await supabase
      .from("amortization_schedules")
      .select("*, amortization_lines(*)")
      .eq("id", id)
      .single();

    if (error || !schedule) {
      throw new ApiError(404, "Plan d'amortissement non trouve");
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/accounting/amortization/[id]
 * Met a jour un plan — uniquement si aucune ligne n'a ete generee
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    // Check that no lines exist yet
    const { count } = await supabase
      .from("amortization_lines")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", id);

    if (count && count > 0) {
      throw new ApiError(
        409,
        "Impossible de modifier un plan dont les lignes ont deja ete generees",
      );
    }

    const body = await request.json();
    const validation = PatchScheduleSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const updates: Record<string, unknown> = {};
    if (validation.data.durationYears !== undefined) {
      updates.duration_years = validation.data.durationYears;
    }
    if (validation.data.totalAmountCents !== undefined) {
      updates.total_amount_cents = validation.data.totalAmountCents;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "Aucune modification fournie");
    }

    const { data: updated, error } = await supabase
      .from("amortization_schedules")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, "Erreur lors de la mise a jour du plan");
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
