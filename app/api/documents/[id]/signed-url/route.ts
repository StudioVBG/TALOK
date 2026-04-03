export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/[id]/signed-url
 * 
 * Génère une URL signée temporaire (1h) pour accéder au fichier
 * 🔒 Vérifie les permissions avant de générer l'URL
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const serviceClient = getServiceClient();

    // Récupérer le document
    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .select(`
        id,
        storage_path,
        owner_id,
        tenant_id,
        property_id,
        lease_id,
        type,
        visible_tenant
      `)
      .eq("id", id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
    }

    // 🔒 Vérifier les permissions selon le rôle
    let hasAccess = false;

    if (profile.role === "admin") {
      // Admin peut tout voir
      hasAccess = true;
    } else if (profile.role === "owner") {
      // Propriétaire : document lié à son profil ou ses propriétés
      if (document.owner_id === profile.id) {
        hasAccess = true;
      } else if (document.property_id) {
        // Vérifier si la propriété appartient au propriétaire
        const { data: property } = await serviceClient
          .from("properties")
          .select("id")
          .eq("id", document.property_id)
          .eq("owner_id", profile.id)
          .single();
        hasAccess = !!property;
      }
    } else if (profile.role === "tenant") {
      // Locataire : document lié à son profil ou ses baux (respect visible_tenant)
      if (document.tenant_id === profile.id && (document as any).visible_tenant !== false) {
        hasAccess = true;
      } else if (document.lease_id) {
        // Vérifier si le locataire est signataire du bail
        const { data: signer } = await serviceClient
          .from("lease_signers")
          .select("id")
          .eq("lease_id", document.lease_id)
          .eq("profile_id", profile.id)
          .single();
        // Tenant via lease signer must also respect visible_tenant
        hasAccess = !!signer && (document as any).visible_tenant !== false;
      }
    } else if (profile.role === "provider") {
      // Prestataire : documents liés à ses interventions
      if (document.property_id) {
        const { data: workOrder } = await serviceClient
          .from("work_orders")
          .select("id, tickets!inner(property_id)")
          .eq("provider_id", profile.id)
          .eq("tickets.property_id", document.property_id)
          .limit(1);
        hasAccess = !!(workOrder && workOrder.length > 0);
      }
    }

    if (!hasAccess) {
      console.warn(`[Signed URL] Accès refusé: user=${user.id}, doc=${id}, role=${profile.role}`);
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (!document.storage_path) {
      return NextResponse.json(
        { error: "Document sans fichier associé" },
        { status: 404 }
      );
    }

    // Générer l'URL signée (valide 1 heure)
    const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
      .from("documents")
      .createSignedUrl(document.storage_path, 3600); // 1 heure

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[Signed URL] Erreur génération:", signedUrlError);
      return NextResponse.json(
        { error: "Impossible de générer l'URL" },
        { status: 500 }
      );
    }

    // Détecter le mime type depuis le storage_path
    const ext = document.storage_path.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      html: "text/html",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mimeType = mimeMap[ext || ""] || "application/octet-stream";

    return NextResponse.json({
      signedUrl: signedUrlData.signedUrl,
      expiresIn: 3600,
      documentType: document.type,
      mimeType,
      storagePath: document.storage_path,
    });

  } catch (error: unknown) {
    console.error("[Signed URL] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

