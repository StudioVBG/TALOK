export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes: Building Detail (Immeuble) - SOTA 2026
 * 
 * GET /api/buildings/[id] - Détails d'un immeuble
 * PATCH /api/buildings/[id] - Mettre à jour un immeuble
 * DELETE /api/buildings/[id] - Supprimer un immeuble
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma pour mise à jour
const UpdateBuildingSchema = z.object({
  name: z.string().min(1).optional(),
  adresse_complete: z.string().min(1).optional(),
  code_postal: z.string().regex(/^\d{5}$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  floors: z.number().min(1).max(50).optional(),
  construction_year: z.number().min(1800).max(2100).optional().nullable(),
  has_ascenseur: z.boolean().optional(),
  has_gardien: z.boolean().optional(),
  has_interphone: z.boolean().optional(),
  has_digicode: z.boolean().optional(),
  has_local_velo: z.boolean().optional(),
  has_local_poubelles: z.boolean().optional(),
  notes: z.string().optional().nullable(),
}).partial();

/**
 * GET /api/buildings/[id] - Détails d'un immeuble avec ses lots
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
    
    // Récupérer l'immeuble avec ses lots
    const { data: building, error } = await supabase
      .from("buildings")
      .select(`
        *,
        units:building_units(
          *,
          current_lease:leases(id, statut, loyer, charges_forfaitaires)
        )
      `)
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
      }
      throw error;
    }
    
    // Calculer les statistiques
    const units = building.units || [];
    const logements = units.filter((u: any) => !["parking", "cave"].includes(u.type));
    const parkings = units.filter((u: any) => u.type === "parking");
    const caves = units.filter((u: any) => u.type === "cave");
    const occupied = logements.filter((u: any) => u.status === "occupe");
    const vacant = logements.filter((u: any) => u.status === "vacant");
    const travaux = units.filter((u: any) => u.status === "travaux");
    
    const stats = {
      total_units: logements.length,
      total_parkings: parkings.length,
      total_caves: caves.length,
      occupied_units: occupied.length,
      vacant_units: vacant.length,
      units_en_travaux: travaux.length,
      surface_totale: units.reduce((acc: number, u: any) => acc + (u.surface || 0), 0),
      occupancy_rate: logements.length > 0 
        ? Math.round((occupied.length / logements.length) * 100) 
        : 0,
      revenus_potentiels: units.reduce((acc: number, u: any) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0),
      revenus_actuels: occupied.reduce((acc: number, u: any) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0),
    };
    
    // Organiser les lots par étage
    const unitsByFloor: Record<number, any[]> = {};
    for (const unit of units) {
      const floor = unit.floor ?? 0;
      if (!unitsByFloor[floor]) {
        unitsByFloor[floor] = [];
      }
      unitsByFloor[floor].push(unit);
    }
    
    // Trier chaque étage par position
    for (const floor in unitsByFloor) {
      unitsByFloor[floor].sort((a, b) => a.position.localeCompare(b.position));
    }
    
    return NextResponse.json({ 
      building: {
        ...building,
        stats,
        unitsByFloor,
      }
    });
    
  } catch (error: any) {
    console.error("Erreur GET /api/buildings/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/buildings/[id] - Mettre à jour un immeuble
 */
export async function PATCH(
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
    const { data: existingBuilding } = await supabase
      .from("buildings")
      .select("id")
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (!existingBuilding) {
      return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
    }
    
    // Valider les données
    const body = await request.json();
    const validation = UpdateBuildingSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Données invalides", 
        details: validation.error.errors 
      }, { status: 400 });
    }
    
    // Mettre à jour
    const { data: building, error } = await supabase
      .from("buildings")
      .update(validation.data)
      .eq("id", buildingId)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ building });
    
  } catch (error: any) {
    console.error("Erreur PATCH /api/buildings/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/buildings/[id] - Supprimer un immeuble
 */
export async function DELETE(
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
    
    // Vérifier que l'immeuble appartient au propriétaire et n'a pas de baux actifs
    const { data: building } = await supabase
      .from("buildings")
      .select(`
        id,
        units:building_units(
          id,
          current_lease_id
        )
      `)
      .eq("id", buildingId)
      .eq("owner_id", profile.id)
      .single();
    
    if (!building) {
      return NextResponse.json({ error: "Immeuble non trouvé" }, { status: 404 });
    }
    
    // Vérifier si des lots ont des baux actifs
    const unitsWithLeases = (building.units || []).filter((u: any) => u.current_lease_id);
    if (unitsWithLeases.length > 0) {
      return NextResponse.json({ 
        error: "Impossible de supprimer : des lots ont des baux actifs",
        details: { unitsWithLeases: unitsWithLeases.length }
      }, { status: 400 });
    }
    
    // Supprimer (cascade supprimera les units)
    const { error } = await supabase
      .from("buildings")
      .delete()
      .eq("id", buildingId);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Erreur DELETE /api/buildings/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

