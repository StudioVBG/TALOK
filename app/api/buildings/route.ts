export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes: Buildings (Immeubles) - SOTA 2026
 * 
 * GET /api/buildings - Liste des immeubles du propriétaire
 * POST /api/buildings - Créer un immeuble avec ses lots
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma pour un lot (building unit)
const BuildingUnitSchema = z.object({
  floor: z.number().min(-5).max(50),
  position: z.string().min(1),
  type: z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]),
  template: z.enum(["studio", "t1", "t2", "t3", "t4", "t5", "local", "parking", "cave"]).optional(),
  surface: z.number().positive(),
  nb_pieces: z.number().min(0).default(1),
  loyer_hc: z.number().min(0).default(0),
  charges: z.number().min(0).default(0),
  depot_garantie: z.number().min(0).default(0),
  status: z.enum(["vacant", "occupe", "travaux", "reserve"]).default("vacant"),
});

// Schéma pour créer un immeuble
const CreateBuildingSchema = z.object({
  // Lien optionnel avec property existante
  property_id: z.string().uuid().optional(),
  
  // Identification
  name: z.string().min(1, "Nom requis"),
  
  // Adresse
  adresse_complete: z.string().min(1, "Adresse requise"),
  code_postal: z.string().regex(/^\d{5}$/, "Code postal invalide"),
  ville: z.string().min(1, "Ville requise"),
  departement: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  
  // Structure
  floors: z.number().min(1).max(50).default(4),
  construction_year: z.number().min(1800).max(2100).optional(),
  
  // Parties communes
  has_ascenseur: z.boolean().default(false),
  has_gardien: z.boolean().default(false),
  has_interphone: z.boolean().default(false),
  has_digicode: z.boolean().default(false),
  has_local_velo: z.boolean().default(false),
  has_local_poubelles: z.boolean().default(false),
  
  // Lots (optionnels à la création)
  units: z.array(BuildingUnitSchema).optional(),
});

/**
 * GET /api/buildings - Liste des immeubles du propriétaire connecté
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    
    // Récupérer les immeubles avec leurs lots
    const { data: buildings, error } = await supabase
      .from("buildings")
      .select(`
        *,
        units:building_units(*)
      `)
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    
    // Calculer les stats pour chaque immeuble
    const buildingsWithStats = (buildings || []).map((building: any) => {
      const units = building.units || [];
      const logements = units.filter((u: any) => !["parking", "cave"].includes(u.type));
      const parkings = units.filter((u: any) => u.type === "parking");
      const caves = units.filter((u: any) => u.type === "cave");
      const occupied = logements.filter((u: any) => u.status === "occupe");
      
      return {
        ...building,
        stats: {
          total_units: logements.length,
          total_parkings: parkings.length,
          total_caves: caves.length,
          surface_totale: units.reduce((acc: number, u: any) => acc + (u.surface || 0), 0),
          occupancy_rate: logements.length > 0 
            ? Math.round((occupied.length / logements.length) * 100) 
            : 0,
          revenus_potentiels: units.reduce((acc: number, u: any) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0),
        }
      };
    });
    
    return NextResponse.json({ buildings: buildingsWithStats });
    
  } catch (error: any) {
    console.error("Erreur GET /api/buildings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/buildings - Créer un immeuble avec ses lots
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupérer le profil propriétaire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (profileError || !profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Profil propriétaire requis" }, { status: 403 });
    }
    
    // Valider les données
    const body = await request.json();
    const validation = CreateBuildingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Données invalides", 
        details: validation.error.errors 
      }, { status: 400 });
    }
    
    const { units, ...buildingData } = validation.data;
    
    // Calculer le département depuis le code postal
    let departement = buildingData.departement;
    if (!departement && buildingData.code_postal) {
      const cp = buildingData.code_postal;
      if (cp.startsWith("97")) {
        departement = cp.substring(0, 3);
      } else if (cp.startsWith("20")) {
        departement = parseInt(cp, 10) < 20200 ? "2A" : "2B";
      } else {
        departement = cp.substring(0, 2);
      }
    }
    
    // Créer l'immeuble
    const { data: building, error: buildingError } = await supabase
      .from("buildings")
      .insert({
        owner_id: profile.id,
        property_id: buildingData.property_id || null,
        name: buildingData.name,
        adresse_complete: buildingData.adresse_complete,
        code_postal: buildingData.code_postal,
        ville: buildingData.ville,
        departement,
        latitude: buildingData.latitude,
        longitude: buildingData.longitude,
        floors: buildingData.floors,
        construction_year: buildingData.construction_year,
        has_ascenseur: buildingData.has_ascenseur,
        has_gardien: buildingData.has_gardien,
        has_interphone: buildingData.has_interphone,
        has_digicode: buildingData.has_digicode,
        has_local_velo: buildingData.has_local_velo,
        has_local_poubelles: buildingData.has_local_poubelles,
      })
      .select()
      .single();
    
    if (buildingError) {
      console.error("Erreur création building:", buildingError);
      throw buildingError;
    }
    
    // Créer les lots si fournis
    let createdUnits: any[] = [];
    if (units && units.length > 0) {
      const unitsToInsert = units.map(unit => ({
        building_id: building.id,
        floor: unit.floor,
        position: unit.position,
        type: unit.type,
        template: unit.template,
        surface: unit.surface,
        nb_pieces: unit.nb_pieces,
        loyer_hc: unit.loyer_hc,
        charges: unit.charges,
        depot_garantie: unit.depot_garantie,
        status: unit.status,
      }));
      
      const { data: insertedUnits, error: unitsError } = await supabase
        .from("building_units")
        .insert(unitsToInsert)
        .select();
      
      if (unitsError) {
        console.error("Erreur création units:", unitsError);
        // On ne fait pas échouer toute l'opération, l'immeuble est créé
      } else {
        createdUnits = insertedUnits || [];
      }
    }
    
    return NextResponse.json({ 
      success: true,
      building: {
        ...building,
        units: createdUnits,
      },
      buildingId: building.id,
    }, { status: 201 });
    
  } catch (error: any) {
    console.error("Erreur POST /api/buildings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

