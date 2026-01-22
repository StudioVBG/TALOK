export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Zod schemas for meter anomaly reporting
 * @version 2026-01-22 - Added Zod validation for data integrity
 */
const paramsSchema = z.object({
  id: z.string().uuid("ID compteur invalide"),
});

const anomalySchema = z.object({
  reading_value: z.number().nonnegative("La valeur doit être positive"),
  expected_range: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  description: z.string().max(500, "Description trop longue (max 500 caractères)").optional(),
});

/**
 * POST /api/meters/[id]/anomaly - Signaler une anomalie de compteur (P1-3)
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern + Zod validation
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params is now a Promise
  const resolvedParams = await params;

  // Validate params
  const paramsResult = paramsSchema.safeParse(resolvedParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: "ID compteur invalide", details: paramsResult.error.flatten() },
      { status: 400 }
    );
  }
  const meterId = paramsResult.data.id;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }

    const bodyResult = anomalySchema.safeParse(body);
    if (!bodyResult.success) {
      return NextResponse.json(
        { error: "Validation échouée", details: bodyResult.error.flatten() },
        { status: 400 }
      );
    }

    const { reading_value, expected_range, description } = bodyResult.data;

    // Vérifier l'accès au compteur
    const { data: meter } = await supabase
      .from("meters")
      .select(`
        *,
        property:properties!inner(
          owner_id,
          leases:leases!inner(
            roommates(user_id)
          )
        )
      `)
      .eq("id", meterId as any)
      .single();

    if (!meter) {
      return NextResponse.json(
        { error: "Compteur non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const meterData = meter as any;
    const profileData = profile as any;
    const isOwner = meterData.property?.owner_id === profileData?.id;
    const isTenant = meterData.property?.leases?.some((lease: any) =>
      lease.roommates?.some((r: any) => r.user_id === user.id)
    );

    if (!isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si c'est vraiment une anomalie (comparaison avec les relevés précédents)
    const { data: recentReadings } = await supabase
      .from("meter_readings")
      .select("reading_value, reading_date")
      .eq("meter_id", meterId as any)
      .order("reading_date", { ascending: false })
      .limit(3);

    let isAnomaly = false;
    if (recentReadings && recentReadings.length > 0) {
      const avgRecent = recentReadings.reduce(
        (sum, r) => sum + parseFloat((r as any).reading_value),
        0
      ) / recentReadings.length;
      const deviation = Math.abs(reading_value - avgRecent) / avgRecent;
      // Si écart > 30%, considérer comme anomalie
      isAnomaly = deviation > 0.3;
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
      event_type: "Energy.AnomalyDetected",
      payload: {
        meter_id: meterId,
        reading_value,
        expected_range,
        description,
        detected_by: user.id,
        is_confirmed_anomaly: isAnomaly,
      },
    } as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "anomaly_detected",
      entity_type: "meter",
      entity_id: meterId,
      metadata: {
        reading_value,
        expected_range,
        description,
        is_anomaly: isAnomaly,
      },
    } as any);

    return NextResponse.json({
      success: true,
      is_anomaly: isAnomaly,
      message: isAnomaly
        ? "Anomalie détectée et signalée"
        : "Relevé enregistré (pas d'anomalie détectée)",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





