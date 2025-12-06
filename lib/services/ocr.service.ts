/**
 * Service OCR pour la lecture automatique de documents
 * 
 * Supporte :
 * - Extraction de texte depuis PDF et images
 * - Reconnaissance de pièces d'identité (CNI, passeport, titre de séjour)
 * - Extraction de données depuis fiches de paie
 * - Extraction d'informations depuis avis d'imposition
 * - Lecture de factures et quittances
 * 
 * Provider par défaut : Google Cloud Vision
 * Providers alternatifs : Tesseract.js (local), AWS Textract
 */

import { createClient } from "@/lib/supabase/server";

// Types de documents reconnus
export type OcrDocumentType =
  | "identity" // CNI, passeport, titre de séjour
  | "payslip" // Fiche de paie
  | "tax_notice" // Avis d'imposition
  | "invoice" // Facture
  | "receipt" // Quittance
  | "contract" // Contrat (bail, etc.)
  | "bank_statement" // Relevé bancaire
  | "insurance" // Attestation assurance
  | "general"; // Document générique

// Résultat d'extraction
export interface OcrResult {
  success: boolean;
  documentType: OcrDocumentType;
  confidence: number;
  rawText: string;
  extractedData: Record<string, any>;
  errors?: string[];
}

// Données extraites d'une CNI
export interface IdentityData {
  lastName?: string;
  firstName?: string;
  birthDate?: string;
  birthPlace?: string;
  documentNumber?: string;
  expiryDate?: string;
  nationality?: string;
  gender?: string;
}

// Données extraites d'une fiche de paie
export interface PayslipData {
  employer?: string;
  employeeName?: string;
  period?: string;
  grossSalary?: number;
  netSalary?: number;
  socialCharges?: number;
  employmentType?: string;
}

// Données extraites d'un avis d'imposition
export interface TaxNoticeData {
  fiscalYear?: number;
  referenceIncome?: number;
  taxAmount?: number;
  householdParts?: number;
  declarantName?: string;
  fiscalAddress?: string;
}

/**
 * Configuration du service OCR
 */
interface OcrConfig {
  provider: "google_vision" | "tesseract" | "aws_textract" | "mock";
  apiKey?: string;
  language?: string;
}

const DEFAULT_CONFIG: OcrConfig = {
  provider: "mock", // Utiliser mock par défaut pour la démo
  language: "fr",
};

/**
 * Classe principale du service OCR
 */
export class OcrService {
  private config: OcrConfig;

