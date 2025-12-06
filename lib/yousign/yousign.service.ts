/**
 * Module de compatibilité Yousign
 * Réexporte les fonctions depuis service.ts avec les noms attendus par le webhook
 */

import * as crypto from "crypto";
import { apiKeysService } from "@/lib/services/api-keys.service";

export * from "./service";

// ============================================
// CONFIGURATION
// ============================================

const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api.yousign.app/v3";
const YOUSIGN_WEBHOOK_SECRET = process.env.YOUSIGN_WEBHOOK_SECRET || "";

/**
 * Récupérer la clé API Yousign (depuis BDD ou env)
 */
async function getYousignApiKey(): Promise<string> {
  const key = await apiKeysService.getApiKey("yousign");
  
  if (!key) {
    // Fallback sur variable d'environnement
    if (process.env.YOUSIGN_API_KEY) {
      return process.env.YOUSIGN_API_KEY;
    }
    throw new Error(
      "Clé API Yousign non configurée. " +
      "Configurez-la dans Admin > Intégrations ou via YOUSIGN_API_KEY."
    );
  }
  
  return key;
}

/**
 * Vérifier la signature d'un webhook Yousign (alias pour compatibilité)
 * @param payload Le corps de la requête brut
 * @param signature La signature du header x-yousign-signature-256
 * @returns true si la signature est valide
 */
export async function verifyYousignWebhook(
  payload: string,
  signature: string
): Promise<boolean> {
  if (!YOUSIGN_WEBHOOK_SECRET) {
    console.warn("[Yousign] YOUSIGN_WEBHOOK_SECRET non configuré, vérification ignorée");
    return true;
  }

  const hmac = crypto.createHmac("sha256", YOUSIGN_WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    // Si les longueurs sont différentes, timingSafeEqual lance une erreur
    return false;
  }
}

/**
 * Télécharger tous les documents signés d'une procédure
 * Version simplifiée qui ne nécessite pas le documentId
 * @param signatureRequestId L'ID de la procédure de signature
 * @returns Le buffer du document PDF signé ou null
 */
export async function downloadSignedDocument(
  signatureRequestId: string
): Promise<Buffer | null> {
  try {
    const apiKey = await getYousignApiKey();

    // D'abord récupérer la liste des documents
    const requestResponse = await fetch(
      `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!requestResponse.ok) {
      console.error("[Yousign] Erreur récupération procédure:", requestResponse.status);
      return null;
    }

    const requestData = await requestResponse.json();
    const documents = requestData.documents || [];

    if (documents.length === 0) {
      console.warn("[Yousign] Aucun document trouvé dans la procédure");
      return null;
    }

    // Télécharger le premier document signable
    const signableDoc = documents.find((d: any) => d.nature === "signable_document");
    if (!signableDoc) {
      console.warn("[Yousign] Aucun document signable trouvé");
      return null;
    }

    const downloadResponse = await fetch(
      `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents/${signableDoc.id}/download`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      console.error("[Yousign] Erreur téléchargement document:", downloadResponse.status);
      return null;
    }

    return Buffer.from(await downloadResponse.arrayBuffer());
  } catch (error) {
    console.error("[Yousign] Erreur downloadSignedDocument:", error);
    return null;
  }
}

