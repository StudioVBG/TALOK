/**
 * API Route: Close Accounting Exercise
 * POST /api/accounting/exercises/[exerciseId]/close - Close an exercise
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { closeExercise } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/accounting/exercises/[exerciseId]/close
 * Close an accounting exercise. Fails if unvalidated entries remain.
 */
export async function POST(
  _request: Request,
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

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    await closeExercise(supabase, exerciseId, user.id);

    return NextResponse.json({
      success: true,
      data: { message: "Exercice cloture avec succes" },
    });
  } catch (error) {
    // Surface unvalidated entries error with a clear message
    if (error instanceof Error && error.message.includes("unvalidated entries remain")) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
