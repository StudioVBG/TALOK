export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  requireAuth,
  requireRole,
  requireApiAccess,
  validateBody,
  getPaginationParams,
  logAudit,
} from "@/lib/api/middleware";
import { CreateLeaseSchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/leases
 * List leases for the authenticated user (owner sees their properties' leases, tenant sees their own)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    // SOTA 2026: Gating api_access (Pro+) - only for owners
    if (auth.profile.role === "owner") {
      const apiAccessCheck = await requireApiAccess(auth.profile);
      if (apiAccessCheck) return apiAccessCheck;
    }

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const status = searchParams.get("status");

    let query = supabase
      .from("leases")
      .select(`
        *,
        properties!inner(id, adresse_complete, ville, owner_id),
        lease_signers(*, profiles(id, prenom, nom, role))
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter based on role
    if (auth.profile.role === "owner") {
      // Owner: leases for their properties
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", auth.profile.id);

      if (properties && properties.length > 0) {
        query = query.in("property_id", properties.map((p) => p.id));
      } else {
        return apiSuccess({ leases: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    } else if (auth.profile.role === "tenant") {
      // Tenant: leases where they are a signer
      const { data: signers } = await supabase
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", auth.profile.id);

      if (signers && signers.length > 0) {
        query = query.in("id", signers.map((s) => s.lease_id));
      } else {
        return apiSuccess({ leases: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    } else if (auth.profile.role !== "admin") {
      return apiError("Accès non autorisé", 403);
    }

    if (status && status !== "all") {
      query = query.eq("statut", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /leases] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({
      leases: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /leases] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/leases
 * Create a new lease (draft)
 * Events: Lease.Drafted
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    // SOTA 2026: Gating api_access (Pro+)
    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const supabase = await createClient();
    const body = await request.json();
    const { data, error: validationError } = validateBody(CreateLeaseSchema, body);

    if (validationError) return validationError;

    // Verify property ownership
    if (data.property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", data.property_id)
        .single();

      if (!property) {
        return apiError("Propriété non trouvée", 404);
      }

      if (auth.profile.role === "owner" && property.owner_id !== auth.profile.id) {
        return apiError("Accès non autorisé à cette propriété", 403);
      }
    }

    // Create lease
    const { data: lease, error } = await supabase
      .from("leases")
      .insert({
        ...data,
        statut: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /leases] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Add owner as signer
    await supabase.from("lease_signers").insert({
      lease_id: lease.id,
      profile_id: auth.profile.id,
      role: "proprietaire",
      signature_status: "pending",
    });

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Lease.Drafted",
      payload: {
        lease_id: lease.id,
        property_id: data.property_id,
        owner_id: auth.profile.id,
      },
    });

    // Audit log
    await logAudit(
      supabase,
      "lease.created",
      "leases",
      lease.id,
      auth.user.id,
      null,
      lease
    );

    return apiSuccess({ lease }, 201);
  } catch (error: unknown) {
    console.error("[POST /leases] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

