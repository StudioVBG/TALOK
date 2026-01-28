/**
 * Service pour la gestion des calculs de vétusté
 * Intégration avec le système de fin de bail et retenues DG
 */

import { apiClient } from "@/lib/api-client";
import {
  VetustyCalculationInput,
  VetustyCalculationResult,
  VetustyCategory,
} from "@/lib/constants/vetusty-grid";
import {
  calculateVetusty,
  calculateBatchVetusty,
  generateVetustyReport,
  VetustyReport,
  VetustySummary,
  suggestVetustyItemsForRoom,
} from "@/lib/services/vetusty-calculator";

// ============================================
// TYPES
// ============================================

export interface VetustyReportDB {
  id: string;
  lease_id: string;
  edl_entry_id: string | null;
  edl_exit_id: string | null;
  settlement_id: string | null;
  edl_entry_date: string;
  edl_exit_date: string;
  lease_duration_years: number;
  total_items: number;
  total_repair_cost: number;
  total_owner_share: number;
  total_tenant_share: number;
  average_vetusty_rate: number;
  status: "draft" | "validated" | "contested" | "final";
  validated_at: string | null;
  validated_by: string | null;
  contested_at: string | null;
  contest_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface VetustyItemDB {
  id: string;
  report_id: string;
  vetusty_grid_item_id: string;
  item_name: string;
  category: string;
  age_years: number;
  lifespan_years: number;
  franchise_years: number;
  vetusty_rate: number;
  repair_cost: number;
  owner_share: number;
  tenant_share: number;
  edl_entry_item_id: string | null;
  edl_exit_item_id: string | null;
  room_name: string | null;
  is_degradation: boolean;
  notes: string | null;
  photo_urls: string[] | null;
  invoice_url: string | null;
  is_contested: boolean;
  contest_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface VetustyReportWithItems extends VetustyReportDB {
  items: VetustyItemDB[];
}

export interface CreateVetustyReportDTO {
  lease_id: string;
  edl_entry_id?: string;
  edl_exit_id?: string;
  edl_entry_date: string;
  edl_exit_date: string;
  notes?: string;
}

export interface AddVetustyItemDTO {
  vetusty_grid_item_id: string;
  age_years: number;
  repair_cost: number;
  room_name?: string;
  edl_entry_item_id?: string;
  edl_exit_item_id?: string;
  notes?: string;
  photo_urls?: string[];
  invoice_url?: string;
}

export interface UpdateVetustyItemDTO {
  age_years?: number;
  repair_cost?: number;
  notes?: string;
  photo_urls?: string[];
  invoice_url?: string;
  is_contested?: boolean;
  contest_reason?: string;
}

// ============================================
// SERVICE
// ============================================

export class VetustyService {
  // ============================================
  // RAPPORTS
  // ============================================

  /**
   * Récupérer le rapport de vétusté d'un bail
   */
  async getReportByLease(leaseId: string): Promise<VetustyReportWithItems | null> {
    try {
      const report = await apiClient.get<VetustyReportWithItems>(
        `/leases/${leaseId}/vetusty`
      );
      return report;
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Récupérer un rapport par ID
   */
  async getReport(reportId: string): Promise<VetustyReportWithItems | null> {
    try {
      const report = await apiClient.get<VetustyReportWithItems>(
        `/vetusty/reports/${reportId}`
      );
      return report;
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Créer un nouveau rapport de vétusté
   */
  async createReport(data: CreateVetustyReportDTO): Promise<VetustyReportDB> {
    const report = await apiClient.post<VetustyReportDB>(
      `/leases/${data.lease_id}/vetusty`,
      data
    );
    return report;
  }

  /**
   * Mettre à jour un rapport
   */
  async updateReport(
    reportId: string,
    data: Partial<Pick<VetustyReportDB, "notes" | "status">>
  ): Promise<VetustyReportDB> {
    const report = await apiClient.put<VetustyReportDB>(
      `/vetusty/reports/${reportId}`,
      data
    );
    return report;
  }

  /**
   * Supprimer un rapport (uniquement si brouillon)
   */
  async deleteReport(reportId: string): Promise<void> {
    await apiClient.delete(`/vetusty/reports/${reportId}`);
  }

  /**
   * Valider un rapport
   */
  async validateReport(reportId: string): Promise<VetustyReportDB> {
    return this.updateReport(reportId, { status: "validated" });
  }

  /**
   * Contester un rapport
   */
  async contestReport(reportId: string, reason: string): Promise<VetustyReportDB> {
    const report = await apiClient.post<VetustyReportDB>(
      `/vetusty/reports/${reportId}/contest`,
      { reason }
    );
    return report;
  }

  /**
   * Finaliser un rapport
   */
  async finalizeReport(reportId: string): Promise<VetustyReportDB> {
    return this.updateReport(reportId, { status: "final" });
  }

  // ============================================
  // ITEMS
  // ============================================

  /**
   * Ajouter un élément au rapport
   */
  async addItem(reportId: string, data: AddVetustyItemDTO): Promise<VetustyItemDB> {
    // Calculer la vétusté côté client pour validation
    const calculation = calculateVetusty({
      item_id: data.vetusty_grid_item_id,
      age_years: data.age_years,
      repair_cost: data.repair_cost,
    });

    // Envoyer avec les valeurs calculées
    const item = await apiClient.post<VetustyItemDB>(
      `/vetusty/reports/${reportId}/items`,
      {
        ...data,
        item_name: calculation.item_name,
        category: calculation.category,
        lifespan_years: calculation.lifespan_years,
        franchise_years: calculation.franchise_years,
        vetusty_rate: calculation.vetusty_rate,
        owner_share: calculation.owner_share,
        tenant_share: calculation.tenant_share,
        is_degradation: calculation.tenant_share > 0,
      }
    );
    return item;
  }

  /**
   * Mettre à jour un élément
   */
  async updateItem(
    reportId: string,
    itemId: string,
    data: UpdateVetustyItemDTO
  ): Promise<VetustyItemDB> {
    const item = await apiClient.put<VetustyItemDB>(
      `/vetusty/reports/${reportId}/items/${itemId}`,
      data
    );
    return item;
  }

  /**
   * Supprimer un élément
   */
  async deleteItem(reportId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/vetusty/reports/${reportId}/items/${itemId}`);
  }

  /**
   * Contester un élément spécifique
   */
  async contestItem(
    reportId: string,
    itemId: string,
    reason: string
  ): Promise<VetustyItemDB> {
    return this.updateItem(reportId, itemId, {
      is_contested: true,
      contest_reason: reason,
    });
  }

  // ============================================
  // CALCULS (Local - pas d'API)
  // ============================================

  /**
   * Calculer la vétusté pour un élément (local)
   */
  calculateItem(input: VetustyCalculationInput): VetustyCalculationResult {
    return calculateVetusty(input);
  }

  /**
   * Calculer la vétusté pour plusieurs éléments (local)
   */
  calculateBatch(inputs: VetustyCalculationInput[]): VetustyCalculationResult[] {
    return calculateBatchVetusty(inputs);
  }

  /**
   * Générer un rapport complet (local, pour prévisualisation)
   */
  generateLocalReport(
    items: VetustyCalculationInput[],
    leaseStartDate: string,
    leaseEndDate: string
  ): VetustyReport {
    return generateVetustyReport({
      items,
      lease_start_date: leaseStartDate,
      lease_end_date: leaseEndDate,
    });
  }

  /**
   * Suggérer des éléments pour une pièce
   */
  getSuggestionsForRoom(roomType: string) {
    return suggestVetustyItemsForRoom(roomType);
  }

  // ============================================
  // INTÉGRATION DG
  // ============================================

  /**
   * Appliquer le rapport de vétusté au solde de tout compte
   */
  async applyToSettlement(
    reportId: string,
    settlementId: string
  ): Promise<{ success: boolean; tenant_share_added: number }> {
    const result = await apiClient.post<{ success: boolean; tenant_share_added: number }>(
      `/vetusty/reports/${reportId}/apply-to-settlement`,
      { settlement_id: settlementId }
    );
    return result;
  }

  /**
   * Récupérer le rapport lié à un settlement
   */
  async getReportBySettlement(settlementId: string): Promise<VetustyReportWithItems | null> {
    try {
      const report = await apiClient.get<VetustyReportWithItems>(
        `/end-of-lease/settlements/${settlementId}/vetusty`
      );
      return report;
    } catch (error: any) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  // ============================================
  // DOCUMENTS
  // ============================================

  /**
   * Générer le PDF du rapport de vétusté
   */
  async generatePDF(reportId: string): Promise<Blob> {
    const response = await fetch(`/api/vetusty/reports/${reportId}/pdf`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Erreur lors de la génération du PDF");
    }

    return response.blob();
  }

  /**
   * Télécharger le rapport en PDF
   */
  async downloadPDF(reportId: string, filename?: string): Promise<void> {
    const blob = await this.generatePDF(reportId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `rapport-vetuste-${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Singleton export
export const vetustyService = new VetustyService();

// Export des types et fonctions utilitaires
export {
  calculateVetusty,
  calculateBatchVetusty,
  generateVetustyReport,
  suggestVetustyItemsForRoom,
  formatCurrency,
  formatPercentage,
  estimateAge,
  estimateAgeFromLease,
} from "@/lib/services/vetusty-calculator";

export {
  VETUSTY_GRID,
  getVetustyItem,
  getVetustyItemsByCategory,
  getVetustyCategories,
  VETUSTY_CATEGORY_LABELS,
  VETUSTY_CATEGORY_ICONS,
} from "@/lib/constants/vetusty-grid";
