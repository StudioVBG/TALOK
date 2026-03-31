export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { checkStoragePathAccess } from "@/lib/helpers/document-access";

/**
 * GET /api/documents/download?path=xxx
 *
 * Télécharge un document stocké dans Supabase Storage.
 * Force le téléchargement (Content-Disposition: attachment).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storagePath = url.searchParams.get("path");
    const customFilename = url.searchParams.get("filename");

    if (!storagePath) {
      return NextResponse.json({ error: "path requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les droits d'accès via le helper unifié
    const hasAccess = await checkStoragePathAccess(serviceClient, storagePath, profile as any);
    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    
    // Télécharger le fichier
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(storagePath);
    
    if (downloadError || !fileData) {
      return NextResponse.json({ 
        error: "Document non trouvé" 
      }, { status: 404 });
    }
    
    // Déterminer le nom du fichier
    const originalFilename = storagePath.split("/").pop() || "document";
    const filename = customFilename || originalFilename;
    
    // Déterminer le type MIME
    const extension = filename.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    
    switch (extension) {
      case "html":
        contentType = "text/html";
        break;
      case "pdf":
        contentType = "application/pdf";
        break;
      case "png":
        contentType = "image/png";
        break;
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
    }
    
    const arrayBuffer = await fileData.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, no-cache",
      },
    });
    
  } catch (error: unknown) {
    console.error("[Download] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}




