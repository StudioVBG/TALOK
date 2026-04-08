export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess, getPaginationParams } from "@/lib/api/middleware";

/**
 * GET /api/v1/tenants
 * List tenants associated with the owner's properties via active leases
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "tenants");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const propertyId = searchParams.get("property_id");
    const leaseId = searchParams.get("lease_id");

    // Get owner's properties
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", auth.profileId);

    if (!properties || properties.length === 0) {
      return apiSuccess({ tenants: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const propertyIds = properties.map((p: any) => p.id);

    // Get leases for those properties
    let leasesQuery = supabase
      .from("leases")
      .select("id")
      .in("property_id", propertyIds)
      .in("statut", ["active", "notice_given"]);

    if (propertyId && propertyIds.includes(propertyId)) {
      leasesQuery = leasesQuery.eq("property_id", propertyId);
    }
    if (leaseId) {
      leasesQuery = leasesQuery.eq("id", leaseId);
    }

    const { data: leases } = await leasesQuery;

    if (!leases || leases.length === 0) {
      return apiSuccess({ tenants: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const leaseIds = leases.map((l: any) => l.id);

    // Get tenant profiles via lease_signers
    const { data: signers, error, count } = await supabase
      .from("lease_signers")
      .select(`
        lease_id,
        role,
        profiles!inner(id, prenom, nom, email, telephone, role)
      `, { count: "exact" })
      .in("lease_id", leaseIds)
      .in("role", ["locataire_principal", "colocataire"])
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[GET /v1/tenants] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    const tenants = (signers || []).map((s: any) => ({
      id: s.profiles.id,
      prenom: s.profiles.prenom,
      nom: s.profiles.nom,
      email: s.profiles.email,
      telephone: s.profiles.telephone,
      lease_id: s.lease_id,
      lease_role: s.role,
    }));

    const response = apiSuccess({
      tenants,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/tenants] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