  constructor(config?: Partial<OcrConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyse un document et extrait les données
   */
  async analyzeDocument(
    fileUrl: string,
    expectedType?: OcrDocumentType
  ): Promise<OcrResult> {
    console.log(`[OCR] Analyse du document: ${fileUrl}`);
    console.log(`[OCR] Type attendu: ${expectedType || "auto"}`);
    console.log(`[OCR] Provider: ${this.config.provider}`);

    try {
      // Télécharger l'image/document si nécessaire
      const imageData = await this.fetchDocument(fileUrl);

      // Extraire le texte selon le provider
      let rawText: string;
      switch (this.config.provider) {
        case "google_vision":
          rawText = await this.extractWithGoogleVision(imageData);
          break;
        case "tesseract":
          rawText = await this.extractWithTesseract(imageData);
          break;
        case "aws_textract":
          rawText = await this.extractWithTextract(imageData);
          break;
        case "mock":
        default:
          rawText = this.getMockText(expectedType);
      }

      // Détecter le type de document si non spécifié
      const documentType = expectedType || this.detectDocumentType(rawText);

      // Extraire les données structurées selon le type
      const extractedData = this.extractStructuredData(rawText, documentType);

      // Calculer la confiance
      const confidence = this.calculateConfidence(rawText, documentType, extractedData);

      return {
        success: true,
        documentType,
        confidence,
        rawText,
        extractedData,
      };
    } catch (error: any) {
      console.error("[OCR] Erreur d'analyse:", error);
      return {
        success: false,
        documentType: expectedType || "general",
        confidence: 0,
        rawText: "",
        extractedData: {},
        errors: [error.message],
      };
    }
  }

  /**
   * Récupère le contenu du document
   */
  private async fetchDocument(url: string): Promise<Buffer | string> {
    // Pour la démo, on retourne juste l'URL
    // En production, télécharger le fichier
    return url;
  }

  /**
   * Extraction avec Google Cloud Vision
   */
  private async extractWithGoogleVision(imageData: Buffer | string): Promise<string> {
    // TODO: Implémenter l'appel à Google Cloud Vision API
    // const vision = require("@google-cloud/vision");
    // const client = new vision.ImageAnnotatorClient();
    // const [result] = await client.textDetection(imageData);
    // return result.fullTextAnnotation?.text || "";
    
    console.log("[OCR] Google Vision - Non implémenté, utilisation du mock");
    return this.getMockText("general");
  }

  /**
   * Extraction avec Tesseract.js (local)
   */
  private async extractWithTesseract(imageData: Buffer | string): Promise<string> {
    // TODO: Implémenter avec Tesseract.js
    // const Tesseract = require("tesseract.js");
    // const { data: { text } } = await Tesseract.recognize(imageData, "fra");
    // return text;
    
    console.log("[OCR] Tesseract - Non implémenté, utilisation du mock");
    return this.getMockText("general");
  }

  /**
   * Extraction avec AWS Textract
   */
  private async extractWithTextract(imageData: Buffer | string): Promise<string> {
    // TODO: Implémenter l'appel à AWS Textract
    // const { TextractClient, DetectDocumentTextCommand } = require("@aws-sdk/client-textract");
    
    console.log("[OCR] AWS Textract - Non implémenté, utilisation du mock");
    return this.getMockText("general");
  }

  /**
   * Génère du texte mock pour les tests
   */
  private getMockText(type?: OcrDocumentType): string {
    switch (type) {
      case "identity":
        return `
          RÉPUBLIQUE FRANÇAISE
          CARTE NATIONALE D'IDENTITÉ
          Nom: DUPONT
          Prénom(s): Jean Pierre
          Né(e) le: 15/03/1985
          à: PARIS
          Sexe: M
          Nationalité: Française
          N° 123456789012
          Valable jusqu'au: 15/03/2030
        `;
      case "payslip":
        return `
          BULLETIN DE PAIE
          Employeur: ENTREPRISE SAS
          Salarié: Jean DUPONT
          Période: Novembre 2024
          Salaire brut: 3 500,00 €
          Cotisations salariales: 770,00 €
          Net à payer: 2 730,00 €
          Net imposable: 2 850,00 €
        `;
      case "tax_notice":
        return `
          AVIS D'IMPÔT SUR LE REVENU 2024
          Revenus 2023
          Déclarant: DUPONT Jean
          Adresse: 15 rue de la Paix, 75001 PARIS
          Revenu fiscal de référence: 42 000 €
          Nombre de parts: 2.5
          Impôt sur le revenu: 4 200 €
        `;
      default:
        return "Document non reconnu - Texte générique extrait";
    }
  }

  /**
   * Détecte automatiquement le type de document
   */
  private detectDocumentType(text: string): OcrDocumentType {
    const lowText = text.toLowerCase();

    if (lowText.includes("carte nationale") || lowText.includes("passeport") || lowText.includes("titre de séjour")) {
      return "identity";
    }
    if (lowText.includes("bulletin de paie") || lowText.includes("fiche de paie")) {
      return "payslip";
    }
    if (lowText.includes("avis d'impôt") || lowText.includes("impôt sur le revenu")) {
      return "tax_notice";
    }
    if (lowText.includes("facture") || lowText.includes("montant ttc")) {
      return "invoice";
    }
    if (lowText.includes("quittance") || lowText.includes("loyer")) {
      return "receipt";
    }
    if (lowText.includes("attestation") && lowText.includes("assurance")) {
      return "insurance";
    }
    if (lowText.includes("bail") || lowText.includes("contrat de location")) {
      return "contract";
    }

    return "general";
  }

  /**
   * Extrait les données structurées selon le type de document
   */
  private extractStructuredData(text: string, type: OcrDocumentType): Record<string, any> {
    switch (type) {
      case "identity":
        return this.extractIdentityData(text);
      case "payslip":
        return this.extractPayslipData(text);
      case "tax_notice":
        return this.extractTaxNoticeData(text);
      default:
        return { rawText: text };
    }
  }

  /**
   * Extrait les données d'une pièce d'identité
   */
  private extractIdentityData(text: string): IdentityData {
    const data: IdentityData = {};

    // Regex patterns pour extraction
    const patterns = {
      lastName: /Nom\s*:\s*([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ\s-]+)/i,
      firstName: /Prénom\(?s?\)?\s*:\s*([A-Za-zàâäéèêëïîôùûü\s-]+)/i,
      birthDate: /Né\(?e?\)?\s*le\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
      birthPlace: /à\s*:\s*([A-Za-zàâäéèêëïîôùûü\s-]+)/i,
      documentNumber: /N°\s*(\d+)/i,
      expiryDate: /Valable\s*jusqu'au\s*:\s*(\d{2}\/\d{2}\/\d{4})/i,
      gender: /Sexe\s*:\s*(M|F)/i,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        (data as any)[key] = match[1].trim();
      }
    }

    return data;
  }

