export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Buildings COPRO
// GET /api/copro/buildings?siteId= - Liste des bâtiments
// POST /api/copro/buildings - Créer un/des bâtiment(s)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma pour un bâtiment
const BuildingSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().min(1, 'Nom requis'),
  code: z.string().optional(),
  building_type: z.enum(['immeuble', 'maison', 'parking', 'local_commercial', 'autre']).default('immeuble'),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  floors_count: z.number().min(0).default(0),
  has_basement: z.boolean().default(false),
  basement_levels: z.number().min(0).default(0),
  has_elevator: z.boolean().default(false),
  elevator_count: z.number().min(0).default(0),
  construction_year: z.number().optional(),
  heating_type: z.enum(['collectif', 'individuel', 'mixte', 'aucun']).optional(),
  water_type: z.enum(['collectif', 'individuel', 'compteurs_divisionnaires']).optional(),
  display_order: z.number().default(0),
});

// Schéma pour création batch avec étages
const BatchBuildingsSchema = z.object({
  site_id: z.string().uuid(),
  buildings: z.array(z.object({
    name: z.string().min(1),
    building_type: z.enum(['immeuble', 'maison', 'parking', 'local_commercial', 'autre']).default('immeuble'),
    floors_count: z.number().min(0).default(0),
    has_basement: z.boolean().default(false),
    basement_levels: z.number().min(0).default(0),
    has_elevator: z.boolean().default(false),
    units_per_floor: z.number().min(0).default(0),
  })),
  create_floors: z.boolean().default(true),
});

// GET: Liste des bâtiments
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    if (!siteId) {
      return NextResponse.json({ error: 'siteId requis' }, { status: 400 });
    }
    
    const { data: buildings, error } = await supabase
      .from('buildings')
      .select(`
        *,
        floors:floors(id, level, name),
        units:copro_units(count)
      `)
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('display_order');
    
    if (error) throw error;
    
    return NextResponse.json(buildings || []);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/buildings:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Créer un ou plusieurs bâtiments
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Vérifier si c'est une création batch
    if (body.buildings && Array.isArray(body.buildings)) {
      const validationResult = BatchBuildingsSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Données invalides', details: validationResult.error.errors },
          { status: 400 }
        );
      }
      
      const { site_id, buildings, create_floors } = validationResult.data;
      const createdBuildings = [];
      const createdFloors = [];
      
      for (let i = 0; i < buildings.length; i++) {
        const buildingInput = buildings[i];
        
        // Créer le bâtiment
        const { data: building, error: buildingError } = await supabase
          .from('buildings')
          .insert({
            site_id,
            name: buildingInput.name,
            building_type: buildingInput.building_type,
            floors_count: buildingInput.floors_count,
            has_basement: buildingInput.has_basement,
            basement_levels: buildingInput.basement_levels,
            has_elevator: buildingInput.has_elevator,
            display_order: i,
          })
          .select()
          .single();
        
        if (buildingError) throw buildingError;
        createdBuildings.push(building);
        
        // Créer les étages si demandé
        if (create_floors) {
          const floorsToCreate = [];
          
          // Sous-sols
          for (let level = -(buildingInput.basement_levels || 0); level < 0; level++) {
            floorsToCreate.push({
              building_id: building.id,
              level,
              name: `Sous-sol ${Math.abs(level)}`,
              display_order: level + 100,
            });
          }
          
          // RDC et étages
          for (let level = 0; level <= buildingInput.floors_count; level++) {
            floorsToCreate.push({
              building_id: building.id,
              level,
              name: level === 0 ? 'Rez-de-chaussée' : `${level}${level === 1 ? 'er' : 'ème'} étage`,
              display_order: level + 100,
            });
          }
          
          if (floorsToCreate.length > 0) {
            const { data: floors, error: floorsError } = await supabase
              .from('floors')
              .insert(floorsToCreate)
              .select();
            
            if (floorsError) throw floorsError;
            createdFloors.push(...(floors || []));
          }
        }
      }
      
      return NextResponse.json({
        buildings: createdBuildings,
        floors: createdFloors,
      }, { status: 201 });
    }
    
    // Création simple
    const validationResult = BuildingSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { data: building, error } = await supabase
      .from('buildings')
      .insert(validationResult.data)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(building, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/buildings:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

