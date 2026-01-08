export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes: Building Units (Lots) - SOTA 2026
 * 
 * GET /api/buildings/[id]/units - Liste des lots d'un immeuble
 * POST /api/buildings/[id]/units - Ajouter des lots
 * PUT /api/buildings/[id]/units - Remplacer tous les lots (bulk)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma pour un lot
const BuildingUnitSchema = z.object({
  floor: z.number().min(-5).max(50),
  position: z.string().min(1),
  type: z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]),
  template: z.enum(["studio", "t1", "t2", "t3", "t4", "t5", "local", "parking", "cave"]).optional().nullable(),
  surface: z.number().positive(),
  nb_pieces: z.number().min(0).default(1),
  loyer_hc: z.number().min(0).default(0),
  charges: z.number().min(0).default(0),
  depot_garantie: z.number().min(0).default(0),
  status: z.enum(["vacant", "occupe", "travaux", "reserve"]).default("vacant"),
  notes: z.string().optional().nullable(),
});

/**
 * GET /api/buildings/[id]/units - Liste des lots
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const buildingId = params.id;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    
    // Vérifier que l'immeuble appartient au propriétaire
    const { data: building } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (!building) {
      return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
    }
    
    // Récupérer les lots
    const { data: units, error } = await supabase
      .from("building_units")
      .select("*")
      .eq("building_id", buildingId)
      .order("floor", { ascending: true })
      .order("position", { ascending: true });
    
    if (error) throw error;
    
    return NextResponse.json({ units: units || [] });
    
  } catch (error: any) {
    console.error("Erreur GET /api/buildings/[id]/units:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/buildings/[id]/units - Ajouter un ou plusieurs lots
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const buildingId = params.id;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    
    // Vérifier que l'immeuble appartient au propriétaire
    const { data: building } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (!building) {
      return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
    }
    
    const body = await request.json();
    
    // Gérer un seul lot ou plusieurs
    const unitsData = Array.isArray(body.units) ? body.units : [body];
    
    // Valider chaque lot
    const validatedUnits = [];
    for (const unitData of unitsData) {
      const validation = BuildingUnitSchema.safeParse(unitData);
      if (!validation.success) {
        return NextResponse.json({ 
          error: "Données invalides", 
          details: validation.error.errors 
        }, { status: 400 });
      }
      validatedUnits.push({
        building_id: buildingId,
        ...validation.data,
      });
    }
    
    // Insérer les lots
    const { data: units, error } = await supabase
      .from("building_units")
      .insert(validatedUnits)
      .select();
    
    if (error) {
      // Gérer les erreurs de contrainte d'unicité
      if (error.code === "23505") {
        return NextResponse.json({ 
          error: "Un lot existe déjà à cette position pour cet étage" 
        }, { status: 400 });
      }
      throw error;
    }
    
    return NextResponse.json({ 
      success: true,
      units: units || [],
      count: units?.length || 0,
    }, { status: 201 });
    
  } catch (error: any) {
    console.error("Erreur POST /api/buildings/[id]/units:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/buildings/[id]/units - Remplacer tous les lots (bulk update)
 * Utile pour la synchronisation depuis le wizard
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const buildingId = params.id;
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    
    // Vérifier que l'immeuble appartient au propriétaire
    const { data: building } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (!building) {
      return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
    }
    
    const body = await request.json();
    const unitsData = body.units || [];
    
    // Valider tous les lots
    const validatedUnits = [];
    for (const unitData of unitsData) {
      const validation = BuildingUnitSchema.safeParse(unitData);
      if (!validation.success) {
        return NextResponse.json({ 
          error: "Données invalides", 
          details: validation.error.errors 
        }, { status: 400 });
      }
      validatedUnits.push({
        building_id: buildingId,
        ...validation.data,
      });
    }
    
    // Vérifier qu'aucun lot existant n'a de bail actif
    const { data: existingUnits } = await supabase
      .from("building_units")
      .select("id, current_lease_id")
      .eq("building_id", buildingId);
    
    const unitsWithLeases = (existingUnits || []).filter(u => u.current_lease_id);
    if (unitsWithLeases.length > 0) {
      return NextResponse.json({ 
        error: "Impossible de remplacer : des lots ont des baux actifs. Utilisez PATCH pour modifier individuellement.",
      }, { status: 400 });
    }
    
    // Supprimer les anciens lots
    await supabase
      .from("building_units")
      .delete()
      .eq("building_id", buildingId);
    
    // Insérer les nouveaux lots
    let units: any[] = [];
    if (validatedUnits.length > 0) {
      const { data, error } = await supabase
        .from("building_units")
        .insert(validatedUnits)
        .select();
      
      if (error) throw error;
      units = data || [];
    }
    
    return NextResponse.json({ 
      success: true,
      units,
      count: units.length,
    });
    
  } catch (error: any) {
    console.error("Erreur PUT /api/buildings/[id]/units:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

