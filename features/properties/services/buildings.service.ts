/**
 * Service layer for Buildings (Immeubles) CRUD operations
 * SOTA 2026 - Multi-unit building management
 */

import { apiClient } from "@/lib/api-client";
import type {
  Building,
  BuildingUnit,
  BuildingStats,
  CreateBuildingPayload,
  CreateBuildingUnitPayload,
  BulkCreateUnitsPayload,
} from "@/lib/types/building-v3";

export interface UpdateBuildingPayload extends Partial<CreateBuildingPayload> {}

export interface UpdateBuildingUnitPayload extends Partial<Omit<CreateBuildingUnitPayload, 'building_id'>> {
  status?: BuildingUnit['status'];
  current_lease_id?: string | null;
}

export interface DuplicateUnitsPayload {
  source_unit_id: string;
  target_floors: number[];
}

export class BuildingsService {
  // ============================================
  // BUILDINGS CRUD
  // ============================================

  /**
   * Get all buildings for the current owner
   */
  async getBuildings(): Promise<Building[]> {
    const response = await apiClient.get<{ buildings: Building[] }>("/buildings");
    return response.buildings;
  }

  /**
   * Get a single building by ID with its units
   */
  async getBuildingById(id: string): Promise<Building> {
    const response = await apiClient.get<{ building: Building }>(`/buildings/${id}`);
    return response.building;
  }

  /**
   * Get building with full statistics
   */
  async getBuildingStats(id: string): Promise<BuildingStats> {
    const response = await apiClient.get<{ stats: BuildingStats }>(`/buildings/${id}/stats`);
    return response.stats;
  }

  /**
   * Create a new building
   */
  async createBuilding(payload: CreateBuildingPayload): Promise<Building> {
    const response = await apiClient.post<{ building: Building }>("/buildings", payload);
    return response.building;
  }

  /**
   * Update building information
   */
  async updateBuilding(id: string, payload: UpdateBuildingPayload): Promise<Building> {
    const response = await apiClient.patch<{ building: Building }>(`/buildings/${id}`, payload);
    return response.building;
  }

  /**
   * Delete a building (soft delete)
   */
  async deleteBuilding(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/buildings/${id}`);
  }

  // ============================================
  // BUILDING UNITS CRUD
  // ============================================

  /**
   * Get all units for a building
   */
  async getUnits(buildingId: string): Promise<BuildingUnit[]> {
    const response = await apiClient.get<{ units: BuildingUnit[] }>(`/buildings/${buildingId}/units`);
    return response.units;
  }

  /**
   * Get a single unit by ID
   */
  async getUnitById(buildingId: string, unitId: string): Promise<BuildingUnit> {
    const response = await apiClient.get<{ unit: BuildingUnit }>(`/buildings/${buildingId}/units/${unitId}`);
    return response.unit;
  }

  /**
   * Create a new unit in a building
   */
  async createUnit(buildingId: string, payload: Omit<CreateBuildingUnitPayload, 'building_id'>): Promise<BuildingUnit> {
    const response = await apiClient.post<{ unit: BuildingUnit }>(`/buildings/${buildingId}/units`, payload);
    return response.unit;
  }

  /**
   * Bulk create multiple units
   */
  async bulkCreateUnits(payload: BulkCreateUnitsPayload): Promise<BuildingUnit[]> {
    const response = await apiClient.post<{ units: BuildingUnit[] }>(
      `/buildings/${payload.building_id}/units/bulk`,
      { units: payload.units }
    );
    return response.units;
  }

  /**
   * Update a unit
   */
  async updateUnit(buildingId: string, unitId: string, payload: UpdateBuildingUnitPayload): Promise<BuildingUnit> {
    const response = await apiClient.patch<{ unit: BuildingUnit }>(
      `/buildings/${buildingId}/units/${unitId}`,
      payload
    );
    return response.unit;
  }

  /**
   * Delete a unit
   */
  async deleteUnit(buildingId: string, unitId: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/buildings/${buildingId}/units/${unitId}`);
  }

  /**
   * Duplicate a unit to multiple floors
   */
  async duplicateUnitToFloors(
    buildingId: string,
    sourceUnitId: string,
    targetFloors: number[]
  ): Promise<BuildingUnit[]> {
    const response = await apiClient.post<{ units: BuildingUnit[] }>(
      `/buildings/${buildingId}/units/${sourceUnitId}/duplicate`,
      { targetFloors }
    );
    return response.units;
  }

  /**
   * Link a unit to an existing lease
   */
  async linkUnitToLease(buildingId: string, unitId: string, leaseId: string): Promise<BuildingUnit> {
    const response = await apiClient.patch<{ unit: BuildingUnit }>(
      `/buildings/${buildingId}/units/${unitId}`,
      { current_lease_id: leaseId, status: 'occupe' }
    );
    return response.unit;
  }

  /**
   * Unlink a unit from its lease (mark as vacant)
   */
  async unlinkUnitFromLease(buildingId: string, unitId: string): Promise<BuildingUnit> {
    const response = await apiClient.patch<{ unit: BuildingUnit }>(
      `/buildings/${buildingId}/units/${unitId}`,
      { current_lease_id: null, status: 'vacant' }
    );
    return response.unit;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Calculate totals for a building from its units
   */
  calculateBuildingTotals(units: BuildingUnit[]): {
    totalUnits: number;
    totalParkings: number;
    totalCaves: number;
    totalSurface: number;
    potentialRevenue: number;
    occupancyRate: number;
  } {
    const totalUnits = units.filter(u => u.type === 'appartement' || u.type === 'studio' || u.type === 'bureau' || u.type === 'local_commercial').length;
    const totalParkings = units.filter(u => u.type === 'parking').length;
    const totalCaves = units.filter(u => u.type === 'cave').length;
    const totalSurface = units.reduce((acc, u) => acc + (u.surface || 0), 0);
    const potentialRevenue = units.reduce((acc, u) => acc + (u.loyer_hc || 0) + (u.charges || 0), 0);
    const occupiedUnits = units.filter(u => u.status === 'occupe').length;
    const occupancyRate = units.length > 0 ? (occupiedUnits / units.length) * 100 : 0;

    return {
      totalUnits,
      totalParkings,
      totalCaves,
      totalSurface,
      potentialRevenue,
      occupancyRate,
    };
  }

  /**
   * Group units by floor for display
   */
  groupUnitsByFloor(units: BuildingUnit[]): Map<number, BuildingUnit[]> {
    const grouped = new Map<number, BuildingUnit[]>();

    for (const unit of units) {
      const floor = unit.floor;
      if (!grouped.has(floor)) {
        grouped.set(floor, []);
      }
      grouped.get(floor)!.push(unit);
    }

    // Sort units within each floor by position
    for (const [floor, floorUnits] of grouped) {
      grouped.set(floor, floorUnits.sort((a, b) => a.position.localeCompare(b.position)));
    }

    return grouped;
  }

  /**
   * Get floor label in French
   */
  getFloorLabel(floor: number): string {
    if (floor === 0) return "RDC";
    if (floor === 1) return "1er étage";
    return `${floor}ème étage`;
  }
}

export const buildingsService = new BuildingsService();
