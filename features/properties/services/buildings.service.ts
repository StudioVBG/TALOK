/**
 * Buildings Service - SOTA 2026
 * 
 * Service client pour la gestion des immeubles et leurs lots
 */

import { apiClient } from "@/lib/api-client";
import type { Building, BuildingUnit, CreateBuildingPayload, BulkCreateUnitsPayload } from "@/lib/types/building-v3";

export interface BuildingWithStats extends Building {
  stats?: {
    total_units: number;
    total_parkings: number;
    total_caves: number;
    surface_totale: number;
    occupancy_rate: number;
    revenus_potentiels: number;
    revenus_actuels?: number;
    occupied_units?: number;
    vacant_units?: number;
  };
  unitsByFloor?: Record<number, BuildingUnit[]>;
}

export class BuildingsService {
  
  /**
   * Liste tous les immeubles du propriétaire connecté
   */
  async getBuildings(): Promise<BuildingWithStats[]> {
    const response = await apiClient.get<{ buildings: BuildingWithStats[] }>("/buildings");
    return response.buildings || [];
  }

  /**
   * Récupère un immeuble par son ID avec ses lots et stats
   */
  async getBuildingById(id: string): Promise<BuildingWithStats> {
    const response = await apiClient.get<{ building: BuildingWithStats }>(`/buildings/${id}`);
    return response.building;
  }

  /**
   * Crée un nouvel immeuble avec optionnellement ses lots
   */
  async createBuilding(data: CreateBuildingPayload & { units?: Partial<BuildingUnit>[] }): Promise<{
    building: Building;
    buildingId: string;
  }> {
    const response = await apiClient.post<{ building: Building; buildingId: string }>("/buildings", data);
    return response;
  }

  /**
   * Met à jour un immeuble existant
   */
  async updateBuilding(id: string, data: Partial<CreateBuildingPayload>): Promise<Building> {
    const response = await apiClient.patch<{ building: Building }>(`/buildings/${id}`, data);
    return response.building;
  }

  /**
   * Supprime un immeuble (et ses lots en cascade)
   */
  async deleteBuilding(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/buildings/${id}`);
  }

  // === GESTION DES LOTS ===

  /**
   * Liste les lots d'un immeuble
   */
  async getUnits(buildingId: string): Promise<BuildingUnit[]> {
    const response = await apiClient.get<{ units: BuildingUnit[] }>(`/buildings/${buildingId}/units`);
    return response.units || [];
  }

  /**
   * Ajoute un ou plusieurs lots à un immeuble
   */
  async addUnits(buildingId: string, units: Partial<BuildingUnit>[]): Promise<BuildingUnit[]> {
    const response = await apiClient.post<{ units: BuildingUnit[] }>(`/buildings/${buildingId}/units`, { units });
    return response.units || [];
  }

  /**
   * Remplace tous les lots d'un immeuble (bulk)
   */
  async replaceAllUnits(buildingId: string, units: Partial<BuildingUnit>[]): Promise<BuildingUnit[]> {
    const response = await apiClient.put<{ units: BuildingUnit[] }>(`/buildings/${buildingId}/units`, { units });
    return response.units || [];
  }

  /**
   * Met à jour un lot spécifique
   */
  async updateUnit(buildingId: string, unitId: string, data: Partial<BuildingUnit>): Promise<BuildingUnit> {
    const response = await apiClient.patch<{ unit: BuildingUnit }>(`/buildings/${buildingId}/units/${unitId}`, data);
    return response.unit;
  }

  /**
   * Supprime un lot spécifique
   */
  async deleteUnit(buildingId: string, unitId: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/buildings/${buildingId}/units/${unitId}`);
  }

  // === HELPERS ===

  /**
   * Crée un immeuble depuis les données du wizard
   */
  async createFromWizardData(formData: Record<string, any>): Promise<{
    building: Building;
    buildingId: string;
  }> {
    // Mapper les données du wizard vers le format API
    const payload: CreateBuildingPayload & { units?: Partial<BuildingUnit>[] } = {
      name: formData.name || `Immeuble ${formData.adresse_complete || ""}`.trim(),
      adresse_complete: formData.adresse_complete || "",
      code_postal: formData.code_postal || "",
      ville: formData.ville || "",
      departement: formData.departement,
      floors: formData.building_floors || 4,
      construction_year: formData.construction_year,
      has_ascenseur: formData.has_ascenseur || false,
      has_gardien: formData.has_gardien || false,
      has_interphone: formData.has_interphone || false,
      has_digicode: formData.has_digicode || false,
      has_local_velo: formData.has_local_velo || false,
      has_local_poubelles: formData.has_local_poubelles || false,
    };
    
    // Ajouter les lots si présents
    if (formData.building_units && formData.building_units.length > 0) {
      payload.units = formData.building_units.map((unit: any) => ({
        floor: unit.floor,
        position: unit.position,
        type: unit.type,
        template: unit.template,
        surface: unit.surface,
        nb_pieces: unit.nb_pieces,
        loyer_hc: unit.loyer_hc || 0,
        charges: unit.charges || 0,
        depot_garantie: unit.depot_garantie || 0,
        status: unit.status || "vacant",
      }));
    }
    
    return this.createBuilding(payload);
  }
}

// Singleton export
export const buildingsService = new BuildingsService();

