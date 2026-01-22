export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { ensureDocumentGallerySupport, getDocumentGallerySupportMessage } from "@/lib/server/document-gallery";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const payload = await request.json().catch(() => ({}));
    const position = typeof payload.position === "number" ? payload.position : undefined;
    const setCover: boolean = Boolean(payload.isCover);

    if (position === undefined && !setCover) {
      return NextResponse.json(
        { error: "Aucun changement demandé (position ou isCover requis)." },
        { status: 400 }
      );
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

    const supportsGallery = await ensureDocumentGallerySupport(serviceClient);

    if (!supportsGallery) {
      return NextResponse.json(
        { error: getDocumentGallerySupportMessage() },
        { status: 409 }
      );
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const profileData = profile as any;

    const { data: document, error: documentError } = await serviceClient
      .from("documents")
      .select("id, property_id, lease_id, owner_id, tenant_id, collection, position, is_cover")
      .eq("id", id as any)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    const isAdmin = profileData.role === "admin";
    const isOwner = document.owner_id && document.owner_id === profileData.id;
    const isTenant = document.tenant_id && document.tenant_id === profileData.id;

    if (!isAdmin && !isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce document." },
        { status: 403 }
      );
    }

    const targetCollection = document.collection ?? "property_media";
    const peersQuery = serviceClient
      .from("documents")
      .select("id, position")
      .eq("collection", targetCollection)
      .order("position", { ascending: true });

    if (document.property_id) {
      peersQuery.eq("property_id", document.property_id);
    } else if (document.lease_id) {
      peersQuery.eq("lease_id", document.lease_id);
    } else if (document.owner_id) {
      peersQuery.eq("owner_id", document.owner_id);
    } else if (document.tenant_id) {
      peersQuery.eq("tenant_id", document.tenant_id);
    }

    const { data: siblings, error: siblingsError } = await peersQuery;

    if (siblingsError) {
      return NextResponse.json(
        { error: "Impossible de récupérer les documents pour ré-ordonnancement." },
        { status: 500 }
      );
    }

    if (!siblings || siblings.length === 0) {
      return NextResponse.json({ error: "Aucun document à ordonner." }, { status: 404 });
    }

    if (position !== undefined) {
      const maxIndex = siblings.length - 1;
      const sanitizedIndex = Math.min(Math.max(position - 1, 0), maxIndex);

      const withoutCurrent = siblings.filter((item) => item.id !== document.id);
      const reordered = [
        ...withoutCurrent.slice(0, sanitizedIndex),
        { id: document.id, position: sanitizedIndex + 1 },
        ...withoutCurrent.slice(sanitizedIndex),
      ];

      // Ré-attribuer les positions séquentielles
      for (let idx = 0; idx < reordered.length; idx += 1) {
        const item = reordered[idx];
        const newPosition = idx + 1;

        if (item.position !== newPosition) {
          const { error: updateError } = await serviceClient
            .from("documents")
            .update({ position: newPosition })
            .eq("id", item.id);

          if (updateError) {
            return NextResponse.json(
              { error: "Erreur lors de la mise à jour de la position." },
              { status: 500 }
            );
          }
        }
      }
    }

    if (setCover) {
      const { error: resetError } = await serviceClient
        .from("documents")
        .update({ is_cover: false })
        .eq("collection", targetCollection)
        .eq("property_id", document.property_id ?? null)
        .eq("lease_id", document.lease_id ?? null);

      if (resetError) {
        return NextResponse.json(
          { error: "Impossible de mettre à jour le document principal." },
          { status: 500 }
        );
      }

      const { error: coverError } = await serviceClient
        .from("documents")
        .update({ is_cover: true })
        .eq("id", document.id);

      if (coverError) {
        return NextResponse.json(
          { error: "Impossible de définir le document principal." },
          { status: 500 }
        );
      }
    }

    const { data: updatedDocument, error: refreshedError } = await serviceClient
      .from("documents")
      .select("*")
      .eq("id", document.id)
      .single();

    if (refreshedError || !updatedDocument) {
      return NextResponse.json(
        { error: "Impossible de récupérer le document mis à jour." },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: updatedDocument });
  } catch (error: unknown) {
    console.error("Error in PATCH /api/documents/[id]/reorder:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: error.status || 500 }
    );
  }
}





