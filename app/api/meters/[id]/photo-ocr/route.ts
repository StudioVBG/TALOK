export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
// 🔧 FIX: Dynamic import to avoid module-level crash from native deps (sharp, tesseract.js)
// import { ocrService } from "@/lib/services/ocr.service";

/**
 * POST /api/meters/[id]/photo-ocr - Analyser une photo de compteur avec OCR
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
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

    // Convertir File en Buffer pour OCR
    const arrayBuffer = await photoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Effectuer l'OCR (dynamic import to avoid native module crash on serverless)
    const { ocrService } = await import("@/lib/services/ocr.service");
    const { value, confidence } = await ocrService.analyzeMeterPhoto(buffer);

    // Uploader la photo pour archive (même si c'est juste pour l'analyse)
    const folderId = meterId === "new" ? (propertyId || "temp") : meterId;
    const fileName = `meters/${folderId}/ocr_${Date.now()}_${photoFile.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, photoFile, {
        contentType: photoFile.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Si on a un ID de compteur réel, on pourrait déjà créer un relevé "ocr"
    // Mais pour le wizard, on renvoie juste la valeur pour pré-remplissage
    
    return NextResponse.json({ 
      reading: {
        reading_value: value,
        confidence: confidence,
        photo_url: uploadData.path,
        unit: "kwh" // Par défaut, l'UI ajustera
      }
    });
  } catch (error: unknown) {
    console.error("OCR API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur lors de l'analyse OCR" },
      { status: 500 }
    );
  }
}

