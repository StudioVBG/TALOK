export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { propertyIdParamSchema } from "@/lib/validations/params";
import { canDeleteProperty } from "@/lib/properties/guards";

/**
 * GET /api/properties/[id]/can-delete
 * Vérifie si un bien peut être supprimé/archivé.
 * Utilisé par la modale de confirmation côté client.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const propertyId = propertyIdParamSchema.parse(id);

    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration serveur incomplète");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const result = await canDeleteProperty(serviceClient, propertyId, profile.id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
