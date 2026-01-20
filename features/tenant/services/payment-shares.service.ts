import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";

export interface PaymentShare {
  id: string;
  lease_id: string;
  invoice_id?: string | null;
  month: string; // YYYY-MM-01
  roommate_id: string;
  due_amount: number;
  status: "unpaid" | "pending" | "partial" | "paid" | "failed" | "scheduled";
  amount_paid: number;
  last_event_at?: string | null;
  autopay: boolean;
  provider?: string | null;
  provider_intent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentSharePublic {
  id: string;
  lease_id: string;
  month: string;
  roommate_id: string;
  status: "unpaid" | "pending" | "partial" | "paid" | "failed" | "scheduled";
  last_event_at?: string | null;
  autopay: boolean;
  created_at: string;
}

export interface CreatePaymentShareData {
  lease_id: string;
  invoice_id?: string;
  month: string;
  roommate_id: string;
  due_amount: number;
}

export class PaymentSharesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer les parts de paiement d'un bail pour un mois (via API route)
   * Retourne uniquement la part de l'utilisateur avec montants complets
   * + les statuts des autres colocs (via vue publique)
   */
  async getPaymentShares(
    leaseId: string,
    month: string
  ): Promise<{
    own: PaymentShare | null;
    others: PaymentSharePublic[];
  }> {
    const response = await apiClient.get<{
      own: PaymentShare | null;
      others: PaymentSharePublic[];
    }>(`/leases/${leaseId}/payment-shares?month=${month}`);
    return response;
  }

  /**
   * Récupérer les parts de paiement directement depuis Supabase (pour usage interne dans API routes)
   */
  async getPaymentSharesInternal(
    leaseId: string,
    month: string,
    userId: string
  ): Promise<{
    own: PaymentShare | null;
    others: PaymentSharePublic[];
  }> {
    // Récupérer le roommate_id de l'utilisateur
    const { data: roommate } = await this.supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("user_id", userId)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return { own: null, others: [] };
    }

    // Récupérer la part complète de l'utilisateur
    const { data: ownShare, error: ownError } = await this.supabase
      .from("payment_shares")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("month", month)
      .eq("roommate_id", roommate.id)
      .single();

    if (ownError && ownError.code !== "PGRST116") throw ownError;

    // Récupérer les statuts des autres (vue publique, montants masqués)
    const { data: othersShares, error: othersError } = await this.supabase
      .from("payment_shares_public")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("month", month)
      .neq("roommate_id", roommate.id);

    if (othersError) throw othersError;

    return {
      own: ownShare || null,
      others: othersShares || [],
    };
  }

  /**
   * Récupérer l'historique des paiements d'un bail
   */
  async getPaymentHistory(
    leaseId: string,
    limit: number = 12
  ): Promise<PaymentShare[]> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    const { data: roommate } = await this.supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("user_id", user.id)
      .is("left_on", null)
      .single();

    if (!roommate) return [];

    const { data, error } = await this.supabase
      .from("payment_shares")
      .select("*")
      .eq("lease_id", leaseId)
      .eq("roommate_id", roommate.id)
      .order("month", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Créer une part de paiement
   */
  async createPaymentShare(
    data: CreatePaymentShareData
  ): Promise<PaymentShare> {
    const { data: share, error } = await this.supabase
      .from("payment_shares")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return share;
  }

  /**
   * Mettre à jour le statut d'une part de paiement
   */
  async updatePaymentShareStatus(
    id: string,
    status: PaymentShare["status"],
    amountPaid?: number
  ): Promise<PaymentShare> {
    const updates: any = {
      status,
      last_event_at: new Date().toISOString(),
    };

    if (amountPaid !== undefined) {
      updates.amount_paid = amountPaid;
    }

    const { data, error } = await this.supabase
      .from("payment_shares")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Activer/désactiver l'autopay (via API route)
   */
  async toggleAutopay(leaseId: string, paymentShareId: string, enabled: boolean): Promise<PaymentShare> {
    const response = await apiClient.post<{ paymentShare: PaymentShare }>(
      `/leases/${leaseId}/autopay`,
      { enabled, paymentShareId }
    );
    return response.paymentShare;
  }

  /**
   * Activer/désactiver l'autopay directement (pour usage interne dans API routes)
   */
  async toggleAutopayInternal(paymentShareId: string, enabled: boolean): Promise<PaymentShare> {
    const { data, error } = await this.supabase
      .from("payment_shares")
      .update({ autopay: enabled })
      .eq("id", paymentShareId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Effectuer un paiement
   */
  async pay(
    leaseId: string,
    data: {
      amount: number;
      method: string;
      month: string;
      paymentShareId: string;
    }
  ): Promise<{ paymentShare: PaymentShare; payment?: any }> {
    return apiClient.post(`/leases/${leaseId}/pay`, data);
  }

  /**
   * Récupérer les quittances d'un bail
   */
  async getReceipts(leaseId: string, month?: string): Promise<Array<{
    id: string;
    periode: string;
    montant_total: number;
    montant_loyer: number;
    montant_charges: number;
    paid_at: string;
    payment_method?: string;
    pdf_url?: string | null;
  }>> {
    const url = `/leases/${leaseId}/receipts${month ? `?month=${month}` : ""}`;
    const response = await apiClient.get<{ receipts: any[] }>(url);
    return response.receipts;
  }
}

export const paymentSharesService = new PaymentSharesService();

