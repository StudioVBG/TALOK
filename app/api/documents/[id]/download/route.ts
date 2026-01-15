export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/documents/[id]/download - Générer un lien de téléchargement sécurisé
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const documentId = params.id;
    const body = await request.json();
    const { expires_in = 3600 } = body; // 1 heure par défaut

    // Récupérer le document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId as any)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document non trouvé" },
        { status: 404 }
      );
    }

    const docData = document as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isOwner = docData.owner_id === profileData?.id;
    const isTenant = docData.tenant_id === profileData?.id;
    const isAdmin = profileData?.role === "admin";

    // Vérifier si membre du bail
    let hasAccess = isOwner || isTenant || isAdmin;
    if (docData.lease_id && !hasAccess) {
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", docData.lease_id)
        .eq("user_id", user.id as any)
        .maybeSingle();
      hasAccess = !!roommate;
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    if (!docData.storage_path) {
      return NextResponse.json(
        { error: "Document sans fichier" },
        { status: 400 }
      );
    }

    // Générer une URL signée
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from("documents")
      .createSignedUrl(docData.storage_path, expires_in);

    if (urlError) throw urlError;

    // Optionnel : créer un lien de partage dans document_links
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in);

    await supabase.from("document_links").insert({
      document_id: documentId,
      token,
      expires_at: expiresAt.toISOString(),
      max_views: 1,
      created_by: user.id,
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "read",
      entity_type: "document",
      entity_id: documentId,
      metadata: { download: true },
    } as any);

    return NextResponse.json({
      download_url: signedUrl?.signedUrl,
      token,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

