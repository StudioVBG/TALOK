import { createClient } from "@/lib/supabase/client";
import type { Invoice, Lease, Property } from "@/lib/types";

export interface ReportData {
  properties: Property[];
  leases: Lease[];
  invoices: Invoice[];
  summary: {
    totalProperties: number;
    totalLeases: number;
    totalInvoices: number;
    totalRevenue: number;
    paidInvoices: number;
    unpaidInvoices: number;
  };
}

export class ReportsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async generateOwnerReport(ownerId: string, startDate?: string, endDate?: string): Promise<ReportData> {
    // Récupérer les propriétés
    const { data: properties } = await this.supabase
      .from("properties")
      .select("*")
      .eq("owner_id", ownerId);

    if (!properties || properties.length === 0) {
      return {
        properties: [],
        leases: [],
        invoices: [],
        summary: {
          totalProperties: 0,
          totalLeases: 0,
          totalInvoices: 0,
          totalRevenue: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
        },
      };
    }

    const propertyIds = properties.map((p) => p.id);

    // Récupérer les baux
    let leasesQuery = this.supabase
      .from("leases")
      .select("*")
      .in("property_id", propertyIds);

    if (startDate) {
      leasesQuery = leasesQuery.gte("date_debut", startDate);
    }
    if (endDate) {
      leasesQuery = leasesQuery.lte("date_debut", endDate);
    }

    const { data: leases } = await leasesQuery;

    // Récupérer les factures
    let invoicesQuery = this.supabase
      .from("invoices")
      .select("*")
      .eq("owner_id", ownerId);

    if (startDate) {
      invoicesQuery = invoicesQuery.gte("periode", startDate.substring(0, 7));
    }
    if (endDate) {
      invoicesQuery = invoicesQuery.lte("periode", endDate.substring(0, 7));
    }

    const { data: invoices } = await invoicesQuery;

    // Calculer les statistiques
    const paidInvoices = invoices?.filter((i) => i.statut === "paid").length || 0;
    const unpaidInvoices = invoices?.filter((i) => i.statut !== "paid").length || 0;
    const totalRevenue =
      invoices?.filter((i) => i.statut === "paid").reduce((sum, i) => sum + Number(i.montant_total), 0) || 0;

    return {
      properties: (properties as Property[]) || [],
      leases: (leases as Lease[]) || [],
      invoices: (invoices as Invoice[]) || [],
      summary: {
        totalProperties: properties?.length || 0,
        totalLeases: leases?.length || 0,
        totalInvoices: invoices?.length || 0,
        totalRevenue,
        paidInvoices,
        unpaidInvoices,
      },
    };
  }

  async exportToCSV(data: ReportData): Promise<string> {
    // Générer un CSV simple
    let csv = "Type,ID,Date,Montant,Statut\n";

    data.invoices.forEach((invoice) => {
      csv += `Facture,${invoice.id},${invoice.periode},${invoice.montant_total},${invoice.statut}\n`;
    });

    return csv;
  }

  async exportToJSON(data: ReportData): Promise<string> {
    return JSON.stringify(data, null, 2);
  }
}

export const reportsService = new ReportsService();

