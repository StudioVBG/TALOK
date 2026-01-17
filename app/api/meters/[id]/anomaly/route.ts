export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/meters/[id]/anomaly - Signaler une anomalie de compteur (P1-3)
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

    const body = await request.json();
    const { reading_value, expected_range, description } = body;

    if (!reading_value) {
      return NextResponse.json(
        { error: "reading_value requis" },
        { status: 400 }
      );
    }

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
      .eq("id", params.id as any)
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
      .eq("meter_id", params.id as any)
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
        meter_id: params.id,
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
      entity_id: params.id,
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





