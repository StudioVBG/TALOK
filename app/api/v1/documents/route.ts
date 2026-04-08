export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
  requirePermission,
  addRateLimitHeaders,
} from "@/lib/api/api-key-auth";
import { apiError, apiSuccess, getPaginationParams } from "@/lib/api/middleware";

/**
 * GET /api/v1/documents
 * List documents for the authenticated owner's properties
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "documents");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const { page, limit, offset } = getPaginationParams(searchParams);

    const type = searchParams.get("type");
    const propertyId = searchParams.get("property_id");
    const leaseId = searchParams.get("lease_id");

    // Get owner's properties for filtering
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("owner_id", auth.profileId);

    if (!properties || properties.length === 0) {
      return apiSuccess({ documents: [], pagination: { page, limit, total: 0, total_pages: 0 } });
    }

    const propertyIds = properties.map((p: any) => p.id);

    let query = supabase
      .from("documents")
      .select("id, title, type, file_name, mime_type, file_size, property_id, lease_id, created_at, updated_at", { count: "exact" })
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {
      query = query.eq("type", type);
    }
    if (propertyId && propertyIds.includes(propertyId)) {
      query = query.eq("property_id", propertyId);
    }
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[GET /v1/documents] Error:", error);
      return apiError("Erreur lors de la récupération", 500);
    }

    const response = apiSuccess({
      documents: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/documents] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

/**
 * POST /api/v1/documents
 * Upload a document (metadata only — file upload via signed URL)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "documents");
    if (scopeCheck) return scopeCheck;

    const permCheck = requirePermission(auth, "write");
    if (permCheck) return permCheck;

    const supabase = await createClient();
    const body = await request.json();

    const { title, type, property_id, lease_id, file_name, mime_type } = body;

    if (!title || !type || !property_id) {
      return apiError("title, type, and property_id are required", 400, "VALIDATION_ERROR");
    }

    // Verify property ownership
    const { data: property } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", property_id)
      .single();

    if (!property || property.owner_id !== auth.profileId) {
      return apiError("Propriété non trouvée", 404, "NOT_FOUND");
    }

    const { data: document, error } = await supabase
      .from("documents")
      .insert({
        title,
        type,
        property_id,
        lease_id: lease_id || null,
        file_name: file_name || title,
        mime_type: mime_type || "application/pdf",
        uploaded_by: auth.profileId,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[POST /v1/documents] Error:", error);
      return apiError("Erreur lors de la création", 500);
    }

    const response = apiSuccess({ document }, 201);
    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[POST /v1/documents] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
