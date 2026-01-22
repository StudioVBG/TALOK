import { apiClient } from "@/lib/api-client";
import { invoiceSchema } from "@/lib/validations";
import type { Invoice, InvoiceStatus } from "@/lib/types";

export interface CreateInvoiceData {
  lease_id: string;
  periode: string; // Format "YYYY-MM"
  montant_loyer: number;
  montant_charges: number;
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  statut?: InvoiceStatus;
}

/**
 * Interface pour les options de filtrage des factures
 * @since SOTA 2026 - Optimisation N+1
 */
export interface InvoiceFilters {
  lease_id?: string;
  owner_id?: string;
  tenant_id?: string;
  statut?: InvoiceStatus | InvoiceStatus[];
  periode?: string;
  periode_from?: string;
  periode_to?: string;
  limit?: number;
  offset?: number;
}

/**
 * Service de gestion des factures
 * Optimisé SOTA 2026 - Élimination des requêtes N+1
 */
export class InvoicesService {

  /**
   * Récupère toutes les factures avec filtres optionnels
   * @param filters Filtres optionnels pour réduire le payload
   */
  async getInvoices(filters?: InvoiceFilters): Promise<Invoice[]> {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.lease_id) params.append("lease_id", filters.lease_id);
      if (filters.owner_id) params.append("owner_id", filters.owner_id);
      if (filters.tenant_id) params.append("tenant_id", filters.tenant_id);
      if (filters.periode) params.append("periode", filters.periode);
      if (filters.periode_from) params.append("periode_from", filters.periode_from);
      if (filters.periode_to) params.append("periode_to", filters.periode_to);
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.offset) params.append("offset", filters.offset.toString());

      if (filters.statut) {
        const statuts = Array.isArray(filters.statut) ? filters.statut : [filters.statut];
        statuts.forEach(s => params.append("statut", s));
      }
    }

    const queryString = params.toString();
    const url = queryString ? `/invoices?${queryString}` : "/invoices";

    const response = await apiClient.get<{ invoices: Invoice[] }>(url);
    return response.invoices;
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const response = await apiClient.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.invoice;
  }

  /**
   * Récupère les factures d'un bail
   * @optimized SOTA 2026 - Requête directe au lieu de filter client-side
   */
  async getInvoicesByLease(leaseId: string): Promise<Invoice[]> {
    return this.getInvoices({ lease_id: leaseId });
  }

  /**
   * Récupère les factures d'un propriétaire
   * @optimized SOTA 2026 - Requête directe au lieu de filter client-side
   */
  async getInvoicesByOwner(ownerId: string): Promise<Invoice[]> {
    return this.getInvoices({ owner_id: ownerId });
  }

  /**
   * Récupère les factures d'un locataire
   * @optimized SOTA 2026 - Requête directe au lieu de filter client-side
   */
  async getInvoicesByTenant(tenantId: string): Promise<Invoice[]> {
    return this.getInvoices({ tenant_id: tenantId });
  }

  /**
   * Récupère les factures impayées d'un bail
   * @optimized SOTA 2026 - Nouvelle méthode utilitaire
   */
  async getUnpaidInvoicesByLease(leaseId: string): Promise<Invoice[]> {
    return this.getInvoices({
      lease_id: leaseId,
      statut: ["draft", "sent", "partial"]
    });
  }

  /**
   * Récupère les factures d'une période
   * @optimized SOTA 2026 - Nouvelle méthode utilitaire
   */
  async getInvoicesByPeriod(periodeFrom: string, periodeTo: string): Promise<Invoice[]> {
    return this.getInvoices({
      periode_from: periodeFrom,
      periode_to: periodeTo
    });
  }

  async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    const validatedData = invoiceSchema.parse(data);
    const response = await apiClient.post<{ invoice: Invoice }>("/invoices", validatedData);
    return response.invoice;
  }

  async generateMonthlyInvoice(leaseId: string, periode: string): Promise<Invoice> {
    const response = await apiClient.post<{ invoice: Invoice }>(
      "/invoices/generate-monthly",
      {
        lease_id: leaseId,
        periode,
      }
    );
    return response.invoice;
  }

  async updateInvoice(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const validatedData = invoiceSchema.partial().parse(data);
    const response = await apiClient.put<{ invoice: Invoice }>(`/invoices/${id}`, validatedData);
    return response.invoice;
  }

  async sendInvoice(id: string): Promise<Invoice> {
    return await this.updateInvoice(id, { statut: "sent" });
  }

  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete<{ success: boolean }>(`/invoices/${id}`);
  }
}

export const invoicesService = new InvoicesService();

