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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
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
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(12);

    // Si pas de relevés, retourner hasData: false
    if (!edlReadings || edlReadings.length === 0) {
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

    // Si aucune donnée de compteur trouvée
    if (data.length === 0 || (latestElec === 0 && latestWater === 0 && latestGas === 0)) {
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

