export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/meters/[id]/photo-ocr - Analyser une photo de compteur avec OCR
 * 
 * NOTA: L'OCR est optionnel. Si Tesseract échoue, on retourne quand même
 * la photo uploadée pour que l'utilisateur puisse saisir manuellement.
 * 
 * @version 2026-02-01 - Fix: Gestion gracieuse des erreurs OCR + Next.js 15 params
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params is now a Promise
  const { id: meterId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    // Rate limiting pour les OCR
    try {
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
    } catch (rateLimitError) {
      console.warn("Rate limiter error (ignored):", rateLimitError);
    }

    const formData = await request.formData();
    const photoFile = formData.get("photo") as File | null;

    if (!photoFile) {
      return NextResponse.json(
        { error: "Photo requise" },
        { status: 400 }
      );
    }

    // Variables pour les résultats
    let ocrValue: number | null = null;
    let ocrConfidence: number = 0;
    let photoUrl: string | null = null;

    // 1. Tenter l'OCR (optionnel - ne bloque pas si ça échoue)
    try {
      const { ocrService } = await import("@/lib/services/ocr.service");
      
      const arrayBuffer = await photoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const result = await ocrService.analyzeMeterPhoto(buffer);
      ocrValue = result.value;
      ocrConfidence = result.confidence;
      
      console.log(`[OCR] Valeur détectée: ${ocrValue} (confiance: ${ocrConfidence}%)`);
    } catch (ocrError: unknown) {
      console.warn("[OCR] Échec de l'analyse OCR:", ocrError instanceof Error ? ocrError.message : ocrError);
    }

    // 2. Uploader la photo (même si l'OCR a échoué)
    try {
      const folderId = meterId === "new" ? (propertyId || "temp") : meterId;
      const safeFileName = photoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `meters/${folderId}/ocr_${Date.now()}_${safeFileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (!uploadError && uploadData) {
        photoUrl = uploadData.path;
      } else {
        console.error("[OCR] Erreur upload photo:", uploadError);
      }
    } catch (uploadError: unknown) {
      console.error("[OCR] Exception upload:", uploadError instanceof Error ? uploadError.message : uploadError);
    }

    // 3. Retourner le résultat (même si OCR/upload ont échoué)
    return NextResponse.json({ 
      reading: {
        reading_value: ocrValue,
        confidence: ocrConfidence,
        photo_url: photoUrl,
        unit: "kwh",
        ocr_success: ocrValue !== null,
      },
      message: ocrValue !== null 
        ? `Valeur détectée: ${ocrValue} (confiance: ${Math.round(ocrConfidence)}%)`
        : "Impossible de détecter la valeur automatiquement. Veuillez saisir manuellement."
    });
    
  } catch (error: unknown) {
    console.error("[OCR API] Erreur générale:", error);
    
    return NextResponse.json({ 
      reading: {
        reading_value: null,
        confidence: 0,
        photo_url: null,
        unit: "kwh",
        ocr_success: false,
      },
      message: "Erreur lors de l'analyse. Veuillez saisir la valeur manuellement.",
      error: error instanceof Error ? error.message : "Erreur serveur"
    }, { status: 200 });
  }
}
