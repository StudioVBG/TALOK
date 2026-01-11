/**
 * Service Fin de Bail + Rénovation
 * SOTA 2025 - Module premium différenciant
 */

import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";
import type {
  LeaseEndProcess,
  EDLInspectionItem,
  RenovationItem,
  RenovationQuote,
  LeaseEndTimelineItem,
  LeaseEndProcessStatus,
  InspectionCategory,
  InspectionStatus,
  DamageType,
  RenovationWorkType,
  CreateLeaseEndProcessDTO,
  StartEDLSortieDTO,
  SubmitInspectionItemDTO,
  CompareEDLDTO,
  EDLComparisonResult,
  EstimateRenovationDTO,
  RenovationEstimateResult,
  CalculateDGRetentionDTO,
  DGRetentionResult,
  GenerateTimelineDTO,
  TimelineResult,
  RequestQuotesDTO,
  UpdatePropertyStatusDTO,
  PropertyRentalStatus,
  LEASE_END_TRIGGER_DAYS,
} from "@/lib/types/end-of-lease";

export class EndOfLeaseService {
  private supabase = createClient();

  // ============================================
  // PROCESSUS DE FIN DE BAIL
  // ============================================

  /**
   * Récupérer tous les processus de fin de bail pour un propriétaire
   */
  async getProcesses(): Promise<LeaseEndProcess[]> {
    const response = await apiClient.get<{ processes: LeaseEndProcess[] }>("/end-of-lease");
    return response.processes;
  }

  /**
   * Récupérer un processus par ID
   */
  async getProcessById(id: string): Promise<LeaseEndProcess | null> {
    const response = await apiClient.get<{ process: LeaseEndProcess }>(`/end-of-lease/${id}`);
    return response.process;
  }

  /**
   * Créer un nouveau processus de fin de bail
   */
  async createProcess(data: CreateLeaseEndProcessDTO): Promise<LeaseEndProcess> {
    const response = await apiClient.post<{ process: LeaseEndProcess }>("/end-of-lease", data);
    return response.process;
  }

  /**
   * Mettre à jour le statut d'un processus
   */
  async updateProcessStatus(id: string, status: LeaseEndProcessStatus): Promise<LeaseEndProcess> {
    const response = await apiClient.patch<{ process: LeaseEndProcess }>(`/end-of-lease/${id}`, { status });
    return response.process;
  }

  /**
   * Annuler un processus
   */
  async cancelProcess(id: string): Promise<void> {
    await apiClient.delete(`/end-of-lease/${id}`);
  }

  // ============================================
  // EDL SORTIE
  // ============================================

  /**
   * Démarrer l'EDL de sortie
   */
  async startEDLSortie(data: StartEDLSortieDTO): Promise<LeaseEndProcess> {
    const response = await apiClient.post<{ process: LeaseEndProcess }>(
      `/end-of-lease/${data.lease_end_process_id}/edl-out`,
      { scheduled_date: data.scheduled_date }
    );
    return response.process;
  }

  /**
   * Récupérer les items d'inspection
   */
  async getInspectionItems(processId: string): Promise<EDLInspectionItem[]> {
    const { data, error } = await this.supabase
      .from("edl_inspection_items")
      .select("*")
      .eq("lease_end_process_id", processId)
      .order("category");

    if (error) throw error;
    return data || [];
  }

  /**
   * Soumettre un item d'inspection
   */
  async submitInspectionItem(data: SubmitInspectionItemDTO): Promise<EDLInspectionItem> {
    const response = await apiClient.post<{ item: EDLInspectionItem }>(
      `/end-of-lease/${data.lease_end_process_id}/inspection`,
      data
    );
    return response.item;
  }

