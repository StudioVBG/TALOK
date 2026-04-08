/**
 * API Route: Exercise Balance
 * GET /api/accounting/exercises/[exerciseId]/balance - Get balance des comptes
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getBalance } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/exercises/[exerciseId]/balance?entityId=...
 * Get the balance des comptes for an exercise.
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

    const featureGate = await requireAccountingAccess(profile.id, "balance");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const balance = await getBalance(supabase, entityId, exerciseId);

    return NextResponse.json({ success: true, data: { balance } });
  } catch (error) {
    return handleApiError(error);
  }
}
