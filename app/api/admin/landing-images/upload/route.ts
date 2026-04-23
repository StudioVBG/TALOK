export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.landing-images.upload");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  const { error: authError, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;

    if (!file || !key) {
      return NextResponse.json(
        { error: "Fichier et clé requis" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Seules les images sont acceptées" },
        { status: 400 }
      );
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Taille maximale : 5 Mo" },
        { status: 400 }
      );
    }

    const fileExt = file.name.split(".").pop();
    const filePath = `${key}/${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.LANDING_IMAGES)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Landing Images] Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.LANDING_IMAGES)
      .getPublicUrl(filePath);

    // Update site_config with the new URL
    const { error: updateError } = await supabase
      .from("site_config")
      .update({ value: urlData.publicUrl })
      .eq("key", key);

    if (updateError) {
      console.error("[Landing Images] Config update error:", updateError);
      return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
    }

    revalidatePath("/(marketing)");

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (error) {
    console.error("[Landing Images] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
