export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les relevés de compteurs EDL
 * 
 * GET  /api/edl/[id]/meter-readings - Liste les relevés d'un EDL
 * POST /api/edl/[id]/meter-readings - Créer un relevé avec OCR automatique
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
import { meterOCRService } from "@/lib/ocr/meter.service";
import { createEDLMeterReadingSchema, validateMeterPhotoFile } from "@/lib/validations/edl-meters";
import type { MeterType, EDLMeterReading, MeterInfo } from "@/lib/types/edl-meters";

// ============================================
// GET - Liste les relevés de compteurs d'un EDL
// ============================================

export async function GET(
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

    const edlId = params.id;

    // Vérifier que l'utilisateur a accès à cet EDL
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        id,
        type,
        status,
        lease_id,
        property_id,
        lease:leases(
          id,
          property_id,
          property:properties(
            id,
            owner_id
          )
        )
      `)
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer les relevés existants
    const { data: readings, error: readingsError } = await supabase
      .from("edl_meter_readings")
      .select(`
        *,
        meter:meters!inner(
          id,
          type,
          meter_number,
          location,
          provider,
          unit,
          is_active
        )
      `)
      .eq("edl_id", edlId)
      .order("created_at", { ascending: true });

    if (readingsError) throw readingsError;

    // Récupérer tous les compteurs actifs du logement
    // L'EDL peut avoir property_id directement ou via le bail
    const propertyId = (edl as any).property_id || (edl as any).lease?.property_id;
    const { data: allMeters, error: metersError } = await supabase
      .from("meters")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_active", true);

    if (metersError) throw metersError;

    // Déterminer les compteurs manquants
    const recordedMeterIds = new Set((readings || []).map((r: any) => r.meter_id));
    const missingMeters = (allMeters || []).filter((m: any) => !recordedMeterIds.has(m.id));

    return NextResponse.json({
      readings: readings || [],
      all_meters_recorded: missingMeters.length === 0,
      missing_meters: missingMeters,
      edl: {
        id: edl.id,
        type: (edl as any).type,
        status: (edl as any).status,
      },
    });

  } catch (error: any) {
    console.error("[EDL Meter Readings] GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Créer un relevé avec OCR automatique
// ============================================

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

    // Rate limiting pour les uploads OCR (coûteux en ressources)
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

    const edlId = params.id;

    // Parser le corps (FormData ou JSON)
    let meterId: string;
    let photo: File | null = null;
    let manualValue: string | null = null;
    let comment: string | null = null;
    let photoPath: string | null = null;
    let readingUnit: string | null = null;
    
    // Initialiser ocrResult pour éviter les erreurs de variable non définie
    let ocrResult: any = { 
      value: null, 
      confidence: 0, 
      rawText: null, 
      needsValidation: true, 
      processingTimeMs: 0 
    };

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      meterId = body.meter_id;
      manualValue = body.reading_value?.toString();
      comment = body.validation_comment;
      photoPath = body.photo_path;
      readingUnit = body.reading_unit;
    } else {
      const formData = await request.formData();
      meterId = formData.get("meter_id") as string;
      photo = formData.get("photo") as File | null;
      manualValue = formData.get("manual_value") as string | null;
      comment = formData.get("comment") as string | null;
    }

    // Validation de base
    if (!meterId) {
      return NextResponse.json(
        { error: "meter_id est requis" },
        { status: 400 }
      );
    }

    // Photo optionnelle si une valeur manuelle est fournie
    if (!photo && !photoPath && !manualValue) {
      return NextResponse.json(
        { error: "Fournissez soit une photo du compteur, soit une valeur manuelle" },
        { status: 400 }
      );
    }

    // Valider la photo (seulement si fournie)
    if (photo) {
      const photoValidation = validateMeterPhotoFile(photo);
      if (!photoValidation.valid) {
        return NextResponse.json(
          { error: photoValidation.message },
          { status: 400 }
        );
      }
    }

    // Vérifier que l'EDL existe et est modifiable
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        id,
        type,
        status,
        lease_id,
        property_id,
        lease:leases(
          id,
          property_id
        )
      `)
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const edlData = edl as any;
    if (!["draft", "in_progress", "completed", "scheduled"].includes(edlData.status)) {
      return NextResponse.json(
        { error: "L'EDL est déjà signé et ne peut plus être modifié" },
        { status: 400 }
      );
    }

    // Récupérer le property_id (direct ou via bail)
    const edlPropertyId = edlData.property_id || edlData.lease?.property_id;
    if (!edlPropertyId) {
      return NextResponse.json(
        { error: "Aucun logement associé à cet EDL" },
        { status: 400 }
      );
    }

    // Vérifier que le compteur existe et appartient au logement
    const { data: meter, error: meterError } = await supabase
      .from("meters")
      .select("*")
      .eq("id", meterId)
      .eq("property_id", edlPropertyId)
      .eq("is_active", true)
      .single();

    if (meterError || !meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé ou inactif" },
        { status: 404 }
      );
    }

    const meterData = meter as any;

    // Vérifier qu'il n'y a pas déjà un relevé pour ce compteur sur cet EDL
    const { data: existingReading } = await supabase
      .from("edl_meter_readings")
      .select("id")
      .eq("edl_id", edlId)
      .eq("meter_id", meterId)
      .maybeSingle();

    if (existingReading) {
      return NextResponse.json(
        { error: "Un relevé existe déjà pour ce compteur. Utilisez PUT pour le modifier." },
        { status: 409 }
      );
    }

    // Récupérer le rôle de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const userRole = (profile as any)?.role;
    const recorderRole = userRole === "owner" ? "owner" : "tenant";

    // 1. Upload de la photo (si non fournie via photoPath)
    let finalPhotoPath = photoPath;
    
    if (photo && !finalPhotoPath) {
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      const timestamp = Date.now();
      const fileName = `edl/${edlId}/meters/${meterData.type}_${meterId}_${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, photoBuffer, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("[EDL Meter] Upload error:", uploadError);
        throw new Error("Erreur lors de l'upload de la photo");
      }
      finalPhotoPath = uploadData.path;

      // 2. OCR automatique sur la photo (seulement si nouvelle photo)
      try {
        const ocrResponse = await meterOCRService.analyzeMeterPhoto(
          photoBuffer,
          meterData.type as MeterType
        );
        ocrResult = {
          value: ocrResponse.value,
          confidence: ocrResponse.confidence,
          rawText: ocrResponse.rawText,
          needsValidation: ocrResponse.needsValidation,
          processingTimeMs: ocrResponse.processingTimeMs,
        };
        console.log(`[EDL Meter] OCR result: ${ocrResult.value} (${ocrResult.confidence}% confidence)`);
      } catch (ocrError) {
        console.warn("[EDL Meter] OCR failed, using manual value:", ocrError);
      }
    }

    // 3. Déterminer la valeur finale
    // Priorité: valeur manuelle > valeur OCR (si confiance élevée)
    let finalValue: number;
    let isValidated = false;

    if (manualValue && !isNaN(parseFloat(manualValue))) {
      // L'utilisateur a fourni une valeur manuelle → elle prime
      finalValue = parseFloat(manualValue);
      isValidated = true;
    } else if (ocrResult.value !== null && ocrResult.confidence >= 80) {
      // OCR confiant → utiliser la valeur OCR
      finalValue = ocrResult.value;
      isValidated = false; // Mais validation recommandée
    } else if (ocrResult.value !== null) {
      // OCR pas confiant mais valeur détectée → utiliser mais non validé
      finalValue = ocrResult.value;
      isValidated = false;
    } else if (!photo && !photoPath && manualValue) {
      // Pas de photo mais valeur manuelle fournie (déjà vérifié ci-dessus mais sécurité)
      finalValue = parseFloat(manualValue);
      isValidated = true;
    } else {
      // Pas de valeur manuelle et OCR a échoué (ou pas de photo)
      return NextResponse.json(
        {
          error: "Impossible de lire la valeur du compteur. Veuillez saisir la valeur manuellement.",
          ocr: {
            detected_value: null,
            confidence: ocrResult.confidence,
            needs_validation: true,
            raw_text: ocrResult.rawText,
            processing_time_ms: ocrResult.processingTimeMs,
          },
          photo_path: finalPhotoPath,
        },
        { status: 422 }
      );
    }

    // 4. Créer le relevé en base
    const { data: reading, error: insertError } = await supabase
      .from("edl_meter_readings")
      .insert({
        edl_id: edlId,
        meter_id: meterId,
        reading_value: finalValue,
        reading_unit: readingUnit || meterData.unit || "kWh",
        photo_path: finalPhotoPath,
        photo_taken_at: new Date().toISOString(),
        ocr_value: ocrResult.value,
        ocr_confidence: ocrResult.confidence,
        ocr_provider: "tesseract",
        ocr_raw_text: ocrResult.rawText,
        is_validated: isValidated,
        validated_by: isValidated ? user.id : null,
        validated_at: isValidated ? new Date().toISOString() : null,
        validation_comment: comment,
        recorded_by: user.id,
        recorded_by_role: recorderRole,
      })
      .select(`
        *,
        meter:meters!inner(
          id,
          type,
          meter_number,
          location,
          provider,
          unit,
          is_active
        )
      `)
      .single();

    if (insertError) {
      console.error("[EDL Meter] Insert error:", insertError);
      throw insertError;
    }

    // 5. Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_meter_reading_created",
      entity_type: "edl_meter_reading",
      entity_id: (reading as any).id,
      metadata: {
        edl_id: edlId,
        meter_id: meterId,
        meter_type: meterData.type,
        reading_value: finalValue,
        ocr_used: ocrResult.value !== null,
        ocr_confidence: ocrResult.confidence,
        recorder_role: recorderRole,
      },
    });

    // 6. Émettre un événement si tous les compteurs sont relevés
    const { data: allMeters } = await supabase
      .from("meters")
      .select("id")
      .eq("property_id", edlPropertyId)
      .eq("is_active", true);

    const { data: allReadings } = await supabase
      .from("edl_meter_readings")
      .select("meter_id")
      .eq("edl_id", edlId);

    const allMetersRecorded = (allMeters?.length || 0) <= (allReadings?.length || 0);

    if (allMetersRecorded) {
      await supabase.from("outbox").insert({
        event_type: "EDL.AllMetersRecorded",
        payload: {
          edl_id: edlId,
          meters_count: allReadings?.length || 0,
        },
      });
    }

    return NextResponse.json({
      reading,
      ocr: {
        detected_value: ocrResult.value,
        confidence: ocrResult.confidence,
        needs_validation: ocrResult.needsValidation,
        raw_text: ocrResult.rawText,
        processing_time_ms: ocrResult.processingTimeMs,
      },
      all_meters_recorded: allMetersRecorded,
    });

  } catch (error: any) {
    console.error("[EDL Meter Readings] POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

