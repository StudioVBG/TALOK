// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/meters/[id]/photo-ocr - Analyser une photo de compteur avec OCR
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

    // Rate limiting pour les OCR
    const limiter = getRateLimiterByUser(rateLimitPresets.upload);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.upload.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    const formData = await request.formData();
    const photoFile = formData.get("photo") as File | null;

    if (!photoFile) {
      return NextResponse.json(
        { error: "photo requis" },
        { status: 400 }
      );
    }

    // Uploader la photo
    const fileName = `meters/${params.id}/${Date.now()}_${photoFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, photoFile, {
        contentType: photoFile.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // TODO: Appeler l'Edge Function pour OCR
    // const { data: ocrResult } = await supabase.functions.invoke('analyze-meter-photo', {
    //   body: { meter_id: params.id, photo_path: uploadData.path }
    // });

    // Pour l'instant, on simule
    const mockReading = {
      meter_id: params.id,
      reading_value: 1234.56,
      unit: "kwh",
      reading_date: new Date().toISOString().split("T")[0],
      photo_url: uploadData.path,
      source: "ocr" as const,
      confidence: 85.5,
      ocr_provider: "google_vision",
      created_by: user.id,
    };

    // Créer le relevé
    const { data: reading, error } = await supabase
      .from("meter_readings")
      .insert(mockReading as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ reading });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

