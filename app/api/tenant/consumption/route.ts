import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API SOTA 2026: Données de consommation du locataire
 * 
 * Retourne les relevés de compteurs (électricité, eau, gaz) pour le bail actif.
 * Si aucune donnée n'existe, retourne hasData: false.
 */

interface ConsumptionData {
  month: string;
  elec: number;
  water: number;
  gas: number;
}

interface ConsumptionResponse {
  data: ConsumptionData[];
  current: {
    electricity: number;
    water: number;
    gas: number;
  };
  hasData: boolean;
  lastUpdate: string | null;
}

/**
 * Fallback : construit les données de consommation depuis la table meter_readings
 * quand les EDL ne contiennent pas de relevés exploitables.
 */
async function buildConsumptionFromMeterReadings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string
): Promise<ConsumptionResponse | null> {
  // Récupérer les compteurs actifs de la propriété
  const { data: meters } = await supabase
    .from("meters")
    .select("id, type, unit")
    .eq("property_id", propertyId)
    .eq("is_active", true);

  if (!meters || meters.length === 0) return null;

  const meterIds = meters.map((m: any) => m.id);

  // Récupérer les relevés des 12 derniers mois
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: readings } = await supabase
    .from("meter_readings")
    .select("meter_id, reading_value, reading_date")
    .in("meter_id", meterIds)
    .gte("reading_date", twelveMonthsAgo.toISOString().slice(0, 10))
    .order("reading_date", { ascending: true });

  if (!readings || readings.length === 0) return null;

  // Index des types par meter_id
  const meterTypeMap = new Map<string, string>();
  for (const m of meters) {
    meterTypeMap.set(m.id, (m as any).type || "");
  }

  // Agréger les relevés par mois et type
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const consumptionByMonth: Record<string, ConsumptionData> = {};
  let latestElec = 0, latestWater = 0, latestGas = 0;
  let lastUpdate: string | null = null;

  for (const r of readings) {
    const date = new Date(r.reading_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
    const monthLabel = monthNames[date.getMonth()];

    if (!consumptionByMonth[monthKey]) {
      consumptionByMonth[monthKey] = { month: monthLabel, elec: 0, water: 0, gas: 0 };
    }

    const meterType = meterTypeMap.get(r.meter_id) || "";
    const value = typeof r.reading_value === "string" ? parseFloat(r.reading_value) || 0 : Number(r.reading_value) || 0;

    if (meterType === "electricity" || meterType === "electricite") {
      consumptionByMonth[monthKey].elec = value;
      latestElec = value;
    } else if (meterType === "water" || meterType === "eau") {
      consumptionByMonth[monthKey].water = value;
      latestWater = value;
    } else if (meterType === "gas" || meterType === "gaz") {
      consumptionByMonth[monthKey].gas = value;
      latestGas = value;
    }

    lastUpdate = r.reading_date;
  }

  const data = Object.values(consumptionByMonth).slice(-6);

  if (data.length === 0) return null;

  return {
    data,
    current: { electricity: latestElec, water: latestWater, gas: latestGas },
    hasData: true,
    lastUpdate,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil (maybeSingle pour éviter 406 si profil absent)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      // Profil pas encore créé — retourner données vides plutôt qu'une erreur
      return NextResponse.json({
        data: [], current: { electricity: 0, water: 0, gas: 0 },
        hasData: false, lastUpdate: null,
      } as ConsumptionResponse);
    }

    if (profile.role !== "tenant") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier si le locataire a un bail actif
    const { data: leaseSigners } = await supabase
      .from("lease_signers")
      .select(`
        id,
        lease:leases!inner(
          id,
          statut,
          property_id
        )
      `)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"]);

    // Filtrer les baux actifs
    const activeLeases = leaseSigners?.filter(
      (ls: any) => ls.lease?.statut === "active" || ls.lease?.statut === "fully_signed"
    ) || [];

    // Si pas de bail actif, retourner hasData: false
    if (activeLeases.length === 0) {
      return NextResponse.json({
        data: [],
        current: { electricity: 0, water: 0, gas: 0 },
        hasData: false,
        lastUpdate: null,
      } as ConsumptionResponse);
    }

    const currentLease = activeLeases[0].lease;
    const propertyId = currentLease.property_id;

    // Récupérer les relevés de compteurs des EDLs
    const { data: edlReadings } = await supabase
      .from("edl")
      .select(`
        id,
        type,
        created_at,
        items:edl_items(
          id,
          reading_value,
          reading_unit,
          category
        )
      `)
      .eq("property_id", propertyId as string)
      .order("created_at", { ascending: false })
      .limit(12);

    // Fallback: si pas de relevés EDL, chercher dans meter_readings (relevés de compteurs réguliers)
    if (!edlReadings || edlReadings.length === 0) {
      const meterData = await buildConsumptionFromMeterReadings(supabase, propertyId as string);
      if (meterData) return NextResponse.json(meterData);

      return NextResponse.json({
        data: [],
        current: { electricity: 0, water: 0, gas: 0 },
        hasData: false,
        lastUpdate: null,
      } as ConsumptionResponse);
    }

    // Transformer les données pour le graphique
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
    
    const consumptionByMonth: Record<string, ConsumptionData> = {};
    let latestElec = 0;
    let latestWater = 0;
    let latestGas = 0;
    let lastUpdate: string | null = null;

    edlReadings.forEach((edl: any) => {
      const date = new Date(edl.created_at);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const monthLabel = monthNames[date.getMonth()];

      if (!consumptionByMonth[monthKey]) {
        consumptionByMonth[monthKey] = {
          month: monthLabel,
          elec: 0,
          water: 0,
          gas: 0,
        };
      }

      // Parcourir les items pour extraire les relevés
      edl.items?.forEach((item: any) => {
        if (item.reading_value) {
          const value = parseFloat(item.reading_value) || 0;
          
          // Catégoriser par type de compteur
          if (item.category === "compteur_electricite" || item.reading_unit === "kWh") {
            consumptionByMonth[monthKey].elec = value;
            if (!lastUpdate) {
              latestElec = value;
              lastUpdate = edl.created_at;
            }
          } else if (item.category === "compteur_eau" || item.reading_unit === "m³") {
            consumptionByMonth[monthKey].water = value;
            if (!lastUpdate) latestWater = value;
          } else if (item.category === "compteur_gaz") {
            consumptionByMonth[monthKey].gas = value;
            if (!lastUpdate) latestGas = value;
          }
        }
      });
    });

    // Convertir en tableau et trier par date
    const data = Object.values(consumptionByMonth)
      .slice(0, 6)
      .reverse();

    // Si aucune donnée de compteur dans les EDL, fallback sur meter_readings
    if (data.length === 0 || (latestElec === 0 && latestWater === 0 && latestGas === 0)) {
      const meterData = await buildConsumptionFromMeterReadings(supabase, propertyId as string);
      if (meterData) return NextResponse.json(meterData);

      return NextResponse.json({
        data: [],
        current: { electricity: 0, water: 0, gas: 0 },
        hasData: false,
        lastUpdate: null,
      } as ConsumptionResponse);
    }

    return NextResponse.json({
      data,
      current: {
        electricity: latestElec,
        water: latestWater,
        gas: latestGas,
      },
      hasData: true,
      lastUpdate,
    } as ConsumptionResponse);
  } catch (error: unknown) {
    console.error("[Consumption API] Erreur:", error);
    // Retourner un état explicite plutôt qu'une 500
    return NextResponse.json({
      data: [],
      current: { electricity: 0, water: 0, gas: 0 },
      hasData: false,
      lastUpdate: null,
    } as ConsumptionResponse);
  }
}

