/**
 * Service de génération PDF
 * Utilise une Edge Function Supabase ou un service externe
 * Intègre le système de templates de bail légaux
 */

import { LeaseTemplateService } from "@/lib/templates/bail";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";

interface PDFGenerationOptions {
  template: "receipt" | "lease" | "edl" | "invoice";
  data: Record<string, unknown>;
}

interface LeaseGenerationOptions {
  leaseId?: string;
  draftId?: string;
  typeBail: TypeBail;
  bailData: Partial<BailComplet>;
  generatePDF?: boolean; // Si false, retourne juste le HTML
}

interface GeneratedLease {
  html: string;
  url?: string;
  path?: string;
}

class PDFService {
  /**
   * Générer un bail complet avec le système de templates légaux
   */
  async generateLeaseDocument(options: LeaseGenerationOptions): Promise<GeneratedLease> {
    const { typeBail, bailData, generatePDF = true, leaseId, draftId } = options;

    // Générer le HTML à partir du template
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    if (!generatePDF) {
      // Retourner juste le HTML pour prévisualisation
      return { html };
    }

    // Générer le PDF via l'API
    const response = await fetch("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "lease",
        data: {
          lease_id: leaseId,
          draft_id: draftId,
          type_bail: typeBail,
          html_content: html,
          bail_data: bailData,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la génération du PDF");
    }

    const result = await response.json();
    return {
      html,
      url: result.url,
      path: result.path,
    };
  }

  /**
   * Prévisualiser un bail (HTML uniquement, pas de PDF)
   */
  previewLease(typeBail: TypeBail, bailData: Partial<BailComplet>): string {
    return LeaseTemplateService.generateHTML(typeBail, bailData);
  }

  /**
   * Générer un PDF de quittance
   */
  async generateReceiptPDF(data: {
    invoiceId: string;
    periode: string;
    montant_total: number;
    montant_loyer: number;
    montant_charges: number;
    tenantName: string;
    propertyAddress: string;
    ownerName: string;
    ownerAddress: string;
    paidAt: string;
    paymentMethod: string;
  }): Promise<{ url: string; path: string }> {
    const response = await fetch("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "receipt",
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la génération du PDF");
    }

    return response.json();
  }

  /**
   * Générer un PDF de bail (ancienne méthode, conservée pour compatibilité)
   */
  async generateLeasePDF(data: {
    leaseId: string;
    leaseData: Record<string, unknown>;
  }): Promise<{ url: string; path: string }> {
    const response = await fetch("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "lease",
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la génération du PDF");
    }

    return response.json();
  }

  /**
   * Générer un PDF d'état des lieux
   */
  async generateEDLPDF(data: {
    edlId: string;
    edlData: Record<string, unknown>;
    type: "entree" | "sortie";
    propertyAddress: string;
    tenantName: string;
    ownerName: string;
    date: string;
    rooms: Array<{
      name: string;
      elements: Array<{
        name: string;
        state: string;
        observations?: string;
        photos?: string[];
      }>;
    }>;
    signatures?: {
      owner?: string;
      tenant?: string;
    };
  }): Promise<{ url: string; path: string }> {
    const response = await fetch("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "edl",
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la génération du PDF");
    }

    return response.json();
  }

  /**
   * Générer un PDF de facture
   */
  async generateInvoicePDF(data: {
    invoiceId: string;
    invoiceData: Record<string, unknown>;
  }): Promise<{ url: string; path: string }> {
    const response = await fetch("/api/pdf/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template: "invoice",
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la génération du PDF");
    }

    return response.json();
  }

  /**
   * Télécharger un document existant depuis le storage
   */
  async downloadDocument(storagePath: string): Promise<Blob> {
    const response = await fetch(`/api/documents/download?path=${encodeURIComponent(storagePath)}`);
    
    if (!response.ok) {
      throw new Error("Erreur lors du téléchargement du document");
    }

    return response.blob();
  }

  /**
   * Obtenir l'URL publique d'un document
   */
  getDocumentUrl(storagePath: string): string {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/documents/${storagePath}`;
  }
}

export const pdfService = new PDFService();
