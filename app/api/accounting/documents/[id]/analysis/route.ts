/**
 * API Route: Document Analysis Status
 * GET /api/accounting/documents/[id]/analysis — Poll analysis status
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: documentId } = await params;
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifié");

    // Service-role + check métier (owner du document via l'entity du profile).
    // Voir docs/audits/rls-cascade-audit.md.
    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const { data: analysis } = await (supabase as any)
      .from("document_analyses")
      .select("*, document:documents(owner_id, tenant_id, lease_id)")
      .eq("document_id", documentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!analysis) {
      throw new ApiError(404, "Aucune analyse trouvée pour ce document");
    }

    const profileData = profile as { id: string; role: string };
    const isAdmin = profileData.role === "admin";
    const isOwner = analysis.document?.owner_id === profileData.id;
    const isTenant = analysis.document?.tenant_id === profileData.id;

    if (!isAdmin && !isOwner && !isTenant) {
      throw new ApiError(403, "Accès non autorisé");
    }

    return NextResponse.json({ success: true, data: analysis });
  } catch (error) {
    return handleApiError(error);
  }
}
