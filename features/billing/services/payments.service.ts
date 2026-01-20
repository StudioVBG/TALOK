import { createClient } from "@/lib/supabase/client";
import { paymentSchema } from "@/lib/validations";
import type { Payment, PaymentStatus, PaymentMethod } from "@/lib/types";

export interface CreatePaymentData {
  invoice_id: string;
  montant: number;
  moyen: PaymentMethod;
  provider_ref?: string | null;
}

export interface UpdatePaymentData extends Partial<CreatePaymentData> {
  statut?: PaymentStatus;
  date_paiement?: string | null;
}

export class PaymentsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getPayments() {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Payment[];
  }

  async getPaymentById(id: string) {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("id", id as any)
      .single();

    if (error) throw error;
    return data as Payment;
  }

  async getPaymentsByInvoice(invoiceId: string) {
    const { data, error } = await this.supabase
      .from("payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Payment[];
  }

  async createPayment(data: CreatePaymentData) {
    const validatedData = paymentSchema.parse(data);

    const { data: payment, error } = await this.supabase
      .from("payments")
      .insert({
        ...validatedData,
        statut: "pending",
        date_paiement: null,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return payment as Payment;
  }

  async updatePayment(id: string, data: UpdatePaymentData) {
    const { data: payment, error } = await (this.supabase
      .from("payments") as any)
      .update(data as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Si le paiement est réussi, mettre à jour la date de paiement
    const dataUpdate = data as any;
    if (dataUpdate.statut === "succeeded" && !dataUpdate.date_paiement) {
      await (this.supabase
        .from("payments") as any)
        .update({ date_paiement: new Date().toISOString().split("T")[0] } as any)
        .eq("id", id as any);
    }

    return payment as Payment;
  }

  async markPaymentAsSucceeded(id: string, datePaiement?: string) {
    return await this.updatePayment(id, {
      statut: "succeeded",
      date_paiement: datePaiement || new Date().toISOString().split("T")[0],
    });
  }

  async markPaymentAsFailed(id: string) {
    return await this.updatePayment(id, {
      statut: "failed",
    });
  }

  async deletePayment(id: string) {
    const { error } = await this.supabase.from("payments").delete().eq("id", id);

    if (error) throw error;
  }

  async getTotalPaidForInvoice(invoiceId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("payments")
      .select("montant")
      .eq("invoice_id", invoiceId)
      .eq("statut", "succeeded" as any);

    if (error) throw error;
    const dataArray = (data as any[]) || [];
    return dataArray.reduce((sum, p: any) => sum + Number(p.montant), 0);
  }
}

export const paymentsService = new PaymentsService();

