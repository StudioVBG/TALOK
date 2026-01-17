export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour comparer les consommations de compteurs entre EDL entrée et sortie
 * 
 * GET /api/leases/[id]/meter-consumption
 * Retourne la différence de consommation pour chaque compteur entre l'entrée et la sortie
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

    const leaseId = params.id;

    // Vérifier que l'utilisateur a accès à ce bail
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        property_id,
        property:properties!inner(
          id,
          owner_id
        )
      `)
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer les EDL d'entrée et de sortie
    const { data: edls, error: edlsError } = await supabase
      .from("edl")
      .select("id, type, status")
      .eq("lease_id", leaseId)
      .in("type", ["entree", "sortie"]);

    if (edlsError) throw edlsError;

    const entryEdl = (edls || []).find((e: any) => e.type === "entree");
    const exitEdl = (edls || []).find((e: any) => e.type === "sortie");

    if (!entryEdl) {
      return NextResponse.json(
        { error: "Aucun EDL d'entrée trouvé pour ce bail" },
        { status: 404 }
      );
    }

    // Récupérer tous les compteurs du logement
    const { data: meters, error: metersError } = await supabase
      .from("meters")
      .select("*")
      .eq("property_id", (lease as any).property_id)
      .eq("is_active", true);

    if (metersError) throw metersError;

    // Récupérer les relevés d'entrée
    const { data: entryReadings, error: entryError } = await supabase
      .from("edl_meter_readings")
      .select("*")
      .eq("edl_id", entryEdl.id);

    if (entryError) throw entryError;

    // Récupérer les relevés de sortie (si EDL de sortie existe)
    let exitReadings: any[] = [];
    if (exitEdl) {
      const { data: exitData, error: exitError } = await supabase
        .from("edl_meter_readings")
        .select("*")
        .eq("edl_id", exitEdl.id);

      if (exitError) throw exitError;
      exitReadings = exitData || [];
    }

    // Construire la comparaison pour chaque compteur
    const consumptions = (meters || []).map((meter: any) => {
      const entryReading = (entryReadings || []).find((r: any) => r.meter_id === meter.id);
      const exitReading = exitReadings.find((r: any) => r.meter_id === meter.id);

      const entryValue = entryReading?.reading_value ?? null;
      const exitValue = exitReading?.reading_value ?? null;

      let consumption: number | null = null;
      if (entryValue !== null && exitValue !== null) {
        consumption = exitValue - entryValue;
      }

      return {
        meter_id: meter.id,
        meter_type: meter.type,
        meter_number: meter.meter_number,
        entry_value: entryValue,
        entry_date: entryReading?.photo_taken_at ?? null,
        exit_value: exitValue,
        exit_date: exitReading?.photo_taken_at ?? null,
        consumption,
        unit: meter.unit || "kWh",
      };
    });

    // Calculer les totaux par type
    const totals = {
      electricity_kwh: consumptions
        .filter((c: any) => c.meter_type === "electricity" && c.consumption !== null)
        .reduce((sum: number, c: any) => sum + (c.consumption || 0), 0) || null,
      gas_m3: consumptions
        .filter((c: any) => c.meter_type === "gas" && c.consumption !== null)
        .reduce((sum: number, c: any) => sum + (c.consumption || 0), 0) || null,
      water_m3: consumptions
        .filter((c: any) => c.meter_type === "water" && c.consumption !== null)
        .reduce((sum: number, c: any) => sum + (c.consumption || 0), 0) || null,
    };

    return NextResponse.json({
      consumptions,
      totals,
      entry_edl: {
        id: entryEdl.id,
        status: (entryEdl as any).status,
      },
      exit_edl: exitEdl ? {
        id: exitEdl.id,
        status: (exitEdl as any).status,
      } : null,
    });

  } catch (error: unknown) {
    console.error("[Meter Consumption] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

