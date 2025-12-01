// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/inspections/[iid]/photos - Uploader des photos pour un EDL
 */
export async function POST(
  request: Request,
  { params }: { params: { iid: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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
    const { data: edl } = await supabase
      .from("edl")
      .select(`
        id,
        property:properties!inner(owner_id),
        lease:leases(roommates(user_id))
      `)
      // @ts-ignore - Supabase typing issue
      .eq("id", params.iid as any)
      .single();

    if (!edl) {
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const edlData = edl as any;
    const hasAccess = edlData?.property?.owner_id === profileData?.id ||
      edlData?.lease?.roommates?.some((r: any) => r.user_id === user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Uploader les fichiers
    const uploadedFiles = [];
    for (const file of files) {
      const fileName = `edl/${params.iid}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Créer l'entrée dans edl_media
      const { data: media, error: mediaError } = await supabase
        .from("edl_media")
        .insert({
          edl_id: params.iid,
          storage_path: uploadData.path,
          media_type: "photo",
          section: section || null,
          taken_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (mediaError) throw mediaError;
      uploadedFiles.push(media);
    }

    return NextResponse.json({ files: uploadedFiles });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

