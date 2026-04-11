export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { ensureDocumentGallerySupport } from "@/lib/server/document-gallery";
import { getServiceClient } from "@/lib/supabase/service-client";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

// ============================================
// GET /api/documents/[id] — Recuperer un document par ID
// ============================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document non trouve" }, { status: 404 });
    }

    const doc = document as any;
    const profileData = profile as any;
    const hasAccess =
      profileData.role === "admin" ||
      doc.owner_id === profileData.id ||
      doc.tenant_id === profileData.id;

    if (!hasAccess && doc.lease_id) {
      const { data: signer } = await serviceClient
        .from("lease_signers")
        .select("id")
        .eq("lease_id", doc.lease_id)
        .eq("profile_id", profileData.id)
        .maybeSingle();
      if (!signer) {
        return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
      }
    } else if (!hasAccess) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    let signedUrl: string | null = null;
    if (doc.storage_path) {
      const { data: urlData } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600);
      signedUrl = urlData?.signedUrl ?? null;
    }

    return NextResponse.json({ document: { ...doc, signed_url: signedUrl } });
  } catch (error: unknown) {
    console.error("Error in GET /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/documents/[id] — Modifier title, type, metadata, visible_tenant
// ============================================
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const { data: document, error: docError } = await serviceClient
      .from("documents")
      .select("id, owner_id, tenant_id, uploaded_by")
      .eq("id", id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: "Document non trouve" }, { status: 404 });
    }

    const doc = document as any;
    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = doc.owner_id === profileData.id;
    const isUploader = doc.uploaded_by === profileData.id;

    if (!isAdmin && !isOwner && !isUploader) {
      return NextResponse.json({ error: "Modification non autorisee" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.type !== undefined) {
      if (!(DOCUMENT_TYPES as readonly string[]).includes(body.type)) {
        return NextResponse.json({ error: `Type invalide: ${body.type}` }, { status: 400 });
      }
      updates.type = body.type;
    }
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.visible_tenant !== undefined) updates.visible_tenant = body.visible_tenant;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await serviceClient
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ document: updated });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/documents/[id] — Supprimer un document
// ============================================
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: extractErrorMessage(error), details: (error as any).details },
        { status: (error as any).status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante (service role key)" },
        { status: 500 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const supportsGallery = await ensureDocumentGallerySupport(serviceClient);
    const baseColumns = ["id", "property_id", "lease_id", "owner_id", "tenant_id", "storage_path"];
    if (supportsGallery) {
      baseColumns.push("collection", "position", "is_cover");
    }

    const { data: document, error: documentError } = await serviceClient
      .from("documents")
      .select(baseColumns.join(", "))
      .eq("id", id as any)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    const doc = document as unknown as {
      id: string;
      property_id?: string | null;
      lease_id?: string | null;
      owner_id?: string | null;
      tenant_id?: string | null;
      storage_path: string;
      collection?: string;
      position?: number;
      is_cover?: boolean;
    };

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = doc.owner_id && doc.owner_id === profileData.id;
    const isTenant = doc.tenant_id && doc.tenant_id === profileData.id;

    if (!isAdmin && !isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce document." },
        { status: 403 }
      );
    }

    const { error: storageError } = await serviceClient.storage
      .from("documents")
      .remove([doc.storage_path]);

    if (storageError) {
      console.error("Erreur lors de la suppression du fichier Storage:", storageError);
    }

    const { error: deleteError } = await serviceClient
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "Impossible de supprimer le document." },
        { status: 500 }
      );
    }

    // Gérer le cover si nécessaire
    if (supportsGallery && doc.is_cover) {
      const peersQuery = serviceClient
        .from("documents")
        .select("id")
        .eq("collection", doc.collection ?? "property_media")
        .order("position", { ascending: true })
        .limit(1);

      if (doc.property_id) {
        peersQuery.eq("property_id", doc.property_id);
      } else if (doc.lease_id) {
        peersQuery.eq("lease_id", doc.lease_id);
      } else if (doc.owner_id) {
        peersQuery.eq("owner_id", doc.owner_id);
      } else if (doc.tenant_id) {
        peersQuery.eq("tenant_id", doc.tenant_id);
      }

      const { data: nextCover, error: nextCoverError } = await peersQuery;

      if (!nextCoverError && nextCover && nextCover.length > 0) {
        await serviceClient
          .from("documents")
          .update({ is_cover: true })
          .eq("id", nextCover[0].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error in DELETE /api/documents/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? (error as Error).message : "Erreur serveur" },
      { status: (error as any).status || 500 }
    );
  }
}





