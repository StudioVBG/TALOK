export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { checkStoragePathAccess } from "@/lib/helpers/document-access";

/**
 * GET /api/documents/view?path=xxx
 *
 * Retourne le contenu d'un document stocké dans Supabase Storage.
 * Vérifie les droits d'accès avant de servir le document.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const storagePath = url.searchParams.get("path");

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
    
    // Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await serviceClient.storage
      .from("documents")
      .download(storagePath);
    
    if (downloadError || !fileData) {
      console.error("[View] Erreur téléchargement:", downloadError);
      return NextResponse.json({ 
        error: "Document non trouvé",
        details: downloadError?.message 
      }, { status: 404 });
    }
    
    // Déterminer le type MIME
    const extension = storagePath.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    
    switch (extension) {
      case "html":
        contentType = "text/html; charset=utf-8";
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
    
    // Retourner le contenu
    const arrayBuffer = await fileData.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-cache, must-revalidate",
      },
    });
    
  } catch (error: unknown) {
    console.error("[View] Erreur:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}




