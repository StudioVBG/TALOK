export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API Route: Units COPRO (Lots)
// GET /api/copro/units?siteId= - Liste des lots
// POST /api/copro/units - Créer des lots
// PUT /api/copro/units/tantiemes - Mettre à jour les tantièmes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma pour un lot
const UnitSchema = z.object({
  site_id: z.string().uuid(),
  building_id: z.string().uuid().optional(),
  floor_id: z.string().uuid().optional(),
  lot_number: z.string().min(1, 'Numéro de lot requis'),
  lot_suffix: z.string().optional(),
  unit_type: z.enum([
    'appartement', 'maison', 'studio', 'duplex', 'triplex',
    'local_commercial', 'bureau',
    'cave', 'parking', 'box', 'garage',
    'jardin', 'terrasse', 'balcon',
    'local_technique', 'loge_gardien', 'autre'
  ]).default('appartement'),
  surface_carrez: z.number().positive().optional(),
  surface_habitable: z.number().positive().optional(),
  rooms_count: z.number().min(0).default(0),
  floor_level: z.number().optional(),
  door_number: z.string().optional(),
  staircase: z.string().optional(),
  tantieme_general: z.number().min(0).default(0),
  tantieme_eau: z.number().min(0).default(0),
  tantieme_chauffage: z.number().min(0).default(0),
  tantieme_ascenseur: z.number().min(0).default(0),
});

// Schéma pour création batch
const BatchUnitsSchema = z.object({
  units: z.array(UnitSchema),
});

// Schéma pour mise à jour des tantièmes
const UpdateTantiemesSchema = z.object({
  updates: z.array(z.object({
    id: z.string().uuid(),
    tantieme_general: z.number().min(0),
    tantieme_eau: z.number().min(0).optional(),
    tantieme_chauffage: z.number().min(0).optional(),
    tantieme_ascenseur: z.number().min(0).optional(),
  })),
});

// GET: Liste des lots
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const buildingId = searchParams.get('buildingId');
    const withDetails = searchParams.get('withDetails') === 'true';
    const role = searchParams.get('role'); // 'owner' pour récupérer les lots d'un bailleur
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Mode bailleur : récupérer tous les lots dont l'utilisateur est propriétaire
    if (role === 'owner') {
      // Récupérer le profil de l'utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!profile) {
        return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
      }
      
      // Récupérer les lots via la table ownerships
      const { data: ownerships, error: ownerError } = await supabase
        .from('ownerships')
        .select(`
          id,
          ownership_type,
          ownership_share,
          copro_units!inner(
            id,
            lot_number,
            lot_suffix,
            unit_type,
            surface_carrez,
            surface_habitable,
            tantieme_general,
            tantieme_eau,
            tantieme_chauffage,
            copro_sites(id, name, address_street, address_city)
          )
        `)
        .eq('profile_id', profile.id)
        .eq('is_current', true);
      
      if (ownerError) {
        console.error('Erreur récupération ownerships:', ownerError);
        // Fallback : retourner un tableau vide plutôt qu'une erreur
        return NextResponse.json([]);
      }
      
      // Transformer les données pour le format attendu
      const units = (ownerships || []).map((ownership: any) => ({
        id: ownership.copro_units?.id,
        lot_number: ownership.copro_units?.lot_number,
        lot_suffix: ownership.copro_units?.lot_suffix,
        unit_type: ownership.copro_units?.unit_type,
        surface_carrez: ownership.copro_units?.surface_carrez,
        surface_habitable: ownership.copro_units?.surface_habitable,
        tantieme_general: ownership.copro_units?.tantieme_general,
        tantieme_eau: ownership.copro_units?.tantieme_eau,
        tantieme_chauffage: ownership.copro_units?.tantieme_chauffage,
        ownership_type: ownership.ownership_type,
        ownership_share: ownership.ownership_share,
        site: ownership.copro_units?.copro_sites,
        copro_sites: ownership.copro_units?.copro_sites,
        charges_total: 0, // À calculer via une autre requête si besoin
        charges_recuperables: 0,
        charges_by_service: [],
      })).filter((u: any) => u.id); // Filtrer les entrées sans lot valide
      
      return NextResponse.json(units);
    }
    
    if (!siteId) {
      return NextResponse.json({ error: 'siteId requis' }, { status: 400 });
    }
    
    // Utiliser la vue enrichie si demandé
    if (withDetails) {
      let query = supabase
        .from('v_copro_units_with_tantiemes')
        .select('*')
        .eq('site_id', siteId)
        .order('lot_number');
      
      if (buildingId) {
        query = query.eq('building_id', buildingId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    }
    
    // Liste simple
    let query = supabase
      .from('copro_units')
      .select(`
        *,
        building:buildings(name, building_type),
        floor:floors(level, name),
        owners:ownerships(
          id,
          ownership_type,
          ownership_share,
          is_current,
          profile:profiles(first_name, last_name, email)
        )
      `)
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('lot_number');
    
    if (buildingId) {
      query = query.eq('building_id', buildingId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data || []);
  } catch (error: unknown) {
    console.error('Erreur GET /api/copro/units:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// POST: Créer des lots
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
    if (body.units && Array.isArray(body.units)) {
      const validationResult = BatchUnitsSchema.safeParse(body);
      
      if (!validationResult.success) {
        return NextResponse.json(
          { error: 'Données invalides', details: validationResult.error.errors },
          { status: 400 }
        );
      }
      
      const { data: units, error } = await supabase
        .from('copro_units')
        .insert(validationResult.data.units)
        .select();
      
      if (error) throw error;
      
      return NextResponse.json(units || [], { status: 201 });
    }
    
    // Création simple
    const validationResult = UnitSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { data: unit, error } = await supabase
      .from('copro_units')
      .insert(validationResult.data)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json(unit, { status: 201 });
  } catch (error: unknown) {
    console.error('Erreur POST /api/copro/units:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

// PUT: Mettre à jour les tantièmes en batch
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const validationResult = UpdateTantiemesSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const { updates } = validationResult.data;
    
    // Mettre à jour chaque lot
    for (const update of updates) {
      const { id, ...tantiemes } = update;
      const { error } = await supabase
        .from('copro_units')
        .update(tantiemes)
        .eq('id', id);
      
      if (error) throw error;
    }
    
    return NextResponse.json({ 
      success: true, 
      updated: updates.length 
    });
  } catch (error: unknown) {
    console.error('Erreur PUT /api/copro/units:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

