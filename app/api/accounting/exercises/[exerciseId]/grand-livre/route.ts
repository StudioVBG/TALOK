/**
 * API Route: Grand Livre (General Ledger)
 * GET /api/accounting/exercises/[exerciseId]/grand-livre - Get grand livre
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getGrandLivre } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]/grand-livre?entityId=...&account=512
 * Get the grand livre for an exercise, optionally filtered by account prefix.
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "gl");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const accountFilter = searchParams.get("account") || undefined;

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const grandLivre = await getGrandLivre(supabase, entityId, exerciseId, accountFilter);

    return NextResponse.json({ success: true, data: { grandLivre } });
  } catch (error) {
    return handleApiError(error);
  }
}
