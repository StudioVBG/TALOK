export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/meters/[id]/readings - Ajouter un relevé de compteur
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise + column names
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params is now a Promise
  const { id: meterId } = await params;
  console.log(`[POST /api/meters/${meterId}/readings] Entering`);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[POST /api/meters/${meterId}/readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const readingValueStr = formData.get("reading_value") as string;
    const readingDate = formData.get("reading_date") as string;
    const photoFile = formData.get("photo") as File | null;

    // Parse reading value, handling 0 as valid
    const readingValue = readingValueStr !== null && readingValueStr !== ''
      ? parseFloat(readingValueStr)
      : NaN;

    if (isNaN(readingValue) || !readingDate) {
      console.log(`[POST /api/meters/${meterId}/readings] 400: Données manquantes`, {
        readingValue,
        readingDate
      });
      return NextResponse.json(
        { error: "reading_value et reading_date requis" },
        { status: 400 }
      );
    }

    // Verify meter exists
    const { data: meter, error: meterError } = await supabase
      .from("meters")
      .select("id, property_id")
      .eq("id", meterId)
      .single();

    if (meterError || !meter) {
      console.log(`[POST /api/meters/${meterId}/readings] 404: Compteur non trouvé`);
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    let photoUrl: string | null = null;

    // Si une photo est fournie, l'uploader
    if (photoFile) {
      const fileName = `meters/${meterId}/${Date.now()}_${photoFile.name}`;
      const { data: uploadData, error: uploadError } =
        await supabase.storage.from("documents").upload(fileName, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`[POST /api/meters/${meterId}/readings] Upload Error:`, uploadError);
        throw uploadError;
      }
      photoUrl = uploadData.path;
    }

    // Créer le relevé - using correct column names from meter_readings table schema
    const { data: reading, error } = await supabase
      .from("meter_readings")
      .insert({
        meter_id: meterId,
        reading_value: readingValue,
        unit: 'kWh', // Default unit from schema
        reading_date: readingDate,
        photo_url: photoUrl,
        source: photoFile ? "ocr" : "manual",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(`[POST /api/meters/${meterId}/readings] Insert Error:`, error);
      throw error;
    }

    console.log(`[POST /api/meters/${meterId}/readings] Success:`, reading?.id);
    return NextResponse.json({ reading });
  } catch (error: unknown) {
    console.error(`[POST /api/meters/${meterId}/readings] Fatal Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

