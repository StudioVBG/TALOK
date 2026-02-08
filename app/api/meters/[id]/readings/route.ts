export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient, getUserProfile } from "@/lib/helpers/edl-auth";

// Schema for UUID validation
const uuidSchema = z.string().uuid("Invalid meter ID format");

/**
 * GET /api/meters/[id]/readings - Récupérer les relevés d'un compteur
 *
 * @version 2026-01-29 - Fix: Use service client to bypass RLS for DB operations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let meterId: string = "unknown";

  try {
    const resolvedParams = await params;
    meterId = resolvedParams.id;

    console.log(`[GET /api/meters/${meterId}/readings] Entering`);

    // Validate meter ID format
    const parseResult = uuidSchema.safeParse(meterId);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Format d'ID compteur invalide" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[GET /api/meters/${meterId}/readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Use service client for DB operations to bypass RLS
    const serviceClient = createServiceClient();

    // Get user profile for authorization
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Verify meter exists and get property_id
    const { data: meter, error: meterError } = await serviceClient
      .from("meters")
      .select("id, property_id, type, meter_number")
      .eq("id", meterId)
      .single();

    if (meterError || !meter) {
      console.log(`[GET /api/meters/${meterId}/readings] 404: Compteur non trouvé`);
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // Authorization check (owner, tenant with active lease, or admin)
    const isAdmin = profile.role === "admin";

    if (!isAdmin && meter.property_id) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", meter.property_id)
        .single();

      const isOwner = property && property.owner_id === profile.id;

      if (!isOwner) {
        const { data: signer } = await serviceClient
          .from("lease_signers")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (!signer) {
          return NextResponse.json(
            { error: "Accès non autorisé à ce compteur" },
            { status: 403 }
          );
        }
      }
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Fetch readings
    let query = serviceClient
      .from("meter_readings")
      .select("*")
      .eq("meter_id", meterId)
      .order("reading_date", { ascending: false })
      .limit(Math.min(limit, 100));

    if (startDate) {
      query = query.gte("reading_date", startDate);
    }
    if (endDate) {
      query = query.lte("reading_date", endDate);
    }

    const { data: readings, error: readingsError } = await query;

    if (readingsError) {
      console.error(`[GET /api/meters/${meterId}/readings] DB Error:`, readingsError);
      return NextResponse.json(
        { error: readingsError.message },
        { status: 500 }
      );
    }

    console.log(`[GET /api/meters/${meterId}/readings] Success: ${readings?.length || 0} readings`);
    return NextResponse.json({
      meter_id: meterId,
      meter,
      readings: readings || [],
      count: readings?.length || 0,
    });
  } catch (error: unknown) {
    console.error(`[GET /api/meters/${meterId}/readings] Fatal Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meters/[id]/readings - Ajouter un relevé de compteur
 *
 * @version 2026-01-29 - Fix: Use service client to bypass RLS for DB operations
 *                        Fix: Better error handling and logging
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let meterId: string = "unknown";

  try {
    const resolvedParams = await params;
    meterId = resolvedParams.id;

    console.log(`[POST /api/meters/${meterId}/readings] Entering`);

    // Validate meter ID format
    const parseResult = uuidSchema.safeParse(meterId);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Format d'ID compteur invalide" },
        { status: 400 }
      );
    }

    // Auth: verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log(`[POST /api/meters/${meterId}/readings] 401: Non authentifié`);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Use service client for DB operations to bypass RLS
    const serviceClient = createServiceClient();

    // Verify user profile exists
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Parse form data
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
        readingValueStr,
        readingValue,
        readingDate
      });
      return NextResponse.json(
        { error: "reading_value et reading_date requis" },
        { status: 400 }
      );
    }

    // Verify meter exists and get its unit (using service client to avoid RLS issues)
    const { data: meter, error: meterError } = await serviceClient
      .from("meters")
      .select("id, property_id, type, unit")
      .eq("id", meterId)
      .single();

    if (meterError || !meter) {
      console.log(`[POST /api/meters/${meterId}/readings] 404: Compteur non trouvé`, meterError);
      return NextResponse.json({ error: "Compteur non trouvé" }, { status: 404 });
    }

    // Authorization check: owner of the property OR admin
    const isAdmin = profile.role === "admin";
    if (!isAdmin && meter.property_id) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", meter.property_id)
        .single();

      const isOwner = property && property.owner_id === profile.id;

      if (!isOwner) {
        // Check if tenant with active lease
        const { data: signer } = await serviceClient
          .from("lease_signers")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();

        if (!signer) {
          return NextResponse.json(
            { error: "Accès non autorisé à ce compteur" },
            { status: 403 }
          );
        }
      }
    }

    // Check if a reading already exists for this meter and date (UNIQUE constraint)
    const { data: existingReading } = await serviceClient
      .from("meter_readings")
      .select("id, reading_value, unit, photo_url")
      .eq("meter_id", meterId)
      .eq("reading_date", readingDate)
      .maybeSingle();

    if (existingReading) {
      console.log(`[POST /api/meters/${meterId}/readings] Reading already exists for date ${readingDate}, updating...`);
      const updateData: Record<string, any> = {
        reading_value: readingValue,
        source: photoFile ? "ocr" : "manual",
      };

      let photoUrl: string | null = existingReading.photo_url;

      if (photoFile) {
        const fileName = `meters/${meterId}/${Date.now()}_${photoFile.name}`;
        const { data: uploadData, error: uploadError } =
          await serviceClient.storage.from("documents").upload(fileName, photoFile, {
            contentType: photoFile.type,
            upsert: false,
          });

        if (!uploadError && uploadData) {
          photoUrl = uploadData.path;
          updateData.photo_url = photoUrl;
        } else if (uploadError) {
          console.warn(`[POST /api/meters/${meterId}/readings] Photo upload failed:`, uploadError);
        }
      }

      const { data: updatedReading, error: updateError } = await serviceClient
        .from("meter_readings")
        .update(updateData)
        .eq("id", existingReading.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[POST /api/meters/${meterId}/readings] Update Error:`, updateError);
        return NextResponse.json(
          { error: `Erreur mise à jour: ${updateError.message}` },
          { status: 500 }
        );
      }

      console.log(`[POST /api/meters/${meterId}/readings] Updated existing reading:`, updatedReading?.id);
      return NextResponse.json({ reading: updatedReading });
    }

    let photoUrl: string | null = null;

    if (photoFile) {
      const fileName = `meters/${meterId}/${Date.now()}_${photoFile.name}`;
      const { data: uploadData, error: uploadError } =
        await serviceClient.storage.from("documents").upload(fileName, photoFile, {
          contentType: photoFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.warn(`[POST /api/meters/${meterId}/readings] Upload Error:`, uploadError);
        // Continue without photo rather than failing the entire request
      } else {
        photoUrl = uploadData.path;
      }
    }

    // Determine unit from meter or default based on type
    const meterUnit = meter.unit || (meter.type === 'water' || meter.type === 'gas' ? 'm3' : 'kwh');

    // Insert the reading using service client to bypass RLS
    const { data: reading, error } = await serviceClient
      .from("meter_readings")
      .insert({
        meter_id: meterId,
        reading_value: readingValue,
        unit: meterUnit,
        reading_date: readingDate,
        photo_url: photoUrl,
        source: photoFile ? "ocr" : "manual",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error(`[POST /api/meters/${meterId}/readings] Insert Error:`, error);
      return NextResponse.json(
        { error: `Erreur insertion: ${error.message}` },
        { status: 500 }
      );
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

