export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/documents/[id]/copy-link - Générer un lien de partage copiable (BTN-U05)
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le document
    const { data: document } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id as any)
      .single();

    if (!document) {
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

    // Générer un token de partage
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

    // Créer un lien de partage
    const { data: shareLink, error } = await supabase
      .from("document_links")
      .insert({
        document_id: id,
        token,
        expires_at: expiresAt.toISOString(),
        max_views: 10, // Limite de vues
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Générer l'URL complète
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/documents/share/${token}`;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "document_link_created",
      entity_type: "document",
      entity_id: id,
      metadata: { token, expires_at: expiresAt.toISOString() },
    } as any);

    return NextResponse.json({
      share_url: shareUrl,
      token,
      expires_at: expiresAt.toISOString(),
      max_views: 10,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

