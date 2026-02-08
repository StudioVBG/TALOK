// =====================================================
// Service: Gestion des Sites COPRO
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type { 
  Site, 
  Building, 
  Floor, 
  CoproUnit,
  CreateSiteInput, 
  UpdateSiteInput,
  CreateBuildingInput,
  CreateUnitInput,
  SiteStructure,
  CoproUnitWithDetails
} from '@/lib/types/copro';

// =====================================================
// SITES
// =====================================================

export async function getSites(): Promise<Site[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('is_active', true)
    .order('name');
  
  if (error) throw error;
  return (data as unknown as Site[]) || [];
}

export async function getSiteById(id: string): Promise<Site | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data as unknown as Site;
}

export async function createSite(input: CreateSiteInput): Promise<Site> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('sites')
    .insert({
      ...input,
      total_tantiemes_general: input.total_tantiemes_general || 10000,
      fiscal_year_start_month: input.fiscal_year_start_month || 1,
      syndic_type: input.syndic_type || 'professionnel',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as Site;
}

export async function updateSite(input: UpdateSiteInput): Promise<Site> {
  const supabase = createClient();
  
  const { id, ...updateData } = input;
  
  const { data, error } = await supabase
    .from('sites')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as Site;
}

export async function deleteSite(id: string): Promise<void> {
  const supabase = createClient();
  
  // Soft delete
  const { error } = await supabase
    .from('sites')
    .update({ is_active: false, archived_at: new Date().toISOString() })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// BUILDINGS
// =====================================================

export async function getBuildingsBySite(siteId: string): Promise<Building[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('display_order');
  
  if (error) throw error;
  return (data as unknown as Building[]) || [];
}

export async function createBuilding(input: CreateBuildingInput): Promise<Building> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('buildings')
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as Building;
}

export async function createBuildingsWithFloors(
  siteId: string,
  buildings: Array<{
    name: string;
    building_type: string;
    floors_count: number;
    has_basement?: boolean;
    basement_levels?: number;
    has_elevator?: boolean;
    units_per_floor?: number;
  }>
): Promise<{ buildings: Building[]; floors: Floor[] }> {
  const supabase = createClient();
  const createdBuildings: Building[] = [];
  const createdFloors: Floor[] = [];
  
  for (let i = 0; i < buildings.length; i++) {
    const buildingInput = buildings[i];
    
    // Créer le bâtiment
    const { data: building, error: buildingError } = await supabase
      .from('buildings')
      .insert({
        site_id: siteId,
        name: buildingInput.name,
        building_type: buildingInput.building_type,
        floors_count: buildingInput.floors_count,
        has_basement: buildingInput.has_basement || false,
        basement_levels: buildingInput.basement_levels || 0,
        has_elevator: buildingInput.has_elevator || false,
        display_order: i,
      })
      .select()
      .single();
    
    if (buildingError) throw buildingError;
    const typedBuilding = building as unknown as Building;
    createdBuildings.push(typedBuilding);

    // Créer les étages (sous-sol + RDC + étages)
    const floorsToCreate: Partial<Floor>[] = [];

    // Sous-sols
    for (let level = -(buildingInput.basement_levels || 0); level < 0; level++) {
      floorsToCreate.push({
        building_id: typedBuilding.id,
        level,
        name: `Sous-sol ${Math.abs(level)}`,
        display_order: level + 100,
      });
    }

    // RDC et étages
    for (let level = 0; level <= buildingInput.floors_count; level++) {
      floorsToCreate.push({
        building_id: typedBuilding.id,
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
      createdFloors.push(...((floors as unknown as Floor[]) || []));
    }
  }
  
  return { buildings: createdBuildings, floors: createdFloors };
}

export async function updateBuilding(
  id: string, 
  data: Partial<CreateBuildingInput>
): Promise<Building> {
  const supabase = createClient();
  
  const { data: building, error } = await supabase
    .from('buildings')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return building as unknown as Building;
}

export async function deleteBuilding(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('buildings')
    .update({ is_active: false })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// FLOORS
// =====================================================

export async function getFloorsByBuilding(buildingId: string): Promise<Floor[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('floors')
    .select('*')
    .eq('building_id', buildingId)
    .order('level');
  
  if (error) throw error;
  return (data as unknown as Floor[]) || [];
}

// =====================================================
// UNITS
// =====================================================

export async function getUnitsBySite(siteId: string): Promise<CoproUnit[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_units')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('lot_number');
  
  if (error) throw error;
  return (data as unknown as CoproUnit[]) || [];
}

export async function getUnitsWithDetailsBySite(
  siteId: string
): Promise<CoproUnitWithDetails[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_copro_units_with_tantiemes')
    .select('*')
    .eq('site_id', siteId)
    .order('lot_number');
  
  if (error) throw error;
  return (data as unknown as CoproUnitWithDetails[]) || [];
}

export async function createUnit(input: CreateUnitInput): Promise<CoproUnit> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_units')
    .insert(input as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as CoproUnit;
}

export async function createUnitsBatch(
  units: CreateUnitInput[]
): Promise<CoproUnit[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_units')
    .insert(units as any)
    .select();

  if (error) throw error;
  return (data as unknown as CoproUnit[]) || [];
}

export async function updateUnit(
  id: string, 
  data: Partial<CreateUnitInput>
): Promise<CoproUnit> {
  const supabase = createClient();
  
  const { data: unit, error } = await supabase
    .from('copro_units')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return unit as unknown as CoproUnit;
}

export async function updateUnitsTantiemes(
  updates: Array<{ id: string; tantieme_general: number }>
): Promise<void> {
  const supabase = createClient();
  
  // Mettre à jour chaque lot
  for (const update of updates) {
    const { error } = await supabase
      .from('copro_units')
      .update({ tantieme_general: update.tantieme_general })
      .eq('id', update.id);
    
    if (error) throw error;
  }
}

export async function deleteUnit(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('copro_units')
    .update({ is_active: false })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// STRUCTURE COMPLÈTE
// =====================================================

export async function getSiteStructure(siteId: string): Promise<SiteStructure[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_site_structure')
    .select('*')
    .eq('site_id', siteId);
  
  if (error) throw error;
  return (data as unknown as SiteStructure[]) || [];
}

// =====================================================
// VALIDATION TANTIÈMES
// =====================================================

export interface TantiemesValidation {
  is_valid: boolean;
  expected_total: number;
  actual_total: number;
  difference: number;
  message: string;
}

export async function validateSiteTantiemes(
  siteId: string
): Promise<TantiemesValidation> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('validate_site_tantiemes', { p_site_id: siteId });
  
  if (error) throw error;

  const rows = data as unknown as TantiemesValidation[];
  if (rows && rows.length > 0) {
    return rows[0];
  }

  throw new Error('Validation des tantièmes impossible');
}

// =====================================================
// STATISTIQUES
// =====================================================

export interface SiteStats {
  buildings_count: number;
  units_count: number;
  total_tantiemes: number;
  owners_count: number;
  occupied_units: number;
  rented_units: number;
  vacant_units: number;
}

export async function getSiteStats(siteId: string): Promise<SiteStats> {
  const supabase = createClient();
  
  // Compter les bâtiments
  const { count: buildingsCount } = await supabase
    .from('buildings')
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('is_active', true);
  
  // Récupérer les lots et calculer les stats
  const { data: unitsData } = await supabase
    .from('copro_units')
    .select('tantieme_general, occupation_mode')
    .eq('site_id', siteId)
    .eq('is_active', true);
  const units = unitsData as unknown as Pick<CoproUnit, 'tantieme_general' | 'occupation_mode'>[] | null;

  // Compter les propriétaires distincts
  const { data: ownershipsData } = await supabase
    .from('ownerships')
    .select('profile_id, unit_id!inner(site_id)')
    .eq('unit_id.site_id', siteId)
    .eq('is_current', true);
  const ownerships = ownershipsData as unknown as Array<{ profile_id: string }> | null;

  const uniqueOwners = new Set(ownerships?.map(o => o.profile_id));
  
  const stats: SiteStats = {
    buildings_count: buildingsCount || 0,
    units_count: units?.length || 0,
    total_tantiemes: units?.reduce((sum, u) => sum + (u.tantieme_general || 0), 0) || 0,
    owners_count: uniqueOwners.size,
    occupied_units: units?.filter(u => u.occupation_mode === 'owner_occupied').length || 0,
    rented_units: units?.filter(u => u.occupation_mode === 'rented').length || 0,
    vacant_units: units?.filter(u => u.occupation_mode === 'vacant').length || 0,
  };
  
  return stats;
}

// =====================================================
// GÉNÉRATION DE LOTS
// =====================================================

export interface GenerateUnitsOptions {
  siteId: string;
  buildingId: string;
  floorId: string;
  unitType: string;
  startingLotNumber: number;
  count: number;
  surfaceCarrez?: number;
  tantiemeGeneral?: number;
}

export async function generateUnits(
  options: GenerateUnitsOptions
): Promise<CoproUnit[]> {
  const units: CreateUnitInput[] = [];
  
  for (let i = 0; i < options.count; i++) {
    const lotNumber = (options.startingLotNumber + i).toString().padStart(3, '0');
    
    units.push({
      site_id: options.siteId,
      building_id: options.buildingId,
      floor_id: options.floorId,
      lot_number: lotNumber,
      unit_type: options.unitType as any,
      surface_carrez: options.surfaceCarrez,
      tantieme_general: options.tantiemeGeneral || 0,
    });
  }
  
  return createUnitsBatch(units);
}

// Export du service
export const sitesService = {
  // Sites
  getSites,
  getSiteById,
  createSite,
  updateSite,
  deleteSite,
  
  // Buildings
  getBuildingsBySite,
  createBuilding,
  createBuildingsWithFloors,
  updateBuilding,
  deleteBuilding,
  
  // Floors
  getFloorsByBuilding,
  
  // Units
  getUnitsBySite,
  getUnitsWithDetailsBySite,
  createUnit,
  createUnitsBatch,
  updateUnit,
  updateUnitsTantiemes,
  deleteUnit,
  
  // Structure
  getSiteStructure,
  
  // Validation
  validateSiteTantiemes,
  
  // Stats
  getSiteStats,
  
  // Génération
  generateUnits,
};

export default sitesService;

