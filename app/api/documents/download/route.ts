export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

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

    // ✅ FIX: Validation de sécurité du chemin (anti-traversal)
    const normalizedPath = storagePath.replace(/\\/g, "/");
    if (
      normalizedPath.includes("..") ||
      normalizedPath.includes("//") ||
      normalizedPath.startsWith("/") ||
      /[<>:"|?*]/.test(normalizedPath)
    ) {
      console.warn("[Download] Tentative de path traversal:", storagePath);
      return NextResponse.json({ error: "Chemin invalide" }, { status: 400 });
    }

    // ✅ FIX: Whitelist des préfixes autorisés
    const allowedPrefixes = [
      "leases/",
      "properties/",
      "signatures/",
      "documents/",
      "edl/",
      "tenant-documents/",
      "identity/",
    ];
    const hasAllowedPrefix = allowedPrefixes.some((prefix) =>
      normalizedPath.startsWith(prefix)
    );
    if (!hasAllowedPrefix) {
      console.warn("[Download] Préfixe non autorisé:", storagePath);
      return NextResponse.json({ error: "Chemin non autorisé" }, { status: 403 });
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
    
    // ✅ FIX: Vérifier les droits d'accès selon le type de document
    const pathParts = normalizedPath.split("/");
    const isAdmin = profile.role === "admin";

    // Admin a accès à tout
    if (!isAdmin) {
      if (pathParts[0] === "leases" && pathParts[1]) {
        const leaseId = pathParts[1];

        const { data: lease } = await serviceClient
          .from("leases")
          .select(`
            id,
            property:properties!leases_property_id_fkey(owner_id),
            signers:lease_signers(profile_id)
          `)
          .eq("id", leaseId)
          .single();

        if (!lease) {
          return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
        }

        const isOwner = (lease as any).property?.owner_id === profile.id;
        const isSigner = (lease as any).signers?.some((s: any) => s.profile_id === profile.id);

        if (!isOwner && !isSigner) {
          return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
        }
      } else if (pathParts[0] === "properties" && pathParts[1]) {
        // ✅ FIX: Vérifier accès aux documents de propriété
        const propertyId = pathParts[1];

        const { data: property } = await serviceClient
          .from("properties")
          .select("id, owner_id")
          .eq("id", propertyId)
          .single();

        if (!property) {
          return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
        }

        if (property.owner_id !== profile.id) {
          // Vérifier si l'utilisateur est locataire de cette propriété
          const { data: lease } = await serviceClient
            .from("leases")
            .select("id, signers:lease_signers(profile_id)")
            .eq("property_id", propertyId)
            .eq("statut", "active")
            .single();

          const isTenant = (lease as any)?.signers?.some((s: any) => s.profile_id === profile.id);
          if (!isTenant) {
            return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
          }
        }
      }
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
    
  } catch (error: any) {
    console.error("[Download] Erreur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




