/**
 * API Route: Revoke Expert-Comptable Access
 * DELETE /api/accounting/ec/access/[id] - Revoke access
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/accounting/ec/access/[id]
 * Revoke an EC access by setting revoked_at and is_active = false.
 */
export async function DELETE(
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

    const { error } = await (supabase as any)
      .from("ec_access")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_active", true);

    if (error) {
      throw new ApiError(500, "Erreur lors de la revocation de l'acces");
    }

    return NextResponse.json({ success: true, data: { revoked: true } });
  } catch (error) {
    return handleApiError(error);
  }
}
