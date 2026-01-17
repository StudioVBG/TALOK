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
  checkIdempotency,
  storeIdempotency,
} from "@/lib/api/middleware";
import { CreatePropertySchema } from "@/lib/api/schemas";

/**
 * GET /api/v1/properties
 * List properties for the authenticated owner
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    const roleCheck = requireRole(auth.profile, ["owner", "admin"]);
    if (roleCheck) return roleCheck;

    // SOTA 2026: Gating api_access (Pro+)
    const apiAccessCheck = await requireApiAccess(auth.profile);
    if (apiAccessCheck) return apiAccessCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    // Filters
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    let query = supabase
      .from("properties")
      .select("*, units(count), leases(count)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Owner filter (admin can see all)
    if (auth.profile.role === "owner") {
      query = query.eq("owner_id", auth.profile.id);
    }

    if (status && status !== "all") {
      query = query.eq("etat", status);
    }

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    if (search) {
      query = query.or(`adresse_complete.ilike.%${search}%,ville.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /properties] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    return apiSuccess({
      properties: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /properties] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/properties
 * Create a new property
 * Events: Property.Created
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

    // Check idempotency
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const cached = await checkIdempotency(supabase, idempotencyKey, "property");
      if (cached) {
        return new Response(JSON.stringify(cached.cached.response_body), {
          status: cached.cached.response_status,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(CreatePropertySchema, body);

    if (validationError) return validationError;

    // Generate unique code (never reusable)
    const { data: codeData } = await supabase.rpc("generate_unique_code");
    const uniqueCode = codeData || `PROP-${Date.now().toString(36).toUpperCase()}`;

    // Create property
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        owner_id: auth.profile.id,
        unique_code: uniqueCode,
        etat: "draft",
        ...data,
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /properties] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    // Emit event
    await supabase.from("outbox").insert({
      event_type: "Property.Created",
      payload: {
        property_id: property.id,
        owner_id: auth.profile.id,
        unique_code: uniqueCode,
      },
    });

    // Audit log
    await logAudit(
      supabase,
      "property.created",
      "properties",
      property.id,
      auth.user.id,
      null,
      property
    );

    const response = {
      property,
      unique_code: uniqueCode,
    };

    // Store idempotency
    if (idempotencyKey) {
      await storeIdempotency(supabase, idempotencyKey, "property", response, 201);
    }

    return apiSuccess(response, 201);
  } catch (error: unknown) {
    console.error("[POST /properties] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

