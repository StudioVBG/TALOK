export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les relevés de compteurs EDL
 * @version 2026-01-09 - SOTA: Helper centralisé pour permissions
 * 
 * GET  /api/edl/[id]/meter-readings - Liste les relevés d'un EDL
 * POST /api/edl/[id]/meter-readings - Créer un relevé avec OCR automatique
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";
// 🔧 FIX: OCR service uses sharp + tesseract.js (native modules) that can crash
// on serverless platforms (Netlify/Vercel). Use dynamic import() only when needed.
// import { meterOCRService } from "@/lib/ocr/meter.service";
import { createEDLMeterReadingSchema, validateMeterPhotoFile } from "@/lib/validations/edl-meters";
import type { MeterType, EDLMeterReading, MeterInfo } from "@/lib/types/edl-meters";
import {
  verifyEDLAccess,
  createServiceClient,
  getUserProfile,
  canEditEDL
} from "@/lib/helpers/edl-auth";

// ============================================
// GET - Liste les relevés de compteurs d'un EDL
// ============================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let edlId: string = "unknown";

  try {
    // 🔧 FIX: await params INSIDE try-catch to prevent unhandled errors returning HTML
    const resolvedParams = await params;
    edlId = resolvedParams.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!edlId || !uuidRegex.test(edlId)) {
      return NextResponse.json(
        { error: "ID d'EDL invalide", code: "INVALID_EDL_ID" },
        { status: 400 }
      );
    }

    console.log(`[GET /api/edl/${edlId}/meter-readings] Entering`);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[GET /api/edl/${edlId}/meter-readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edlData = accessResult.edl;
    const leaseData = Array.isArray(edlData.lease) ? edlData.lease[0] : edlData.lease;

    // Récupérer les relevés existants
    const { data: readings, error: readingsError } = await serviceClient
      .from("edl_meter_readings")
      .select(`
        *,
        meter:meters(*)
      `)
      .eq("edl_id", edlId)
      .order("created_at", { ascending: true });

    if (readingsError) {
      console.error(`[GET /api/edl/${edlId}/meter-readings] Readings Error:`, readingsError);
    }

    // Récupérer tous les compteurs actifs du logement
    let propertyId = edlData.property_id || leaseData?.property_id || leaseData?.property?.id;

    if (!propertyId && edlData.lease_id) {
       const { data: fallbackLease } = await serviceClient
         .from("leases")
         .select("property_id")
         .eq("id", edlData.lease_id)
         .single();
       if (fallbackLease) propertyId = fallbackLease.property_id;
    }

    let allMeters = [];
    if (propertyId) {
      const { data: meters, error: metersError } = await serviceClient
        .from("meters")
        .select("*")
        .eq("property_id", propertyId);
      
      if (metersError) {
        console.error(`[GET /api/edl/${edlId}/meter-readings] Meters Error:`, metersError);
      } else {
        allMeters = meters?.filter(m => m.is_active !== false) || [];
      }
    }

    const recordedMeterIds = new Set((readings || []).map((r: any) => r.meter_id));
    const missingMeters = allMeters.filter((m: any) => !recordedMeterIds.has(m.id));

    return NextResponse.json({
      readings: readings || [],
      all_meters_recorded: missingMeters.length === 0,
      missing_meters: missingMeters,
      edl: {
        id: edlData.id,
        type: edlData.type,
        status: edlData.status,
      },
    });

  } catch (error: unknown) {
    console.error(`[GET /api/edl/${edlId}/meter-readings] Fatal Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Créer un relevé avec OCR automatique
// ============================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let edlId: string = "unknown";

  try {
    // 🔧 FIX: await params INSIDE try-catch to prevent unhandled errors returning HTML
    const resolvedParams = await params;
    edlId = resolvedParams.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!edlId || !uuidRegex.test(edlId)) {
      return NextResponse.json(
        { error: "ID d'EDL invalide", code: "INVALID_EDL_ID" },
        { status: 400 }
      );
    }

    console.log(`[POST /api/edl/${edlId}/meter-readings] Entering`);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[POST /api/edl/${edlId}/meter-readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const limiter = getRateLimiterByUser(rateLimitPresets.upload);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 429: Rate limited`);
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

    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    // Vérifier si l'EDL peut être modifié
    const editCheck = canEditEDL(accessResult.edl);
    if (!editCheck.canEdit) {
      return NextResponse.json({ error: editCheck.reason }, { status: 400 });
    }

    const edlDataPost = accessResult.edl;
    const leaseData = Array.isArray(edlDataPost.lease) ? edlDataPost.lease[0] : edlDataPost.lease;

    let meterId, photo, photoPath, manualValue, readingUnit, comment, meterNumber, location, meterTypeFromBody;
    let ocrResult = { value: null, confidence: 0, rawText: "", needsValidation: true, processingTimeMs: 0 };

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      meterId = formData.get("meter_id") as string;
      photo = formData.get("photo") as File;
      photoPath = formData.get("photo_path") as string;
      manualValue = formData.get("manual_value") as string;
      readingUnit = formData.get("reading_unit") as string;
      comment = formData.get("comment") as string;
      meterNumber = formData.get("meter_number") as string;
      location = formData.get("location") as string;
      meterTypeFromBody = formData.get("meter_type") as string;
    } else {
      const body = await request.json().catch(() => ({}));
      meterId = body.meter_id;
      photoPath = body.photo_path;
      manualValue = body.reading_value;
      readingUnit = body.reading_unit;
      comment = body.comment;
      meterNumber = body.meter_number;
      location = body.location;
      meterTypeFromBody = body.meter_type;
    }

    const edlPropertyId = edlDataPost.property_id || leaseData?.property_id;
    if (!edlPropertyId) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 400: Aucun logement associé`);
      return NextResponse.json(
        { error: "Aucun logement associé à cet EDL" },
        { status: 400 }
      );
    }

    // 🔧 DEBUG: Tracer les données reçues pour diagnostic
    console.log(`[POST /api/edl/${edlId}/meter-readings] Received data:`, {
      meterId,
      meterNumber,
      manualValue,
      manualValueType: typeof manualValue,
      edlPropertyId,
      hasPhoto: !!photo,
      hasPhotoPath: !!photoPath
    });

    let finalMeterId = meterId;
    let actualMeterData = null;

    if (!meterId || String(meterId).startsWith("temp_")) {
      // 🔧 FIX: Priorité au type envoyé dans le body, puis header, puis défaut
      const meterType = (meterTypeFromBody || request.headers.get("x-meter-type") || "electricity") as MeterType;
      console.log(`[POST /api/edl/${edlId}/meter-readings] Looking for/Creating meter type: ${meterType}`);
      
      let existingMeter = null;
      if (meterNumber) {
        const { data: meters } = await serviceClient
          .from("meters")
          .select("*")
          .eq("property_id", edlPropertyId)
          .eq("meter_number", meterNumber);
        
        existingMeter = meters?.find(m => m.is_active !== false) || meters?.[0] || null;
      }
      
      if (!existingMeter && !meterNumber) {
        const { data: meters } = await serviceClient
          .from("meters")
          .select("*")
          .eq("property_id", edlPropertyId)
          .eq("type", meterType);
        
        const activeMeters = meters?.filter(m => m.is_active !== false) || [];
        
        if (activeMeters.length === 1) {
          existingMeter = activeMeters[0];
        }
      }

      if (existingMeter) {
        console.log(`[POST /api/edl/${edlId}/meter-readings] Existing meter found: ${existingMeter.id}`);
        finalMeterId = existingMeter.id;
        actualMeterData = existingMeter;
      } else {
        const meterPayload: any = {
          property_id: edlPropertyId,
          type: meterType,
          meter_number: meterNumber || `SN-${Date.now()}`,
          unit: readingUnit || (meterType === "electricity" ? "kWh" : "m³"),
        };

        console.log(`[POST /api/edl/${edlId}/meter-readings] Creating new meter:`, meterPayload);

        try {
          const { data: newMeter, error: createError } = await serviceClient
            .from("meters")
            .insert({
              ...meterPayload,
              serial_number: meterNumber || `SN-${Date.now()}`,
              location: location || null,
              is_active: true
            })
            .select()
            .single();
          
          if (createError) {
            console.error(`[POST /api/edl/${edlId}/meter-readings] Meter Creation Error:`, createError);
            if ((createError as any).code === '42703') {
              const { data: fallbackMeter, error: fallbackError } = await serviceClient
                .from("meters")
                .insert(meterPayload)
                .select()
                .single();
              if (fallbackError) throw fallbackError;
              finalMeterId = fallbackMeter.id;
              actualMeterData = fallbackMeter;
            } else {
              throw createError;
            }
          } else {
            finalMeterId = newMeter.id;
            actualMeterData = newMeter;
          }
        } catch (err) {
          console.error(`[POST /api/edl/${edlId}/meter-readings] Meter Creation Exception:`, err);
          throw err;
        }
      }
    } else {
      // 🔧 FIX: Chercher d'abord par id seul, puis vérifier le property_id
      // Le double filtre (id + property_id) échouait quand le meter avait property_id = NULL
      const { data: meter, error: meterError } = await serviceClient
        .from("meters")
        .select("*")
        .eq("id", meterId)
        .single();

      if (meterError || !meter) {
        console.warn(`[POST /api/edl/${edlId}/meter-readings] Meter not found: ${meterId}`, meterError);
        return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
      }

      // Si le compteur n'a pas de property_id, l'associer au property de l'EDL
      if (!meter.property_id && edlPropertyId) {
        await serviceClient.from("meters").update({ property_id: edlPropertyId }).eq("id", meterId);
        (meter as any).property_id = edlPropertyId;
      }
      
      const meterData = meter as any;
      if (meterData.is_active === false) {
        return NextResponse.json({ error: "Compteur inactif" }, { status: 400 });
      }
      
      if (meterNumber || location) {
        const updateData: any = {};
        if (meterNumber) {
          updateData.meter_number = meterNumber;
          updateData.serial_number = meterNumber; 
        }
        if (location) updateData.location = location;
        
        await serviceClient.from("meters").update(updateData).eq("id", meterId);
      }
      
      actualMeterData = meter;
    }

    // Check if a reading already exists for this EDL and meter - if so, update it
    const { data: existingReading } = await serviceClient
      .from("edl_meter_readings")
      .select("id, photo_path")
      .eq("edl_id", edlId)
      .eq("meter_id", finalMeterId)
      .maybeSingle();

    // Flag to track if we're updating an existing reading
    const isUpdate = !!existingReading;

    const recorderRole = profile.role === "owner" ? "owner" : "tenant";
    let finalPhotoPath = photoPath;
    
    if (photo && !finalPhotoPath) {
      console.log(`[POST /api/edl/${edlId}/meter-readings] Uploading photo...`);
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      const timestamp = Date.now();
      const fileName = `edl/${edlId}/meters/${actualMeterData.type}_${finalMeterId}_${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await serviceClient.storage
        .from("documents")
        .upload(fileName, photoBuffer, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(`[POST /api/edl/${edlId}/meter-readings] Upload Error:`, uploadError);
        throw new Error("Erreur lors de l'upload de la photo");
      }
      finalPhotoPath = uploadData.path;

      try {
        // 🔧 FIX: Dynamic import to avoid module-level crash from native deps (sharp, tesseract.js)
        const { meterOCRService } = await import("@/lib/ocr/meter.service");
        const ocrResponse = await meterOCRService.analyzeMeterPhoto(
          photoBuffer,
          actualMeterData.type as MeterType
        );
        ocrResult = {
          value: ocrResponse.value,
          confidence: ocrResponse.confidence,
          rawText: ocrResponse.rawText,
          needsValidation: ocrResponse.needsValidation,
          processingTimeMs: ocrResponse.processingTimeMs,
        };
      } catch (ocrError) {
        console.warn("[POST /api/edl/[id]/meter-readings] OCR failed:", ocrError);
      }
    }

    let finalValue: number | null = null;
    let isValidated = false;
    let needsManualValidation = false;

    // 🔧 FIX: Gérer correctement les valeurs numériques y compris 0
    // manualValue peut être un nombre (du JSON) ou une string (du FormData)
    const parsedManualValue = typeof manualValue === 'number'
      ? manualValue
      : (manualValue !== null && manualValue !== undefined && manualValue !== '')
        ? parseFloat(String(manualValue))
        : NaN;

    if (!isNaN(parsedManualValue)) {
      // Valeur saisie manuellement - considérée comme validée
      finalValue = parsedManualValue;
      isValidated = true;
      console.log(`[POST /api/edl/${edlId}/meter-readings] Manual value: ${finalValue}`);
    } else if (ocrResult.value !== null) {
      // Valeur OCR - validée si confiance >= 80%
      finalValue = ocrResult.value;
      isValidated = ocrResult.confidence >= 80;
      needsManualValidation = !isValidated;
      console.log(`[POST /api/edl/${edlId}/meter-readings] OCR value: ${finalValue}, confidence: ${ocrResult.confidence}%, validated: ${isValidated}`);
    } else if (finalPhotoPath) {
      // 🔧 FIX: Photo présente mais OCR a échoué - marquer comme nécessitant validation
      needsManualValidation = true;
      console.log(`[POST /api/edl/${edlId}/meter-readings] Photo uploaded but OCR failed - needs manual validation`);
    }

    if (finalValue === null && !finalPhotoPath) {
      // Pas de valeur et pas de photo - on ne peut pas créer de relevé
      console.log(`[POST /api/edl/${edlId}/meter-readings] No value or photo, just updating meter.`);
      return NextResponse.json({
        success: true,
        message: "Compteur mis à jour (sans relevé)",
        meter: actualMeterData
      });
    }

    // 🔧 FIX: Ne pas inclure photo_path si undefined (contrainte NOT NULL en DB)
    const readingPayload: any = {
      edl_id: edlId,
      meter_id: finalMeterId,
      reading_value: finalValue,
      reading_unit: readingUnit || actualMeterData.unit || "kWh",
      recorded_by: user.id,
      recorded_by_role: recorderRole,
    };
    
    // Ajouter photo_path seulement si elle existe
    if (finalPhotoPath) {
      readingPayload.photo_path = finalPhotoPath;
      readingPayload.photo_taken_at = new Date().toISOString();
    }

    let finalReading;

    if (isUpdate) {
      // Update existing reading
      console.log(`[POST /api/edl/${edlId}/meter-readings] Updating existing reading:`, existingReading.id);

      const updatePayload: any = {
        reading_value: finalValue,
        reading_unit: readingUnit || actualMeterData.unit || "kWh",
        is_validated: isValidated,
        validated_by: isValidated ? user.id : null,
        validated_at: isValidated ? new Date().toISOString() : null,
        validation_comment: comment,
      };

      // Update photo only if a new one is provided
      if (finalPhotoPath && finalPhotoPath !== existingReading.photo_path) {
        updatePayload.photo_path = finalPhotoPath;
        updatePayload.photo_taken_at = new Date().toISOString();
      }

      // Update OCR data if available
      if (ocrResult.value !== null) {
        updatePayload.ocr_value = ocrResult.value;
        updatePayload.ocr_confidence = ocrResult.confidence;
        updatePayload.ocr_provider = "tesseract";
        updatePayload.ocr_raw_text = ocrResult.rawText;
      }

      try {
        const { data: updatedReading, error: updateError } = await serviceClient
          .from("edl_meter_readings")
          .update(updatePayload)
          .eq("id", existingReading.id)
          .select(`*, meter:meters(*)`)
          .single();

        if (updateError) {
          console.error(`[POST /api/edl/${edlId}/meter-readings] Update Error:`, updateError);
          throw updateError;
        }
        finalReading = updatedReading;
      } catch (err) {
        console.error(`[POST /api/edl/${edlId}/meter-readings] Update Exception:`, err);
        throw err;
      }
    } else {
      // Insert new reading
      console.log(`[POST /api/edl/${edlId}/meter-readings] Inserting reading:`, readingPayload);

      try {
        const { data: reading, error: insertError } = await serviceClient
          .from("edl_meter_readings")
          .insert({
            ...readingPayload,
            ocr_value: ocrResult.value,
            ocr_confidence: ocrResult.confidence,
            ocr_provider: "tesseract",
            ocr_raw_text: ocrResult.rawText,
            is_validated: isValidated,
            validated_by: isValidated ? user.id : null,
            validated_at: isValidated ? new Date().toISOString() : null,
            validation_comment: comment,
          })
          .select(`*, meter:meters(*)`)
          .single();

        if (insertError) {
          console.error(`[POST /api/edl/${edlId}/meter-readings] Insert Error:`, insertError);
          if ((insertError as any).code === '42703') {
            const { data: minimalReading, error: minimalError } = await serviceClient
              .from("edl_meter_readings")
              .insert(readingPayload)
              .select(`*, meter:meters(*)`)
              .single();
            if (minimalError) throw minimalError;
            finalReading = minimalReading;
          } else {
            throw insertError;
          }
        } else {
          finalReading = reading;
        }
      } catch (err) {
        console.error(`[POST /api/edl/${edlId}/meter-readings] Insertion Exception:`, err);
        throw err;
      }
    }

    if (!finalReading) throw new Error("Erreur lors de l'enregistrement du relevé");

    return NextResponse.json({
      reading: finalReading,
      all_meters_recorded: false, // Simplifié pour le débug
      needs_validation: needsManualValidation, // 🔧 FIX: Informer le client si la valeur doit être validée manuellement
    });

  } catch (error: unknown) {
    console.error(`[POST /api/edl/${edlId}/meter-readings] Fatal Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
