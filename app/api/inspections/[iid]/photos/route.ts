export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/inspections/[iid]/photos - Uploader des photos pour un EDL
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ iid: string }> }
) {
  try {
    const { iid } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const section = formData.get("section") as string;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Au moins un fichier requis" },
        { status: 400 }
      );
    }

    // Vérifier l'accès à l'EDL
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        id,
        property_id,
        lease_id,
        lease:leases(
          property_id,
          property:properties(owner_id),
          signers:lease_signers(profile_id)
        )
      `)
      .eq("id", iid)
      .single();

    if (edlError || !edl) {
      console.error("[Photos] EDL error:", edlError);
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const edlData = edl as any;
    
    // Check if user is owner of the property
    let isOwner = false;
    const propId = edlData.property_id || edlData.lease?.property_id;
    
    if (propId) {
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", propId)
        .single();
      if (property?.owner_id === profileData.id) isOwner = true;
    } else if (edlData.lease?.property?.owner_id === profileData.id) {
      isOwner = true;
    }

    const signerIds = edlData?.lease?.signers?.map((s: any) => s.profile_id) || [];
    const hasAccess = isOwner || signerIds.includes(profileData?.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Uploader les fichiers
    const uploadedFiles = [];
    for (const file of files) {
      const fileName = `edl/${iid}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Créer l'entrée dans edl_media
      // Note: la colonne "section" peut ne pas exister si le script APPLY_MANUALLY.sql n'a pas été exécuté
      const mediaPayload: any = {
        edl_id: iid,
        item_id: itemId || null,
        storage_path: uploadData.path,
        media_type: "photo",
        taken_at: new Date().toISOString(),
      };
      
      // Ajouter section seulement si fournie (éviter erreur si colonne absente)
      if (section) {
        mediaPayload.section = section;
      }
      
      const { data: media, error: mediaError } = await supabase
        .from("edl_media")
        .insert(mediaPayload)
        .select()
        .single();

      if (mediaError) {
        console.error("[Photos] Media insert error:", mediaError);
        throw mediaError;
      }
      uploadedFiles.push(media);
    }

    return NextResponse.json({ files: uploadedFiles });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

