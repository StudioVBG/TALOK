/**
 * API Route: Deficit Foncier Tracking
 * GET /api/accounting/deficit - Liste le suivi des deficits fonciers
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/deficit
 * Recupere le suivi des deficits fonciers pour une entite
 */
export async function GET(request: Request) {
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

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const { data: deficits, error } = await (supabase as any)
      .from("deficit_tracking")
      .select("*")
      .eq("entity_id", entityId)
      .order("origin_year", { ascending: true });

    if (error) {
      throw new ApiError(500, "Erreur lors de la recuperation des deficits");
    }

    const currentYear = new Date().getFullYear();

    // Calculate totals
    const items = (deficits ?? []).map((d: any) => {
      const remainingCents =
        (d.deficit_amount_cents as number) - (d.used_amount_cents as number);
      const expiresYear = (d.origin_year as number) + (d.reportable_years as number);
      return {
        ...d,
        remaining_amount_cents: remainingCents,
        expires_year: expiresYear,
        is_expired: expiresYear < currentYear,
        expires_this_year: expiresYear === currentYear,
      };
    });

    const totalReportable = items
      .filter((d: any) => !d.is_expired && d.remaining_amount_cents > 0)
      .reduce((sum: number, d: any) => sum + d.remaining_amount_cents, 0);

    const expiringThisYear = items
      .filter((d: any) => d.expires_this_year && d.remaining_amount_cents > 0)
      .reduce((sum: number, d: any) => sum + d.remaining_amount_cents, 0);

    return NextResponse.json({
      success: true,
      data: {
        deficits: items,
        totalReportable,
        expiringThisYear,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
