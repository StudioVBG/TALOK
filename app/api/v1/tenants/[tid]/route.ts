export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess } from "@/lib/api/middleware";

/**
 * GET /api/v1/tenants/[tid]
 * Get tenant details (only if associated with owner's properties)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tid: string }> }
) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "tenants");
    if (scopeCheck) return scopeCheck;

    const { tid } = await params;
    const supabase = await createClient();

    // Verify tenant is associated with owner's properties
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", auth.profileId);

    if (!properties || properties.length === 0) {
      return apiError("Locataire non trouvé", 404, "NOT_FOUND");
    }

    const propertyIds = properties.map((p: any) => p.id);

    // Check tenant has a lease on one of owner's properties
    const { data: signers } = await supabase
      .from("lease_signers")
      .select(`
        lease_id,
        role,
        leases!inner(id, property_id, statut, date_debut, date_fin, loyer, charges_forfaitaires)
      `)
      .eq("profile_id", tid)
      .in("role", ["locataire_principal", "colocataire"]);

    const validSigners = (signers || []).filter((s: any) =>
      propertyIds.includes(s.leases?.property_id)
    );

    if (validSigners.length === 0) {
      return apiError("Locataire non trouvé", 404, "NOT_FOUND");
    }

    // Get profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, prenom, nom, email, telephone, date_naissance, created_at")
      .eq("id", tid)
      .single();

    if (error || !profile) {
      return apiError("Locataire non trouvé", 404, "NOT_FOUND");
    }

    const leases = validSigners.map((s: any) => ({
      lease_id: s.lease_id,
      role: s.role,
      status: s.leases?.statut,
      date_debut: s.leases?.date_debut,
      date_fin: s.leases?.date_fin,
    }));

    const response = apiSuccess({
      tenant: {
        ...profile,
        leases,
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/tenants/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
