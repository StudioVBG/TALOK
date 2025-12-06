// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/**
 * GET /api/properties/[id]/meters - Récupérer les compteurs d'un logement
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const serviceClient = getServiceClient(); // Utiliser service client pour éviter RLS recursion
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const propertyId = params.id;

    // Vérifier l'accès au logement via service client (évite récursion RLS)
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    // Si pas admin, vérifier que l'utilisateur est propriétaire ou locataire
    if (!isAdmin) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", propertyId)
        .single();

      if (!property) {
        return NextResponse.json({ error: "Logement non trouvé" }, { status: 404 });
      }

      const propertyData = property as any;
      if (propertyData.owner_id !== profileData?.id) {
        // Vérifier si locataire du logement
        const { data: lease } = await serviceClient
          .from("leases")
          .select("id")
          .eq("property_id", propertyId)
          .eq("statut", "active")
          .single();

        if (!lease) {
          return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }

        const { data: signer } = await serviceClient
          .from("lease_signers")
          .select("id")
          .eq("lease_id", (lease as any).id)
          .eq("profile_id", profileData?.id)
          .single();

        if (!signer) {
          return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
        }
      }
    }

    // Récupérer les compteurs via service client
    const { data: meters, error } = await serviceClient
      .from("meters")
      .select("*")
      .eq("property_id", propertyId)
      .order("type", { ascending: true });

    if (error) throw error;

    // Récupérer le dernier relevé pour chaque compteur
    const metersWithLastReading = await Promise.all(
      (meters || []).map(async (meter: any) => {
        const { data: lastReading } = await serviceClient
          .from("meter_readings")
          .select("value, reading_date")
          .eq("meter_id", meter.id)
          .order("reading_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...meter,
          last_reading: lastReading ? {
            value: lastReading.value,
            date: lastReading.reading_date,
          } : null,
        };
      })
    );

    return NextResponse.json({ meters: metersWithLastReading });
  } catch (error: any) {
    console.error("[GET /api/properties/[id]/meters] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/properties/[id]/meters - Ajouter un compteur à un logement
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
    const { 
      type, 
      serial_number,
      reference, // Ancien champ (compatibilité)
      location,
      provider, 
      unit,
      is_active = true,
      is_connected = false, 
      lease_id 
    } = body;

    // Normaliser le type (accepter les deux formats)
    const typeMapping: Record<string, string> = {
      electricite: "electricity",
      electricity: "electricity",
      gaz: "gas",
      gas: "gas",
      eau: "water",
      water: "water",
      heating: "heating",
    };

    const normalizedType = typeMapping[type?.toLowerCase()];
    if (!normalizedType) {
      return NextResponse.json(
        { error: "Type requis: 'electricity', 'gas', 'water' ou 'heating'" },
        { status: 400 }
      );
    }

    // Accepter serial_number ou reference
    const meterNumber = serial_number || reference;
    if (!meterNumber) {
      return NextResponse.json(
        { error: "Numéro de compteur (serial_number) requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est propriétaire
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", params.id as any)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Logement non trouvé" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const propertyData = property as any;
    const profileData = profile as any;
    
    if (propertyData.owner_id !== profileData?.id && profileData?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut ajouter des compteurs" },
        { status: 403 }
      );
    }

    // Déterminer l'unité par défaut selon le type
    const defaultUnits: Record<string, string> = {
      electricity: "kWh",
      gas: "m³",
      water: "m³",
      heating: "kWh",
    };

    // Créer le compteur
    const { data: meter, error } = await supabase
      .from("meters")
      .insert({
        property_id: params.id,
        type: normalizedType,
        serial_number: meterNumber,
        location: location || null,
        provider: provider || null,
        unit: unit || defaultUnits[normalizedType],
        is_active: is_active,
        is_connected: is_connected,
      } as any)
      .select()
      .single();

    if (error) throw error;

    const meterData = meter as any;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "meter_added",
      entity_type: "meter",
      entity_id: meterData.id,
      metadata: { 
        type: normalizedType, 
        serial_number: meterNumber,
        provider,
        property_id: params.id,
      },
    } as any);

    return NextResponse.json({ meter: meterData });
  } catch (error: any) {
    console.error("[POST /api/properties/[id]/meters] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





