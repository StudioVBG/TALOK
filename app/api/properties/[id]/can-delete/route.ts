export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { propertyIdParamSchema } from "@/lib/validations/params";
import { canDeleteProperty } from "@/lib/properties/guards";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/properties/[id]/can-delete
 *
 * Pre-flight check before deleting a property. Returns blockers, warnings,
 * and linked-data counts. For immeubles, also returns per-lot info.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const propertyId = propertyIdParamSchema.parse(id);

    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    const serviceClient = getServiceClient();

    // Resolve profile to get owner_id
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    const result = await canDeleteProperty(serviceClient, propertyId, profile.id);

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
