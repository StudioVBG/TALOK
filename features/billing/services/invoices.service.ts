import { apiClient } from "@/lib/api-client";
import { invoiceSchema, invoiceUpdateSchema } from "@/lib/validations";
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

export class InvoicesService {

  async getInvoices(): Promise<Invoice[]> {
    const response = await apiClient.get<{ invoices: Invoice[] }>("/invoices");
    return response.invoices;
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const response = await apiClient.get<{ invoice: Invoice }>(`/invoices/${id}`);
    return response.invoice;
  }

  async getInvoicesByLease(leaseId: string): Promise<Invoice[]> {
    const invoices = await this.getInvoices();
    return invoices.filter((inv) => inv.lease_id === leaseId);
  }

  async getInvoicesByOwner(ownerId: string): Promise<Invoice[]> {
    const invoices = await this.getInvoices();
    return invoices.filter((inv) => inv.owner_id === ownerId);
  }

  async getInvoicesByTenant(tenantId: string): Promise<Invoice[]> {
    const invoices = await this.getInvoices();
    return invoices.filter((inv) => inv.tenant_id === tenantId);
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
    const validatedData = invoiceUpdateSchema.parse(data);
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

