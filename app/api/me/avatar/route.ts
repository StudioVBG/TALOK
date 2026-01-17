export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté (JPEG, PNG ou WEBP)" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 2 MB)" },
        { status: 400 }
      );
    }

    // Récupérer l'ancien avatar pour le supprimer si nécessaire
    const supabaseClient = supabase as any;
    const { data: existingProfile } = await supabaseClient
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id as any)
      .single();

    const fileExt = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Erreur lors de l'upload" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const { data: profile, error: updateError } = await supabaseClient
      .from("profiles")
      .update({ avatar_url: path })
      .eq("user_id", user.id as any)
      .select()
      .single();

    if (updateError || !profile) {
      console.error("Avatar profile update error:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Erreur lors de la mise à jour du profil" },
        { status: 500 }
      );
    }

    // Supprimer l'ancien avatar si différent
    const previousPath = existingProfile?.avatar_url;
    if (previousPath && previousPath !== path) {
      await supabase.storage.from("avatars").remove([previousPath]);
    }

    return NextResponse.json({
      profile,
      avatarUrl: publicUrl,
      storagePath: path,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/me/avatar:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





