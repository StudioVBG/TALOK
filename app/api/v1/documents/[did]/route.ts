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
 * GET /api/v1/documents/[did]
 * Get document metadata + signed download URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ did: string }> }
) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "documents");
    if (scopeCheck) return scopeCheck;

    const { did } = await params;
    const supabase = await createClient();

    const { data: document, error } = await supabase
      .from("documents")
      .select("*, properties!inner(owner_id)")
      .eq("id", did)
      .single();

    if (error || !document) {
      return apiError("Document non trouvé", 404, "NOT_FOUND");
    }

    if ((document as any).properties?.owner_id !== auth.profileId) {
      return apiError("Document non trouvé", 404, "NOT_FOUND");
    }

    // Generate signed URL if storage_path exists
    let download_url: string | null = null;
    if (document.storage_path) {
      const { data: signedUrl } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.storage_path, 3600); // 1 hour

      download_url = signedUrl?.signedUrl || null;
    }

    const { properties, ...docWithoutRelation } = document as any;

    const response = apiSuccess({
      document: docWithoutRelation,
      download_url,
    });

    return addRateLimitHeaders(response, auth);
  } catch (error: unknown) {
    console.error("[GET /v1/documents/:id] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}
