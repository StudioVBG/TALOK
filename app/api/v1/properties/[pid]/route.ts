export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  validateBody,
  logAudit,
} from "@/lib/api/middleware";
import { UpdatePropertySchema } from "@/lib/api/schemas";

interface RouteParams {
  params: Promise<{ pid: string }>;
}

/**
 * GET /api/v1/properties/:pid
 * Get property details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const supabase = await createClient();

    const { data: property, error } = await supabase
      .from("properties")
      .select(`
        *,
        units(*),
        leases(
          *,
          lease_signers(*, profiles(*))
        ),
        documents(*),
        tickets(id, titre, statut, priorite),
        meters(*)
      `)
      .eq("id", pid)
      .single();

    if (error || !property) {
      return apiError("Propriété non trouvée", 404, "NOT_FOUND");
    }

    // Authorization: owner can only see their own
    if (auth.profile.role === "owner" && property.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403, "FORBIDDEN");
    }

    return apiSuccess({ property });
  } catch (error: unknown) {
    console.error("[GET /properties/:pid] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * PATCH /api/v1/properties/:pid
 * Update property details
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const supabase = await createClient();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", pid)
      .single();

    if (fetchError || !existing) {
      return apiError("Propriété non trouvée", 404, "NOT_FOUND");
    }

    if (auth.profile.role === "owner" && existing.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403, "FORBIDDEN");
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(UpdatePropertySchema, body);

    if (validationError) return validationError;

    // Update
    const { data: property, error } = await supabase
      .from("properties")
      .update(data)
      .eq("id", pid)
      .select()
      .single();

    if (error) {
      console.error("[PATCH /properties/:pid] Error:", error);
      return apiError("Erreur lors de la mise à jour", 500);
    }

    // Audit log
    await logAudit(
      supabase,
      "property.updated",
      "properties",
      pid,
      auth.user.id,
      existing,
      property
    );

    return apiSuccess({ property });
  } catch (error: unknown) {
    console.error("[PATCH /properties/:pid] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * DELETE /api/v1/properties/:pid
 * Delete (archive) a property
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { pid } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    const supabase = await createClient();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from("properties")
      .select("owner_id, unique_code")
      .eq("id", pid)
      .single();

    if (fetchError || !existing) {
      return apiError("Propriété non trouvée", 404, "NOT_FOUND");
    }

    if (auth.profile.role === "owner" && existing.owner_id !== auth.profile.id) {
      return apiError("Accès non autorisé", 403, "FORBIDDEN");
    }

    // Check for active leases
    const { data: activeLeases } = await supabase
      .from("leases")
      .select("id")
      .eq("property_id", pid)
      .eq("statut", "active")
      .limit(1);

    if (activeLeases && activeLeases.length > 0) {
      return apiError("Impossible de supprimer: bail actif en cours", 409, "ACTIVE_LEASE");
    }

    // Archive instead of delete (preserve unique_code)
    const { error } = await supabase
      .from("properties")
      .update({ etat: "archived" })
      .eq("id", pid);

    if (error) {
      console.error("[DELETE /properties/:pid] Error:", error);
      return apiError("Erreur lors de la suppression", 500);
    }

    // Audit log
    await logAudit(
      supabase,
      "property.archived",
      "properties",
      pid,
      auth.user.id,
      existing,
      { etat: "archived" }
    );

    return apiSuccess({ message: "Propriété archivée" }, 200);
  } catch (error: unknown) {
    console.error("[DELETE /properties/:pid] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

