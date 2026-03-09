export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/owner/identity/documents
 * Récupère les documents d'identité (CNI recto/verso) du propriétaire connecté
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { data: docs, error: docsError } = await serviceClient
      .from("documents")
      .select("id, type, storage_path, metadata, created_at, verification_status")
      .eq("owner_id", profile.id)
      .in("type", ["piece_identite", "cni_recto", "cni_verso"])
      .order("created_at", { ascending: false });

    if (docsError) {
      console.error("[GET /api/owner/identity/documents] Error:", docsError);
      return NextResponse.json(
        { error: docsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: docs || [] });
  } catch (error: unknown) {
    console.error("[GET /api/owner/identity/documents] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
