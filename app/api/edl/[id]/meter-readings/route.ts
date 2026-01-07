export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour les relevés de compteurs EDL
 * @version 2026-01-05 - Fix photo_path NOT NULL constraint
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
  const edlId = params.id;
  console.log(`[GET /api/edl/${edlId}/meter-readings] Entering`);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[GET /api/edl/${edlId}/meter-readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // 1. Récupérer l'EDL et les infos de propriété
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        *,
        lease:leases(
          *,
          property:properties(*)
        )
      `)
      .eq("id", edlId)
      .maybeSingle();

    if (edlError) {
      console.error(`[GET /api/edl/${edlId}/meter-readings] EDL Fetch Error:`, edlError);
      return NextResponse.json({ error: "Erreur lors de la récupération de l'EDL" }, { status: 500 });
    }

    if (!edl) {
      console.log(`[GET /api/edl/${edlId}/meter-readings] 404: EDL non trouvé`);
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    const edlData = edl as any;
    
    // 2. Vérifier les permissions (Locataire OU Propriétaire)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      console.log(`[GET /api/edl/${edlId}/meter-readings] 404: Profil non trouvé`);
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let isAuthorized = false;
    // Déterminer ownerId de manière sécurisée
    const leaseData = Array.isArray(edlData.lease) ? edlData.lease[0] : edlData.lease;
    const propertyData = leaseData?.property || edlData.property || (edlData as any).property_details;
    const ownerId = propertyData?.owner_id;
    const actualOwnerId = typeof ownerId === "object" ? ownerId?.id : ownerId;

    console.log(`[GET /api/edl/${edlId}/meter-readings] Auth debug:`, {
      role: profile.role,
      profileId: profile.id,
      actualOwnerId,
      createdBy: edlData.created_by
    });

    if (profile.role === "owner" || profile.role === "admin") {
      if (actualOwnerId === profile.id || edlData.created_by === profile.id) isAuthorized = true;
    } else {
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (roommate) isAuthorized = true;
    }

    if (!isAuthorized) {
      console.warn(`[GET /api/edl/${edlId}/meter-readings] 403: Accès non autorisé`);
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // 3. Récupérer les relevés existants
    const { data: readings, error: readingsError } = await supabase
      .from("edl_meter_readings")
      .select(`
        *,
        meter:meters(*)
      `)
      .eq("edl_id", edlId)
      .order("created_at", { ascending: true });

    if (readingsError) {
      console.error(`[GET /api/edl/${edlId}/meter-readings] Readings Fetch Error:`, readingsError);
    }

    // 4. Récupérer tous les compteurs actifs du logement
    let propertyId = edlData.property_id || leaseData?.property_id;

    if (!propertyId && edlData.lease_id) {
       const { data: fallbackLease } = await supabase
         .from("leases")
         .select("property_id")
         .eq("id", edlData.lease_id)
         .single();
       if (fallbackLease) propertyId = fallbackLease.property_id;
    }

    let allMeters = [];
    if (propertyId) {
      const { data: meters, error: metersError } = await supabase
        .from("meters")
        .select("*")
        .eq("property_id", propertyId);
      
      if (metersError) {
        console.error(`[GET /api/edl/${edlId}/meter-readings] Meters Fetch Error:`, metersError);
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
        id: edl.id,
        type: edlData.type,
        status: edlData.status,
      },
    });

  } catch (error: any) {
    console.error(`[GET /api/edl/${edlId}/meter-readings] Fatal Error:`, error);
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
  const edlId = params.id;
  console.log(`[POST /api/edl/${edlId}/meter-readings] Entering`);

  try {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      console.log(`[POST /api/edl/${edlId}/meter-readings] 404: Profil non trouvé`);
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

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

    if (edlError) {
      console.error(`[POST /api/edl/${edlId}/meter-readings] EDL Fetch Error:`, edlError);
      return NextResponse.json({ error: "EDL non trouvé ou erreur" }, { status: 404 });
    }

    if (!edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    let isAuthorized = false;
    const edlDataPost = edl as any;

    const leaseData = Array.isArray(edlDataPost.lease) ? edlDataPost.lease[0] : edlDataPost.lease;
    const ownerId = leaseData?.property?.owner_id || edlDataPost.property_id;
    const actualOwnerId = typeof ownerId === "object" ? ownerId.owner_id : ownerId;

    console.log(`[POST /api/edl/${edlId}/meter-readings] Auth check:`, {
      role: profile.role,
      actualOwnerId,
      profileId: profile.id
    });

    if (profile.role === "owner" || profile.role === "admin") {
      if (actualOwnerId === profile.id || edlDataPost.created_by === profile.id) isAuthorized = true;
    } else {
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", edlDataPost.lease_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (roommate) isAuthorized = true;
    }

    if (!isAuthorized) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 403: Accès non autorisé`);
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (!["draft", "in_progress", "completed", "scheduled"].includes(edlDataPost.status)) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 400: EDL déjà signé`);
      return NextResponse.json(
        { error: "L'EDL est déjà signé et ne peut plus être modifié" },
        { status: 400 }
      );
    }

    let meterId, photo, photoPath, manualValue, readingUnit, comment, meterNumber, location;
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
    } else {
      const body = await request.json().catch(() => ({}));
      meterId = body.meter_id;
      photoPath = body.photo_path;
      manualValue = body.reading_value;
      readingUnit = body.reading_unit;
      comment = body.comment;
      meterNumber = body.meter_number;
      location = body.location;
    }

    const edlPropertyId = edlDataPost.property_id || leaseData?.property_id;
    if (!edlPropertyId) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 400: Aucun logement associé`);
      return NextResponse.json(
        { error: "Aucun logement associé à cet EDL" },
        { status: 400 }
      );
    }

    console.log(`[POST /api/edl/${edlId}/meter-readings] Data:`, {
      meterId,
      meterNumber,
      manualValue,
      edlPropertyId
    });

    let finalMeterId = meterId;
    let actualMeterData = null;

    if (!meterId || String(meterId).startsWith("temp_")) {
      const meterType = (request.headers.get("x-meter-type") || "electricity") as MeterType;
      console.log(`[POST /api/edl/${edlId}/meter-readings] Looking for/Creating meter type: ${meterType}`);
      
      let existingMeter = null;
      if (meterNumber) {
        const { data: meters } = await supabase
          .from("meters")
          .select("*")
          .eq("property_id", edlPropertyId)
          .eq("meter_number", meterNumber);
        
        existingMeter = meters?.find(m => m.is_active !== false) || meters?.[0] || null;
      }
      
      if (!existingMeter && !meterNumber) {
        const { data: meters } = await supabase
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
          const { data: newMeter, error: createError } = await supabase
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
              const { data: fallbackMeter, error: fallbackError } = await supabase
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
      const { data: meter, error: meterError } = await supabase
        .from("meters")
        .select("*")
        .eq("id", meterId)
        .eq("property_id", edlPropertyId)
        .single();

      if (meterError || !meter) {
        console.warn(`[POST /api/edl/${edlId}/meter-readings] Meter not found: ${meterId}`);
        return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
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
        
        await supabase.from("meters").update(updateData).eq("id", meterId);
      }
      
      actualMeterData = meter;
    }

    const { data: existingReading } = await supabase
      .from("edl_meter_readings")
      .select("id")
      .eq("edl_id", edlId)
      .eq("meter_id", finalMeterId)
      .maybeSingle();

    if (existingReading) {
      console.warn(`[POST /api/edl/${edlId}/meter-readings] 409: Reading already exists`);
      return NextResponse.json(
        { error: "Un relevé existe déjà pour ce compteur. Utilisez PUT pour le modifier." },
        { status: 409 }
      );
    }

    const recorderRole = profile.role === "owner" ? "owner" : "tenant";
    let finalPhotoPath = photoPath;
    
    if (photo && !finalPhotoPath) {
      console.log(`[POST /api/edl/${edlId}/meter-readings] Uploading photo...`);
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      const timestamp = Date.now();
      const fileName = `edl/${edlId}/meters/${actualMeterData.type}_${finalMeterId}_${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
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
        console.warn("[POST /api/edl/[id]/meter-readings] OCR failed");
      }
    }

    let finalValue: number | null = null;
    let isValidated = false;

    if (manualValue && !isNaN(parseFloat(manualValue))) {
      finalValue = parseFloat(manualValue);
      isValidated = true;
    } else if (ocrResult.value !== null) {
      finalValue = ocrResult.value;
      isValidated = ocrResult.confidence >= 80;
    }

    if (finalValue === null && !finalPhotoPath) {
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

    console.log(`[POST /api/edl/${edlId}/meter-readings] Inserting reading:`, readingPayload);

    let finalReading;
    try {
      const { data: reading, error: insertError } = await supabase
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
          const { data: minimalReading, error: minimalError } = await supabase
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

    if (!finalReading) throw new Error("Erreur lors de l'enregistrement du relevé");

    return NextResponse.json({
      reading: finalReading,
      all_meters_recorded: false, // Simplifié pour le débug
    });

  } catch (error: any) {
    console.error(`[POST /api/edl/${edlId}/meter-readings] Fatal Error:`, error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
