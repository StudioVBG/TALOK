export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, getUserProfile } from "@/lib/helpers/edl-auth";

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
 * @version 2026-02-03 - Fix: use service client for storage + edl_media to bypass RLS
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ iid: string }> }
) {
  let iid = "unknown";

  try {
    const resolvedParams = await params;
    iid = resolvedParams.iid;

    // Auth: user-level client for authentication only
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Service client for DB and storage operations (bypasses RLS)
    const serviceClient = createServiceClient();

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

    // Vérifier l'accès à l'EDL via service client (bypass RLS)
    const { data: edl, error: edlError } = await serviceClient
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
      console.error(`[Photos] EDL ${iid} error:`, edlError);
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const edlData = edl as any;

    // Check if user is owner of the property or a signer
    let isOwner = false;
    const propId = edlData.property_id || edlData.lease?.property_id;

    if (propId) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", propId)
        .single();
      if (property?.owner_id === profile.id) isOwner = true;
    } else if (edlData.lease?.property?.owner_id === profile.id) {
      isOwner = true;
    }

    const isAdmin = profile.role === "admin";
    const signerIds = edlData?.lease?.signers?.map((s: any) => s.profile_id) || [];
    const hasAccess = isAdmin || isOwner || signerIds.includes(profile.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Upload files using Promise.allSettled for resilience
    // Use service client for storage to bypass bucket RLS policies
    const uploadPromises = files.map(async (file) => {
      const startTime = Date.now();
      const fileName = `edl/${iid}/${Date.now()}_${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { data: uploadData, error: uploadError } = await serviceClient.storage
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

      // Créer l'entrée dans edl_media via service client (bypass RLS)
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

      const { data: media, error: mediaError } = await serviceClient
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
        await serviceClient.storage.from("documents").remove([uploadData.path]).catch(() => {});
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
    console.error(`[POST /api/inspections/${iid}/photos] Unhandled error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inspections/[iid]/photos - Récupérer les photos d'un EDL
 * ?item_id=xxx - Filtrer par item_id (optionnel)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ iid: string }> }
) {
  let iid = "unknown";

  try {
    const resolvedParams = await params;
    iid = resolvedParams.iid;

    // Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Vérifier l'accès à l'EDL
    const { data: edl, error: edlError } = await serviceClient
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
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const edlData = edl as any;

    // Vérifier les droits d'accès
    let isOwner = false;
    const propId = edlData.property_id || edlData.lease?.property_id;

    if (propId) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", propId)
        .single();
      if (property?.owner_id === profile.id) isOwner = true;
    } else if (edlData.lease?.property?.owner_id === profile.id) {
      isOwner = true;
    }

    const isAdmin = profile.role === "admin";
    const signerIds = edlData?.lease?.signers?.map((s: any) => s.profile_id) || [];
    const hasAccess = isAdmin || isOwner || signerIds.includes(profile.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les photos
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("item_id");

    let query = serviceClient
      .from("edl_media")
      .select("*")
      .eq("edl_id", iid)
      .order("created_at", { ascending: true });

    if (itemId) {
      query = query.eq("item_id", itemId);
    }

    const { data: photos, error: photosError } = await query;

    if (photosError) {
      console.error(`[GET /api/inspections/${iid}/photos] Query error:`, photosError);
      return NextResponse.json(
        { error: photosError.message },
        { status: 400 }
      );
    }

    // Générer les URLs signées pour chaque photo
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo: any) => {
        if (!photo.storage_path) return { ...photo, url: null };

        const { data: urlData } = await serviceClient
          .storage
          .from("documents")
          .createSignedUrl(photo.storage_path, 3600);

        return {
          ...photo,
          url: urlData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json(photosWithUrls);
  } catch (error: unknown) {
    console.error(`[GET /api/inspections/${iid}/photos] Unhandled error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