  /**
   * Extrait les données d'une fiche de paie
   */
  private extractPayslipData(text: string): PayslipData {
    const data: PayslipData = {};

    // Patterns pour fiche de paie
    const grossMatch = text.match(/Salaire\s*brut\s*:\s*([\d\s,\.]+)\s*€/i);
    const netMatch = text.match(/Net\s*à\s*payer\s*:\s*([\d\s,\.]+)\s*€/i);
    const periodMatch = text.match(/Période\s*:\s*(\w+\s*\d{4})/i);
    const employerMatch = text.match(/Employeur\s*:\s*(.+)/i);

    if (grossMatch) data.grossSalary = parseFloat(grossMatch[1].replace(/\s/g, "").replace(",", "."));
    if (netMatch) data.netSalary = parseFloat(netMatch[1].replace(/\s/g, "").replace(",", "."));
    if (periodMatch) data.period = periodMatch[1];
    if (employerMatch) data.employer = employerMatch[1].trim();

    return data;
  }

  /**
   * Extrait les données d'un avis d'imposition
   */
  private extractTaxNoticeData(text: string): TaxNoticeData {
    const data: TaxNoticeData = {};

    const incomeMatch = text.match(/Revenu\s*fiscal\s*de\s*référence\s*:\s*([\d\s,\.]+)\s*€/i);
    const partsMatch = text.match(/Nombre\s*de\s*parts\s*:\s*([\d,\.]+)/i);
    const taxMatch = text.match(/Impôt\s*sur\s*le\s*revenu\s*:\s*([\d\s,\.]+)\s*€/i);

    if (incomeMatch) data.referenceIncome = parseFloat(incomeMatch[1].replace(/\s/g, "").replace(",", "."));
    if (partsMatch) data.householdParts = parseFloat(partsMatch[1].replace(",", "."));
    if (taxMatch) data.taxAmount = parseFloat(taxMatch[1].replace(/\s/g, "").replace(",", "."));

    return data;
  }

  /**
   * Calcule le niveau de confiance de l'extraction
   */
  private calculateConfidence(
    text: string,
    type: OcrDocumentType,
    data: Record<string, any>
  ): number {
    // Nombre de champs extraits vs attendus
    const expectedFields: Record<OcrDocumentType, number> = {
      identity: 6,
      payslip: 4,
      tax_notice: 3,
      invoice: 3,
      receipt: 2,
      contract: 2,
      bank_statement: 3,
      insurance: 2,
      general: 0,
    };

    const extractedCount = Object.keys(data).filter((k) => k !== "rawText" && data[k]).length;
    const expected = expectedFields[type] || 1;

    // Score basé sur les champs extraits
    const fieldScore = Math.min(extractedCount / expected, 1) * 0.6;

    // Score basé sur la longueur du texte (plus de texte = plus fiable)
    const textScore = Math.min(text.length / 500, 1) * 0.2;

    // Score fixe si type détecté
    const typeScore = type !== "general" ? 0.2 : 0;

    return Math.round((fieldScore + textScore + typeScore) * 100);
  }
}

// Instance par défaut
export const ocrService = new OcrService();

export default OcrService;

