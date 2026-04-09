export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { diagnosticUpdateSchema } from "@/lib/validations/diagnostics";

interface RouteParams {
  params: { id: string };
}

/**
 * PATCH /api/diagnostics/[id]
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const { id } = params;
    const body = await request.json();
    const parsed = diagnosticUpdateSchema.parse(body);

    const { data, error } = await supabase
      .from("property_diagnostics")
      .update({
        ...parsed,
        is_valid: true,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new ApiError(404, "Diagnostic non trouvé");

    return NextResponse.json({ diagnostic: data });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/diagnostics/[id]
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const { id } = params;

    const { error } = await supabase
      .from("property_diagnostics")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
