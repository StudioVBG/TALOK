// @ts-nocheck
/**
 * API Route: Resolve EC Annotation
 * PATCH /api/accounting/ec/annotations/[id] - Mark annotation as resolved
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/accounting/ec/annotations/[id]
 * Mark an annotation as resolved.
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: annotation, error } = await (supabase as any)
      .from("ec_annotations")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", id)
      .is("resolved_at", null)
      .select()
      .single();

    if (error || !annotation) {
      throw new ApiError(404, "Annotation non trouvee ou deja resolue");
    }

    return NextResponse.json({ success: true, data: { annotation } });
  } catch (error) {
    return handleApiError(error);
  }
}
