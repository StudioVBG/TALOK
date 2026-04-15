export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/properties/[id]/building-unit
 *
 * Retourne le `building_unit` correspondant à la property (si c'est un lot
 * d'immeuble), ou `{ unit: null }` sinon.
 *
 * Utilisé par LeaseWizard (item #12 de l'audit) pour prioriser les valeurs
 * loyer_hc / charges / depot_garantie du lot sur celles de la property,
 * qui peuvent diverger.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    const serviceClient = getServiceClient();

    // Auth : le user doit pouvoir voir la property (owner direct ou admin ou
    // membre de l'entité légale). On laisse RLS gérer via une requête avec
    // le client auth-scoped — ici on fait simple : service client + check owner.
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");

    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id, legal_entity_id")
      .eq("id", propertyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!property) {
      return NextResponse.json({ unit: null });
    }

    // Check access: owner direct, admin, ou membre de l'entité
    let hasAccess = profile.role === "admin" || property.owner_id === profile.id;
    if (!hasAccess && property.legal_entity_id) {
      const { data: membership } = await serviceClient
        .from("entity_members")
        .select("id")
        .eq("entity_id", property.legal_entity_id)
        .eq("user_id", user.id)
        .maybeSingle();
      hasAccess = !!membership;
    }
    if (!hasAccess) {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Lookup building_unit par property_id
    const { data: unit } = await serviceClient
      .from("building_units")
      .select(
        "id, building_id, floor, position, type, surface, nb_pieces, loyer_hc, charges, depot_garantie, status"
      )
      .eq("property_id", propertyId)
      .is("deleted_at", null)
      .maybeSingle();

    return NextResponse.json({ unit: unit ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
