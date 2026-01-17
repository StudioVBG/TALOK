export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/meters/[id]/readings - Ajouter un relevé de compteur
 */
export async function POST(
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

    const formData = await request.formData();
    const readingValue = parseFloat(formData.get("reading_value") as string);
    const readingDate = formData.get("reading_date") as string;
    const photoFile = formData.get("photo") as File | null;

    if (!readingValue || !readingDate) {
      return NextResponse.json(
        { error: "reading_value et reading_date requis" },
        { status: 400 }
      );
    }

    let photoUrl: string | null = null;

    // Si une photo est fournie, l'uploader
    if (photoFile) {
      const fileName = `meters/${params.id}/${Date.now()}_${photoFile.name}`;
      const { data: uploadData, error: uploadError } =
        await supabase.storage.from("documents").upload(fileName, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;
      photoUrl = uploadData.path;
    }

    // Créer le relevé
    const { data: reading, error } = await supabase
      .from("meter_readings")
      .insert({
        meter_id: params.id,
        reading_value: readingValue,
        reading_date: readingDate,
        photo_url: photoUrl,
        source: photoFile ? "ocr" : "manual",
        created_by: user.id,
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ reading });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

