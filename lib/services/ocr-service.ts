/**
 * Service OCR pour l'extraction de données des documents d'identité
 * Support : Mindee API (recommandé) ou Google Cloud Vision
 */

import { getCredentials } from "./credentials-service";
import { logger } from "@/lib/monitoring";

// Types pour les données extraites d'une CNI
export interface CNIData {
  firstName: string;
  lastName: string;
  birthDate: string;
  birthPlace?: string;
  documentNumber: string;
  expiryDate?: string;
  nationality?: string;
  gender?: string;
  address?: string;
  mrz?: string[];
  confidence: number;
  raw?: Record<string, any>;
}

export interface OCRResult {
  success: boolean;
  data?: CNIData;
  error?: string;
  provider: "mindee" | "google" | "simulated";
}

/**
 * Extrait les données d'une CNI française via Mindee
 */
async function extractWithMindee(
  imageBase64: string,
  apiKey: string
): Promise<OCRResult> {
  try {
    const response = await fetch(
      "https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document: imageBase64,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error("Mindee API error", { status: response.status, error });
      return {
        success: false,
        error: `Mindee API error: ${response.status}`,
        provider: "mindee",
      };
    }

    const result = await response.json();
    const prediction = result.document?.inference?.prediction;

    if (!prediction) {
      return {
        success: false,
        error: "No prediction in Mindee response",
        provider: "mindee",
      };
    }

    // Extraire les données structurées
    const data: CNIData = {
      firstName: prediction.given_names?.map((n: any) => n.value).join(" ") || "",
      lastName: prediction.surname?.value || "",
      birthDate: prediction.birth_date?.value || "",
      birthPlace: prediction.birth_place?.value || "",
      documentNumber: prediction.id_number?.value || "",
      expiryDate: prediction.expiry_date?.value || "",
      nationality: prediction.nationality?.value || "FR",
      gender: prediction.gender?.value || "",
      mrz: prediction.mrz1 && prediction.mrz2 
        ? [prediction.mrz1.value, prediction.mrz2.value] 
        : undefined,
      confidence: prediction.id_number?.confidence || 0,
      raw: prediction,
    };

    logger.info("Mindee OCR successful", { 
      documentNumber: data.documentNumber?.slice(0, 4) + "****",
      confidence: data.confidence,
    });

    return {
      success: true,
      data,
      provider: "mindee",
    };
  } catch (error) {
    logger.error("Mindee OCR failed", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "mindee",
    };
  }
}

/**
 * Extrait les données via Google Cloud Vision (fallback)
 */
async function extractWithGoogleVision(
  imageBase64: string,
  apiKey: string
): Promise<OCRResult> {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64.replace(/^data:image\/\w+;base64,/, "") },
              features: [
                { type: "TEXT_DETECTION" },
                { type: "DOCUMENT_TEXT_DETECTION" },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Google Vision API error: ${response.status}`,
        provider: "google",
      };
    }

    const result = await response.json();
    const textAnnotations = result.responses?.[0]?.textAnnotations;

    if (!textAnnotations || textAnnotations.length === 0) {
      return {
        success: false,
        error: "No text detected",
        provider: "google",
      };
    }

    // Parser le texte brut pour extraire les données CNI
    const fullText = textAnnotations[0].description;
    const data = parseCNIText(fullText);

    return {
      success: true,
      data,
      provider: "google",
    };
  } catch (error) {
    logger.error("Google Vision OCR failed", { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      provider: "google",
    };
  }
}

/**
 * Parse le texte brut d'une CNI française (fallback pour Google Vision)
 */
function parseCNIText(text: string): CNIData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  
  // Regex patterns pour CNI française
  const patterns = {
    lastName: /NOM[:\s]+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s-]+)/i,
    firstName: /PRÉNOM[S]?[:\s]+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s-]+)/i,
    birthDate: /NÉ[E]?\s+LE[:\s]+(\d{2}[./-]\d{2}[./-]\d{4})/i,
    birthPlace: /À[:\s]+([A-ZÀÂÄÉÈÊËÏÎÔÙÛÜŸŒÆÇ\s-]+)/i,
    documentNumber: /(\d{12}|\d{9}[A-Z]{2}\d)/,
    expiryDate: /VALIDE?\s+JUSQU'AU[:\s]+(\d{2}[./-]\d{2}[./-]\d{4})/i,
    mrz: /([A-Z0-9<]{30,44})/g,
  };

  const extract = (pattern: RegExp): string => {
    const match = text.match(pattern);
    return match ? match[1].trim() : "";
  };

  // Chercher les lignes MRZ (en bas du document)
  const mrzLines = text.match(/[A-Z0-9<]{30,44}/g) || [];

  return {
    lastName: extract(patterns.lastName),
    firstName: extract(patterns.firstName),
    birthDate: extract(patterns.birthDate),
    birthPlace: extract(patterns.birthPlace),
    documentNumber: extract(patterns.documentNumber),
    expiryDate: extract(patterns.expiryDate),
    mrz: mrzLines.length >= 2 ? mrzLines.slice(-2) : undefined,
    confidence: 0.6, // Confiance plus basse pour le parsing manuel
  };
}

/**
 * Simulation OCR pour le développement/tests
 */
function simulateOCR(): OCRResult {
  logger.info("Using simulated OCR (no API key configured)");
  
  return {
    success: true,
    data: {
      firstName: "",
      lastName: "",
      birthDate: "",
      documentNumber: "",
      confidence: 0,
    },
    provider: "simulated",
  };
}

/**
 * Fonction principale : extrait les données d'une CNI
 * Utilise Mindee si configuré, sinon Google Vision, sinon simulation
 */
export async function extractCNIData(imageBase64: string): Promise<OCRResult> {
  // Essayer Mindee d'abord (meilleur pour les CNI françaises)
  const mindeeCredentials = await getCredentials("Mindee");
  if (mindeeCredentials?.apiKey) {
    const result = await extractWithMindee(imageBase64, mindeeCredentials.apiKey);
    if (result.success) return result;
    logger.warn("Mindee failed, trying Google Vision fallback");
  }

  // Fallback sur Google Vision
  const googleCredentials = await getCredentials("Google Maps"); // Utilise la même clé API Google
  if (googleCredentials?.apiKey) {
    const result = await extractWithGoogleVision(imageBase64, googleCredentials.apiKey);
    if (result.success) return result;
  }

  // Mode simulation si aucune API disponible
  return simulateOCR();
}

/**
 * Vérifie si le service OCR est configuré
 */
export async function isOCRConfigured(): Promise<boolean> {
  const mindee = await getCredentials("Mindee");
  const google = await getCredentials("Google Maps");
  return !!(mindee?.apiKey || google?.apiKey);
}

export default { extractCNIData, isOCRConfigured };

