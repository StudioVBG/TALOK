export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/edl-media/[id] - Récupérer un média EDL
 */
export async function GET(
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

    const mediaId = params.id;

    const { data: media, error } = await supabase
      .from("edl_media")
      .select(`
        *,
        edl:edl!inner(
          id,
          lease:leases!inner(
            property:properties!inner(owner_id)
          )
        )
      `)
      .eq("id", mediaId)
      .single();

    if (error || !media) {
      return NextResponse.json({ error: "Média non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const ownerId = (media.edl as any)?.lease?.property?.owner_id;
    const isOwner = profile.id === ownerId;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json({ media });
  } catch (error: unknown) {
    console.error("[GET /api/edl-media/[id]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/edl-media/[id] - Mettre à jour un média EDL (section/room assignment)
 */
export async function PATCH(
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

    const mediaId = params.id;
    const body = await request.json();
    const { section, item_id } = body;

    // Récupérer le média avec ses relations pour vérifier les permissions
    const { data: media, error: fetchError } = await supabase
      .from("edl_media")
      .select(`
        *,
        edl:edl!inner(
          id,
          lease:leases!inner(
            property:properties!inner(owner_id)
          )
        )
      `)
      .eq("id", mediaId)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: "Média non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const ownerId = (media.edl as any)?.lease?.property?.owner_id;
    const isOwner = profile.id === ownerId;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Construire les mises à jour
    const updates: Record<string, any> = {};
    if (section !== undefined) {
      updates.section = section;
    }
    if (item_id !== undefined) {
      updates.item_id = item_id;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }

    // Mettre à jour
    const { data: updatedMedia, error: updateError } = await supabase
      .from("edl_media")
      .update(updates)
      .eq("id", mediaId)
      .select()
      .single();

    if (updateError) {
      console.error("[PATCH /api/edl-media/[id]]", updateError);
      return NextResponse.json(
        { error: updateError.message || "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    return NextResponse.json({ media: updatedMedia });
  } catch (error: unknown) {
    console.error("[PATCH /api/edl-media/[id]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/edl-media/[id] - Supprimer un média EDL
 */
export async function DELETE(
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

    const mediaId = params.id;

    // Récupérer le média avec ses relations pour vérifier les permissions
    const { data: media, error: fetchError } = await supabase
      .from("edl_media")
      .select(`
        *,
        edl:edl!inner(
          id,
          lease:leases!inner(
            property:properties!inner(owner_id)
          )
        )
      `)
      .eq("id", mediaId)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: "Média non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const ownerId = (media.edl as any)?.lease?.property?.owner_id;
    const isOwner = profile.id === ownerId;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Supprimer le fichier du storage si présent
    if (media.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("documents")
        .remove([media.storage_path]);

      if (storageError) {
        console.warn("[DELETE /api/edl-media/[id]] Storage deletion warning:", storageError);
        // Ne pas bloquer la suppression de l'enregistrement si le fichier n'existe pas
      }
    }

    // Supprimer l'enregistrement
    const { error: deleteError } = await supabase
      .from("edl_media")
      .delete()
      .eq("id", mediaId);

    if (deleteError) {
      console.error("[DELETE /api/edl-media/[id]]", deleteError);
      return NextResponse.json(
        { error: deleteError.message || "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/edl-media/[id]]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

