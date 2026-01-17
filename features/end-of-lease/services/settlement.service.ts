/**
 * Service pour la gestion de la fin de bail
 * Préavis, Solde de tout compte, Retenues DG
 */

import { apiClient } from "@/lib/api-client";
import type {
  DepartureNotice,
  DepartureNoticeWithDetails,
  DGSettlement,
  SettlementWithDetails,
  SettlementCalculation,
  CreateDepartureNoticeDTO,
  UpdateDepartureNoticeDTO,
  ContestDepartureDTO,
  CreateSettlementDTO,
  UpdateSettlementDTO,
  AddDeductionDTO,
  SettlementDeductionItem,
} from "@/lib/types/end-of-lease";

export class EndOfLeaseService {
  // ============================================
  // PRÉAVIS
  // ============================================

  /**
   * Récupérer tous les préavis (propriétaire)
   */
  async getDepartureNotices(): Promise<DepartureNoticeWithDetails[]> {
    const response = await apiClient.get<{ notices: DepartureNoticeWithDetails[] }>(
      "/end-of-lease/notices"
    );
    return response.notices;
  }

  /**
   * Récupérer un préavis par ID
   */
  async getDepartureNotice(noticeId: string): Promise<DepartureNoticeWithDetails | null> {
    try {
      const notice = await apiClient.get<DepartureNoticeWithDetails>(
        `/end-of-lease/notices/${noticeId}`
      );
      return notice;
    } catch (error: unknown) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Récupérer le préavis d'un bail
   */
  async getDepartureNoticeByLease(leaseId: string): Promise<DepartureNoticeWithDetails | null> {
    try {
      const notice = await apiClient.get<DepartureNoticeWithDetails>(
        `/leases/${leaseId}/notice`
      );
      return notice;
    } catch (error: unknown) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Créer un préavis de départ
   */
  async createDepartureNotice(data: CreateDepartureNoticeDTO): Promise<DepartureNotice> {
    const notice = await apiClient.post<DepartureNotice>(
      `/leases/${data.lease_id}/notice`,
      data
    );
    return notice;
  }

  /**
   * Mettre à jour un préavis
   */
  async updateDepartureNotice(
    noticeId: string,
    data: UpdateDepartureNoticeDTO
  ): Promise<DepartureNotice> {
    const notice = await apiClient.put<DepartureNotice>(
      `/end-of-lease/notices/${noticeId}`,
      data
    );
    return notice;
  }

  /**
   * Accepter un préavis
   */
  async acceptDepartureNotice(noticeId: string): Promise<DepartureNotice> {
    return this.updateDepartureNotice(noticeId, { status: "accepted" });
  }

  /**
   * Contester un préavis
   */
  async contestDepartureNotice(
    noticeId: string,
    data: ContestDepartureDTO
  ): Promise<DepartureNotice> {
    const notice = await apiClient.post<DepartureNotice>(
      `/end-of-lease/notices/${noticeId}/contest`,
      data
    );
    return notice;
  }

  /**
   * Retirer un préavis
   */
  async withdrawDepartureNotice(noticeId: string): Promise<void> {
    await apiClient.post(`/end-of-lease/notices/${noticeId}/withdraw`);
  }

  /**
   * Marquer un préavis comme terminé
   */
  async completeDepartureNotice(
    noticeId: string,
    actualDepartureDate: string
  ): Promise<DepartureNotice> {
    return this.updateDepartureNotice(noticeId, {
      status: "completed",
      actual_departure_date: actualDepartureDate,
    });
  }

  // ============================================
  // SOLDE DE TOUT COMPTE
  // ============================================

  /**
   * Récupérer tous les soldes (propriétaire)
   */
  async getSettlements(): Promise<SettlementWithDetails[]> {
    const response = await apiClient.get<{ settlements: SettlementWithDetails[] }>(
      "/end-of-lease/settlements"
    );
    return response.settlements;
  }

  /**
   * Récupérer un solde par ID
   */
  async getSettlement(settlementId: string): Promise<SettlementWithDetails | null> {
    try {
      const settlement = await apiClient.get<SettlementWithDetails>(
        `/end-of-lease/settlements/${settlementId}`
      );
      return settlement;
    } catch (error: unknown) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Récupérer le solde d'un bail
   */
  async getSettlementByLease(leaseId: string): Promise<SettlementWithDetails | null> {
    try {
      const settlement = await apiClient.get<SettlementWithDetails>(
        `/end-of-lease/${leaseId}/settlement`
      );
      return settlement;
    } catch (error: unknown) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  /**
   * Calculer le solde de tout compte (sans créer)
   */
  async calculateSettlement(leaseId: string): Promise<SettlementCalculation> {
    const calculation = await apiClient.get<SettlementCalculation>(
      `/end-of-lease/${leaseId}/calculate`
    );
    return calculation;
  }

  /**
   * Générer/créer le solde de tout compte
   */
  async generateSettlement(leaseId: string): Promise<DGSettlement> {
    const settlement = await apiClient.post<DGSettlement>(
      `/end-of-lease/${leaseId}/settlement`
    );
    return settlement;
  }

  /**
   * Mettre à jour un solde
   */
  async updateSettlement(
    settlementId: string,
    data: UpdateSettlementDTO
  ): Promise<DGSettlement> {
    const settlement = await apiClient.put<DGSettlement>(
      `/end-of-lease/settlements/${settlementId}`,
      data
    );
    return settlement;
  }

  /**
   * Ajouter une retenue
   */
  async addDeduction(
    settlementId: string,
    data: AddDeductionDTO
  ): Promise<SettlementDeductionItem> {
    const deduction = await apiClient.post<SettlementDeductionItem>(
      `/end-of-lease/settlements/${settlementId}/deductions`,
      data
    );
    return deduction;
  }

  /**
   * Supprimer une retenue
   */
  async removeDeduction(settlementId: string, deductionId: string): Promise<void> {
    await apiClient.delete(
      `/end-of-lease/settlements/${settlementId}/deductions/${deductionId}`
    );
  }

  /**
   * Envoyer le solde pour validation au locataire
   */
  async sendForValidation(settlementId: string): Promise<DGSettlement> {
    return this.updateSettlement(settlementId, { status: "pending_validation" });
  }

  /**
   * Valider le solde (locataire)
   */
  async validateSettlement(settlementId: string): Promise<DGSettlement> {
    const settlement = await apiClient.post<DGSettlement>(
      `/end-of-lease/settlements/${settlementId}/validate`
    );
    return settlement;
  }

  /**
   * Contester le solde (locataire)
   */
  async contestSettlement(
    settlementId: string,
    reason: string
  ): Promise<DGSettlement> {
    const settlement = await apiClient.post<DGSettlement>(
      `/end-of-lease/settlements/${settlementId}/contest`,
      { reason }
    );
    return settlement;
  }

  /**
   * Marquer comme payé/remboursé
   */
  async markAsPaid(
    settlementId: string,
    paymentData: {
      payment_date: string;
      payment_method: "virement" | "cheque" | "especes";
      payment_reference?: string;
    }
  ): Promise<DGSettlement> {
    const settlement = await apiClient.post<DGSettlement>(
      `/end-of-lease/settlements/${settlementId}/pay`,
      paymentData
    );
    return settlement;
  }

  // ============================================
  // COMPARAISON EDL
  // ============================================

  /**
   * Comparer les EDL entrée et sortie
   */
  async compareEDL(leaseId: string): Promise<{
    entry: any;
    exit: any;
    differences: Array<{
      room: string;
      item: string;
      entry_condition: string;
      exit_condition: string;
      has_degradation: boolean;
    }>;
    total_estimated_repairs: number;
  }> {
    const comparison = await apiClient.get(`/end-of-lease/${leaseId}/compare`);
    return comparison as any;
  }

  // ============================================
  // DOCUMENTS
  // ============================================

  /**
   * Générer le document de solde de tout compte (PDF)
   */
  async generateSettlementDocument(settlementId: string): Promise<Blob> {
    const response = await fetch(
      `/api/end-of-lease/settlements/${settlementId}/document`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Erreur lors de la génération du document");
    }

    return response.blob();
  }

  /**
   * Générer la lettre de préavis (PDF)
   */
  async generateNoticeDocument(noticeId: string): Promise<Blob> {
    const response = await fetch(
      `/api/end-of-lease/notices/${noticeId}/document`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error("Erreur lors de la génération du document");
    }

    return response.blob();
  }
}

export const endOfLeaseService = new EndOfLeaseService();







