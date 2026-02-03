// =====================================================
// Générateur PDF - Abstraction multi-backend
// =====================================================

import {
  generateRegularisationHtml,
  generateCallForFundsHtml,
  generateAssemblyPvHtml,
  type RegularisationPdfData,
  type CallForFundsPdfData,
  type AssemblyPvPdfData
} from './templates';

// =====================================================
// Types
// =====================================================

export type PdfDocumentType = 'regularisation' | 'call_for_funds' | 'assembly_pv';

export interface PdfGenerationResult {
  success: boolean;
  data?: Uint8Array | Blob;
  filename?: string;
  error?: string;
}

export interface PdfGeneratorOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// =====================================================
// Backend abstraction
// =====================================================

export type PdfBackend = 'browser' | 'server' | 'api';

interface PdfBackendConfig {
  backend: PdfBackend;
  apiUrl?: string; // Pour le backend API externe
}

let currentConfig: PdfBackendConfig = {
  backend: 'browser'
};

export function configurePdfGenerator(config: PdfBackendConfig): void {
  currentConfig = config;
}

// =====================================================
// Génération principale
// =====================================================

export async function generatePdf(
  type: 'regularisation',
  data: RegularisationPdfData,
  options?: PdfGeneratorOptions
): Promise<PdfGenerationResult>;

export async function generatePdf(
  type: 'call_for_funds',
  data: CallForFundsPdfData,
  options?: PdfGeneratorOptions
): Promise<PdfGenerationResult>;

export async function generatePdf(
  type: 'assembly_pv',
  data: AssemblyPvPdfData,
  options?: PdfGeneratorOptions
): Promise<PdfGenerationResult>;

export async function generatePdf(
  type: PdfDocumentType,
  data: RegularisationPdfData | CallForFundsPdfData | AssemblyPvPdfData,
  options: PdfGeneratorOptions = {}
): Promise<PdfGenerationResult> {
  // Générer le HTML selon le type
  let html: string;
  let filename: string;

  switch (type) {
    case 'regularisation':
      html = generateRegularisationHtml(data as RegularisationPdfData);
      const regData = data as RegularisationPdfData;
      filename = `regularisation_${regData.fiscal_year}_${regData.tenant.name.replace(/\s+/g, '_')}.pdf`;
      break;

    case 'call_for_funds':
      html = generateCallForFundsHtml(data as CallForFundsPdfData);
      const cfData = data as CallForFundsPdfData;
      filename = `appel_fonds_${cfData.call_number}_lot_${cfData.unit.lot_number}.pdf`;
      break;

    case 'assembly_pv':
      html = generateAssemblyPvHtml(data as AssemblyPvPdfData);
      const pvData = data as AssemblyPvPdfData;
      filename = `pv_${pvData.assembly_type}_${pvData.assembly_number}.pdf`;
      break;

    default:
      return { success: false, error: 'Type de document non supporté' };
  }

  // Générer le PDF selon le backend configuré
  switch (currentConfig.backend) {
    case 'browser':
      return generatePdfBrowser(html, filename, options);

    case 'server':
      return generatePdfServer(html, filename, options);

    case 'api':
      if (!currentConfig.apiUrl) {
        return { success: false, error: 'URL API non configurée' };
      }
      return generatePdfApi(html, filename, currentConfig.apiUrl, options);

    default:
      return { success: false, error: 'Backend PDF non configuré' };
  }
}

// =====================================================
// Backend: Browser (html2pdf.js)
// =====================================================

async function generatePdfBrowser(
  html: string,
  filename: string,
  options: PdfGeneratorOptions
): Promise<PdfGenerationResult> {
  try {
    // Vérifie si on est côté client
    if (typeof window === 'undefined') {
      return { success: false, error: 'html2pdf n\'est disponible que côté client' };
    }

    // Import dynamique de html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    // Créer un élément temporaire
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    const pdfOptions = {
      margin: options.margin 
        ? [options.margin.top, options.margin.right, options.margin.bottom, options.margin.left]
        : [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false
      },
      jsPDF: { 
        unit: 'mm', 
        format: options.format || 'a4', 
        orientation: options.orientation || 'portrait' 
      }
    };

    const pdfBlob = await html2pdf()
      .set(pdfOptions as any)
      .from(container)
      .outputPdf('blob');

    // Nettoyer
    document.body.removeChild(container);

    return {
      success: true,
      data: pdfBlob,
      filename
    };
  } catch (error) {
    console.error('Erreur génération PDF browser:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// =====================================================
// Backend: Server (Puppeteer - Next.js API Route)
// =====================================================

async function generatePdfServer(
  html: string,
  filename: string,
  options: PdfGeneratorOptions
): Promise<PdfGenerationResult> {
  try {
    // Cette fonction devrait être appelée depuis une API route Next.js
    // Elle utilise Puppeteer pour la génération côté serveur

    // Import dynamique de Puppeteer (uniquement côté serveur)
    // Note: Puppeteer doit être installé: npm install puppeteer
    
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      landscape: options.orientation === 'landscape',
      margin: options.margin 
        ? {
            top: `${options.margin.top}mm`,
            right: `${options.margin.right}mm`,
            bottom: `${options.margin.bottom}mm`,
            left: `${options.margin.left}mm`
          }
        : { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true
    });

    await browser.close();

    return {
      success: true,
      data: new Uint8Array(pdfBuffer),
      filename
    };
  } catch (error) {
    console.error('Erreur génération PDF serveur:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// =====================================================
// Backend: API externe
// =====================================================

async function generatePdfApi(
  html: string,
  filename: string,
  apiUrl: string,
  options: PdfGeneratorOptions
): Promise<PdfGenerationResult> {
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        html,
        filename,
        options
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error || 'Erreur API PDF'
      };
    }

    const pdfBlob = await response.blob();

    return {
      success: true,
      data: pdfBlob,
      filename
    };
  } catch (error) {
    console.error('Erreur génération PDF API:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

// =====================================================
// Utilitaires
// =====================================================

/**
 * Télécharge le PDF généré dans le navigateur
 */
export function downloadPdf(result: PdfGenerationResult): void {
  if (!result.success || !result.data || typeof window === 'undefined') {
    console.error('Impossible de télécharger le PDF');
    return;
  }

  const blob = result.data instanceof Blob
    ? result.data
    : new Blob([result.data as BlobPart], { type: 'application/pdf' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename || 'document.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Ouvre le PDF dans un nouvel onglet
 */
export function openPdfInNewTab(result: PdfGenerationResult): void {
  if (!result.success || !result.data || typeof window === 'undefined') {
    console.error('Impossible d\'ouvrir le PDF');
    return;
  }

  const blob = result.data instanceof Blob
    ? result.data
    : new Blob([result.data as BlobPart], { type: 'application/pdf' });

  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: Le URL.revokeObjectURL sera fait quand l'onglet sera fermé
}

/**
 * Convertit le résultat en base64 pour stockage ou email
 */
export async function pdfResultToBase64(result: PdfGenerationResult): Promise<string | null> {
  if (!result.success || !result.data) {
    return null;
  }

  if (typeof window !== 'undefined' && result.data instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(result.data as Blob);
    });
  }

  // Pour Uint8Array (serveur)
  if (result.data instanceof Uint8Array) {
    const binary = Array.from(result.data)
      .map(byte => String.fromCharCode(byte))
      .join('');
    return btoa(binary);
  }

  return null;
}

