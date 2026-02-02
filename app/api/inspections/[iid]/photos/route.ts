export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** Max file size: 5 MB (safe margin under Netlify's 6MB body limit) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed MIME types for photos */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/inspections/[iid]/photos - Uploader des photos pour un EDL
 * @version 2026-01-29 - Fix: validation, Promise.allSettled, structured logging
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

    // Validate files before any upload attempt
    const validationErrors: string[] = [];
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        validationErrors.push(
          `"${file.name}" : format non supporté (${file.type || "inconnu"}). Utilisez JPEG, PNG ou WebP.`
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        validationErrors.push(
          `"${file.name}" : taille trop importante (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 5 Mo.`
        );
      }
    }
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Fichiers invalides", details: validationErrors },
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

    // Upload files using Promise.allSettled for resilience
    const uploadPromises = files.map(async (file) => {
      const startTime = Date.now();
      const fileName = `edl/${iid}/${Date.now()}_${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(JSON.stringify({
          event: "edl_photo_upload_error",
          edlId: iid,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          duration: Date.now() - startTime,
          error: uploadError.message,
        }));
        throw uploadError;
      }

      // Créer l'entrée dans edl_media
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
        console.error(JSON.stringify({
          event: "edl_photo_media_insert_error",
          edlId: iid,
          storagePath: uploadData.path,
          error: mediaError.message,
        }));
        // Cleanup: remove the orphaned storage file
        await supabase.storage.from("documents").remove([uploadData.path]).catch(() => {});
        throw mediaError;
      }

      console.log(JSON.stringify({
        event: "edl_photo_upload_success",
        edlId: iid,
        mediaId: media.id,
        fileSize: file.size,
        mimeType: file.type,
        duration: Date.now() - startTime,
      }));

      return media;
    });

    const results = await Promise.allSettled(uploadPromises);

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason?.message || "Erreur inconnue");

    if (succeeded.length === 0) {
      // All uploads failed
      return NextResponse.json(
        {
          error: "Tous les uploads ont échoué",
          details: failed,
        },
        { status: 500 }
      );
    }

    // Return partial success if some failed
    return NextResponse.json({
      files: succeeded,
      ...(failed.length > 0 && {
        partial: true,
        errors: failed,
        message: `${succeeded.length}/${files.length} photos uploadées avec succès`,
      }),
    });
  } catch (error: unknown) {
    console.error("[POST /api/inspections/[iid]/photos] Unhandled error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
