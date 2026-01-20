import { createClient } from "@/lib/supabase/client";
import { workOrderSchema } from "@/lib/validations";
import type { WorkOrder, WorkOrderStatus } from "@/lib/types";

export interface CreateWorkOrderData {
  ticket_id: string;
  provider_id: string;
  date_intervention_prevue?: string | null;
  cout_estime?: number | null;
}

export interface UpdateWorkOrderData extends Partial<CreateWorkOrderData> {
  statut?: WorkOrderStatus;
  date_intervention_reelle?: string | null;
  cout_final?: number | null;
}

export class WorkOrdersService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getWorkOrders() {
    const { data, error } = await this.supabase
      .from("work_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as WorkOrder[];
  }

  async getWorkOrderById(id: string) {
    const { data, error } = await this.supabase
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as WorkOrder;
  }

  async getWorkOrdersByTicket(ticketId: string) {
    const { data, error } = await this.supabase
      .from("work_orders")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as WorkOrder[];
  }

  async getWorkOrdersByProvider(providerId: string) {
    const { data, error } = await this.supabase
      .from("work_orders")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as WorkOrder[];
  }

  async createWorkOrder(data: CreateWorkOrderData) {
    const validatedData = workOrderSchema.parse(data);

    const { data: workOrder, error } = await this.supabase
      .from("work_orders")
      .insert({
        ...validatedData,
        statut: "assigned",
      })
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le statut du ticket
    await this.supabase
      .from("tickets")
      .update({ statut: "in_progress" })
      .eq("id", validatedData.ticket_id);

    return workOrder as WorkOrder;
  }

  async updateWorkOrder(id: string, data: UpdateWorkOrderData) {
    const { data: workOrder, error } = await this.supabase
      .from("work_orders")
      .update(data)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Si l'ordre de travail est terminé, mettre à jour le ticket
    if (data.statut === "done") {
      await this.supabase
        .from("tickets")
        .update({ statut: "resolved" })
        .eq("id", workOrder.ticket_id);
    }

    return workOrder as WorkOrder;
  }

  async deleteWorkOrder(id: string) {
    const { error } = await this.supabase.from("work_orders").delete().eq("id", id);

    if (error) throw error;
  }
}

export const workOrdersService = new WorkOrdersService();