  /**
   * Uploader une photo d'inspection
   */
  async uploadInspectionPhoto(processId: string, category: InspectionCategory, file: File): Promise<string> {
    const fileName = `edl-sortie/${processId}/${category}/${Date.now()}_${file.name}`;
    
    const { data, error } = await this.supabase.storage
      .from("documents")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) throw error;
    return data.path;
  }

  // ============================================
  // COMPARAISON EDL ENTRÉE/SORTIE
  // ============================================

  /**
   * Comparer l'EDL d'entrée avec l'EDL de sortie
   */
  async compareEDL(data: CompareEDLDTO): Promise<EDLComparisonResult> {
    const response = await apiClient.post<{ comparison: EDLComparisonResult }>(
      `/end-of-lease/${data.lease_end_process_id}/compare`,
      { edl_entree_id: data.edl_entree_id }
    );
    return response.comparison;
  }

  /**
   * Catégoriser automatiquement les dommages avec IA
   */
  async categorizeDamagesWithAI(processId: string): Promise<EDLInspectionItem[]> {
    const response = await apiClient.post<{ items: EDLInspectionItem[] }>(
      `/end-of-lease/${processId}/categorize-damages`
    );
    return response.items;
  }

  // ============================================
  // ESTIMATION DES COÛTS
  // ============================================

  /**
   * Estimer les coûts de rénovation
   */
  async estimateRenovationCosts(data: EstimateRenovationDTO): Promise<RenovationEstimateResult> {
    const response = await apiClient.post<{ estimate: RenovationEstimateResult }>(
      `/end-of-lease/${data.lease_end_process_id}/renovation/estimate`,
      data
    );
    return response.estimate;
  }

  /**
   * Calculer la retenue sur dépôt de garantie
   */
  async calculateDGRetention(data: CalculateDGRetentionDTO): Promise<DGRetentionResult> {
    const response = await apiClient.post<{ result: DGRetentionResult }>(
      `/end-of-lease/${data.lease_end_process_id}/dg/retention`,
      data
    );
    return response.result;
  }

  /**
   * Récupérer la grille de vétusté
   */
  async getVetustyGrid(): Promise<Array<{
    category: string;
    item: string;
    lifespan_years: number;
    yearly_depreciation: number;
    min_residual_value: number;
  }>> {
    const { data, error } = await this.supabase
      .from("vetusty_grid")
      .select("*")
      .eq("is_active", true)
      .order("category");

    if (error) throw error;
    return data || [];
  }

  /**
   * Récupérer le barème des coûts de réparation
   */
  async getRepairCostGrid(): Promise<Array<{
    work_type: string;
    description: string;
    unit: string;
    cost_min: number;
    cost_max: number;
    cost_avg: number;
  }>> {
    const { data, error } = await this.supabase
      .from("repair_cost_grid")
      .select("*")
      .eq("is_active", true)
      .order("work_type");

    if (error) throw error;
    return data || [];
  }

  // ============================================
  // TRAVAUX DE RÉNOVATION
  // ============================================

  /**
   * Récupérer les travaux de rénovation
   */
  async getRenovationItems(processId: string): Promise<RenovationItem[]> {
    const { data, error } = await this.supabase
      .from("renovation_items")
      .select(`
        *,
        quotes:renovation_quotes(*)
      `)
      .eq("lease_end_process_id", processId)
      .order("priority", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Ajouter un travail de rénovation
   */
  async addRenovationItem(processId: string, item: Partial<RenovationItem>): Promise<RenovationItem> {
    const { data, error } = await this.supabase
      .from("renovation_items")
      .insert({
        lease_end_process_id: processId,
        ...item,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mettre à jour un travail de rénovation
   */
  async updateRenovationItem(itemId: string, updates: Partial<RenovationItem>): Promise<RenovationItem> {
    const { data, error } = await this.supabase
      .from("renovation_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ============================================
  // DEVIS
  // ============================================

  /**
   * Demander des devis à des prestataires
   */
  async requestQuotes(data: RequestQuotesDTO): Promise<RenovationQuote[]> {
    const response = await apiClient.post<{ quotes: RenovationQuote[] }>(
      `/end-of-lease/renovation/devis`,
      data
    );
    return response.quotes;
  }

  /**
   * Récupérer les devis pour un item de rénovation
   */
  async getQuotes(renovationItemId: string): Promise<RenovationQuote[]> {
    const { data, error } = await this.supabase
      .from("renovation_quotes")
      .select("*")
      .eq("renovation_item_id", renovationItemId)
      .order("total_amount");

    if (error) throw error;
    return data || [];
  }

  /**
   * Accepter un devis
   */
  async acceptQuote(quoteId: string): Promise<RenovationQuote> {
    const { data, error } = await this.supabase
      .from("renovation_quotes")
      .update({ status: "accepted" })
      .eq("id", quoteId)
      .select()
      .single();

    if (error) throw error;

    // Rejeter les autres devis pour cet item
    const { data: quote } = await this.supabase
      .from("renovation_quotes")
      .select("renovation_item_id")
      .eq("id", quoteId)
      .single();

    if (quote) {
      await this.supabase
        .from("renovation_quotes")
        .update({ status: "rejected" })
        .eq("renovation_item_id", quote.renovation_item_id)
        .neq("id", quoteId)
        .eq("status", "pending");
    }

    return data;
  }

  // ============================================
  // TIMELINE / PLAN D'ACTION
  // ============================================

  /**
   * Générer une timeline automatique
   */
  async generateTimeline(data: GenerateTimelineDTO): Promise<TimelineResult> {
    const response = await apiClient.post<{ timeline: TimelineResult }>(
      `/end-of-lease/${data.lease_end_process_id}/renovation/timeline`,
      data
    );
    return response.timeline;
  }

  /**
   * Récupérer la timeline
   */
  async getTimeline(processId: string): Promise<LeaseEndTimelineItem[]> {
    const { data, error } = await this.supabase
      .from("lease_end_timeline")
      .select("*")
      .eq("lease_end_process_id", processId)
      .order("day_offset");

    if (error) throw error;
    return data || [];
  }

  /**
   * Mettre à jour une action de la timeline
   */
  async updateTimelineItem(
    itemId: string,
    updates: Partial<LeaseEndTimelineItem>
  ): Promise<LeaseEndTimelineItem> {
    const { data, error } = await this.supabase
      .from("lease_end_timeline")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Marquer une action comme terminée
   */
  async completeTimelineAction(itemId: string): Promise<LeaseEndTimelineItem> {
    return this.updateTimelineItem(itemId, {
      status: "completed",
      completed_date: new Date().toISOString().split("T")[0],
    });
  }

  // ============================================
  // STATUT DU LOGEMENT
  // ============================================

  /**
   * Mettre à jour le statut locatif d'un logement
   */
  async updatePropertyStatus(data: UpdatePropertyStatusDTO): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/properties/${data.property_id}/status`,
      { rental_status: data.rental_status }
    );
  }

  // ============================================
  // AUTOMATISATIONS
  // ============================================

  /**
   * Vérifier et déclencher les processus de fin de bail
   */
  async triggerPendingProcesses(): Promise<number> {
    const response = await apiClient.post<{ triggered_count: number }>("/end-of-lease/trigger");
    return response.triggered_count;
  }

  /**
   * Calculer les montants totaux pour un processus
   */
  async calculateTotals(processId: string): Promise<{
    tenant_damage_cost: number;
    vetusty_cost: number;
    renovation_cost: number;
    dg_retention_amount: number;
    dg_refund_amount: number;
    total_budget: number;
  }> {
    const [inspectionItems, renovationItems, process] = await Promise.all([
      this.getInspectionItems(processId),
      this.getRenovationItems(processId),
      this.getProcessById(processId),
    ]);

    if (!process) throw new Error("Processus non trouvé");

    // Calculer les coûts par catégorie
    let tenantDamageCost = 0;
    let vetustyCost = 0;
    let renovationCost = 0;

    for (const item of inspectionItems) {
      if (item.damage_type === "tenant_damage") {
        tenantDamageCost += item.estimated_cost;
      } else if (item.damage_type === "normal_wear") {
        vetustyCost += item.estimated_cost;
      }
    }

    for (const item of renovationItems) {
      if (item.payer === "tenant") {
        tenantDamageCost += item.tenant_share;
      } else if (item.payer === "owner") {
        vetustyCost += item.owner_share;
      }
      renovationCost += item.estimated_cost;
    }

    // Calculer la retenue DG
    // ✅ FIX: Null check sur dg_amount pour éviter NaN
    const dgAmount = process.dg_amount ?? 0;
    const dgRetentionAmount = Math.min(tenantDamageCost, dgAmount);
    const dgRefundAmount = dgAmount - dgRetentionAmount;

    // Budget total = vétusté + rénovation conseillée (hors dommages locataire)
    const totalBudget = vetustyCost + renovationCost - tenantDamageCost;

    // Mettre à jour le processus
    await this.supabase
      .from("lease_end_processes")
      .update({
        tenant_damage_cost: tenantDamageCost,
        vetusty_cost: vetustyCost,
        renovation_cost: renovationCost,
        dg_retention_amount: dgRetentionAmount,
        dg_refund_amount: dgRefundAmount,
        total_budget: Math.max(0, totalBudget),
      })
      .eq("id", processId);

    return {
      tenant_damage_cost: tenantDamageCost,
      vetusty_cost: vetustyCost,
      renovation_cost: renovationCost,
      dg_retention_amount: dgRetentionAmount,
      dg_refund_amount: dgRefundAmount,
      total_budget: Math.max(0, totalBudget),
    };
  }

  /**
   * Marquer le logement comme prêt à louer
   */
  async markReadyToRent(processId: string): Promise<LeaseEndProcess> {
    const process = await this.getProcessById(processId);
    if (!process) throw new Error("Processus non trouvé");

    // Mettre à jour le processus
    const response = await apiClient.patch<{ process: LeaseEndProcess }>(
      `/end-of-lease/${processId}`,
      {
        status: "ready_to_rent",
        ready_to_rent_date: new Date().toISOString().split("T")[0],
        progress_percentage: 90,
      }
    );

    // Mettre à jour le statut du logement
    await this.updatePropertyStatus({
      property_id: process.property_id,
      rental_status: "ready_to_rent",
    });

    return response.process;
  }

  /**
   * Compléter le processus
   */
  async completeProcess(processId: string): Promise<LeaseEndProcess> {
    const process = await this.getProcessById(processId);
    if (!process) throw new Error("Processus non trouvé");

    const response = await apiClient.patch<{ process: LeaseEndProcess }>(
      `/end-of-lease/${processId}`,
      {
        status: "completed",
        progress_percentage: 100,
      }
    );

    return response.process;
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Calculer la date de déclenchement pour un bail
   */
  getTrigggerDate(leaseEndDate: string, leaseType: string): Date {
    const endDate = new Date(leaseEndDate);
    const triggerDays = LEASE_END_TRIGGER_DAYS[leaseType] || 30;
    endDate.setDate(endDate.getDate() - triggerDays);
    return endDate;
  }

  /**
   * Vérifier si un bail doit déclencher un processus
   */
  shouldTriggerProcess(leaseEndDate: string, leaseType: string): boolean {
    const triggerDate = this.getTrigggerDate(leaseEndDate, leaseType);
    return triggerDate <= new Date();
  }

  /**
   * Calculer le pourcentage de progression
   */
  calculateProgress(status: LeaseEndProcessStatus): number {
    const progressMap: Record<LeaseEndProcessStatus, number> = {
      pending: 0,
      triggered: 10,
      edl_scheduled: 15,
      edl_in_progress: 25,
      edl_completed: 35,
      damages_assessed: 45,
      dg_calculated: 55,
      renovation_planned: 65,
      renovation_in_progress: 75,
      ready_to_rent: 90,
      completed: 100,
      cancelled: 0,
    };
    return progressMap[status] || 0;
  }
}

export const endOfLeaseService = new EndOfLeaseService();

