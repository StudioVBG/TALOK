/**
 * Service de génération PDF
 * Utilise une Edge Function Supabase ou un service externe
 * Intègre le système de templates de bail légaux
 * 
 * FALLBACK: Génération côté client avec html2pdf.js si le serveur ne peut pas générer
 */

import { LeaseTemplateService } from "@/lib/templates/bail";
import type { BailComplet, TypeBail } from "@/lib/templates/bail/types";

interface PDFGenerationOptions {
  type: "receipt" | "lease" | "edl" | "invoice";
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

// Chargement dynamique de html2pdf.js (uniquement quand nécessaire)
let html2pdfModule: any = null;

async function loadHtml2Pdf() {
  if (html2pdfModule) return html2pdfModule;
  
  // Import dynamique pour ne charger que quand nécessaire
  const html2pdfImport = await import('html2pdf.js');
  html2pdfModule = html2pdfImport.default;
  return html2pdfModule;
}

/**
 * Génère un PDF côté client en utilisant la fonction d'impression native du navigateur
 * C'est la méthode la plus fiable pour garantir que le rendu est identique à l'écran
 */
async function generatePdfFromHtmlClient(
  html: string, 
  filename: string,
  options?: { openInNewTab?: boolean }
): Promise<{ url: string; blob: Blob }> {
  
  // Créer une iframe invisible pour l'impression
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  // Écrire le HTML dans l'iframe
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    throw new Error("Impossible d'accéder au document de l'iframe");
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Attendre le chargement complet (y compris images/styles)
  await new Promise<void>(resolve => {
    if (iframe.contentWindow?.document.readyState === 'complete') {
      resolve();
    } else {
      iframe.onload = () => resolve();
    }
  });

  // Lancer l'impression
  // Note: On ne peut pas générer un Blob PDF directement via JS natif sans bibliothèque
  // Donc on lance la boîte de dialogue d'impression qui permet "Enregistrer au format PDF"
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  // Nettoyage après un délai pour laisser le temps à l'impression de se lancer
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 1000);

  // Comme on ne peut pas générer d'URL blob nativement, on retourne une URL vide
  // L'utilisateur aura déjà eu la boîte de dialogue d'impression
  return { url: '', blob: new Blob() };
}

class PDFService {
  /**
   * Générer un bail complet avec le système de templates légaux
   * Utilise le serveur si disponible, sinon fallback côté client avec html2pdf.js
   */
  async generateLeaseDocument(options: LeaseGenerationOptions): Promise<GeneratedLease> {
    const { typeBail, bailData, generatePDF = true, leaseId, draftId } = options;

    // Générer le HTML à partir du template
    const html = LeaseTemplateService.generateHTML(typeBail, bailData);

    if (!generatePDF) {
      // Retourner juste le HTML pour prévisualisation
      return { html };
    }

    // Générer le nom du fichier
    const ville = bailData.logement?.ville || 'document';
    const villeSlug = ville.toLowerCase().replace(/\s+/g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `bail_${typeBail}_${villeSlug}_${dateStr}.pdf`;

    try {
      // Essayer d'abord via le serveur
      const response = await fetch("/api/pdf/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "lease",
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
        throw new Error("Serveur non disponible");
      }

      // Si le serveur retourne un buffer PDF direct (blob)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/pdf")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return {
          html,
          url,
          path: `leases/${leaseId || 'preview'}.pdf`
        };
      }

      // Si le serveur retourne un JSON
      const result = await response.json();
      
      // ✅ NOUVEAU: Si le serveur indique "method: client", générer côté client
      if (result.method === 'client' || !result.url) {
        return await this.generateLeaseDocumentClient(html, filename, leaseId);
      }

      return {
        html,
        url: result.url,
        path: result.path,
      };
    } catch (error) {
      // Fallback: générer côté client si le serveur échoue
      return await this.generateLeaseDocumentClient(html, filename, leaseId);
    }
  }

  /**
   * Génération PDF côté client (Fallback impression native)
   */
  private async generateLeaseDocumentClient(
    html: string, 
    filename: string,
    leaseId?: string
  ): Promise<GeneratedLease> {
    // Cette méthode déclenche directement l'impression native du navigateur
    await generatePdfFromHtmlClient(html, filename);
    
    // On retourne une URL vide car l'action est déjà effectuée
    return {
      html,
      url: '', // Pas d'URL blob générée
      path: `leases/${leaseId || 'preview'}.pdf`
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
        type: "receipt", // ✅ Changé de 'template' à 'type'
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
        type: "lease", // ✅ Changé de 'template' à 'type'
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
        type: "edl", // ✅ Changé de 'template' à 'type'
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
        type: "invoice", // ✅ Changé de 'template' à 'type'
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
