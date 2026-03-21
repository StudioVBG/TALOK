export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/**
 * GET /api/documents/file?path=xxx&disposition=inline|attachment&filename=xxx
 * SOTA 2026: Route unifiee remplacant /documents/view et /documents/download
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storagePath = url.searchParams.get("path");
    const disposition = url.searchParams.get("disposition") || "inline";
    const customFilename = url.searchParams.get("filename");

    if (!storagePath) return NextResponse.json({ error: "path requis" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient.from("profiles").select("id, role").eq("user_id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

    // Access check for lease-related paths
    const pathParts = storagePath.split("/");
    if (pathParts[0] === "leases" && pathParts[1]) {
      const leaseId = pathParts[1];
      const { data: lease } = await serviceClient
        .from("leases")
        .select("id, property:properties!leases_property_id_fkey(owner_id), signers:lease_signers(profile_id)")
        .eq("id", leaseId)
        .single();

      if (!lease) return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });

      const isOwner = (lease as any).property?.owner_id === profile.id;
      const isSigner = (lease as any).signers?.some((s: any) => s.profile_id === profile.id);
      const isAdmin = profile.role === "admin";
      if (!isOwner && !isSigner && !isAdmin) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: fileData, error: downloadError } = await serviceClient.storage.from("documents").download(storagePath);
    if (downloadError || !fileData) return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });

    const extension = storagePath.split(".").pop()?.toLowerCase() || "";
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const filename = customFilename || storagePath.split("/").pop() || "document";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": disposition === "inline" ? "private, max-age=3600" : "private, no-cache",
    };

    if (disposition === "attachment") {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(filename)}"`;
    }

    return new NextResponse(await fileData.arrayBuffer(), { status: 200, headers });
  } catch (error: unknown) {
    console.error("[Documents/File] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}
