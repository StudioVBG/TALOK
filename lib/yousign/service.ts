/**
 * Service Yousign pour les signatures électroniques
 * Documentation API: https://developers.yousign.com/
 * 
 * Les clés API sont gérées dynamiquement via Admin > Intégrations
 */

import type {
  YousignSignatureRequest,
  YousignSigner,
  YousignDocument,
  YousignField,
  CreateSignerDTO,
} from "./types";
import { apiKeysService } from "@/lib/services/api-keys.service";

// ============================================
// CONFIGURATION
// ============================================

const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api.yousign.app/v3";
const YOUSIGN_WEBHOOK_SECRET = process.env.YOUSIGN_WEBHOOK_SECRET || "";

// ============================================
// HELPERS
// ============================================

/**
 * Récupérer la clé API Yousign (depuis BDD ou env)
 */
async function getYousignApiKey(): Promise<string> {
  const key = await apiKeysService.getApiKey("yousign");
  
  if (!key) {
    throw new Error(
      "Clé API Yousign non configurée. " +
      "Configurez-la dans Admin > Intégrations ou via YOUSIGN_API_KEY."
    );
  }
  
  return key;
}

async function yousignFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = await getYousignApiKey();
  const url = `${YOUSIGN_API_URL}${endpoint}`;
  const startTime = Date.now();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const responseTime = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    console.error(`[Yousign] Erreur API ${endpoint} (${responseTime}ms):`, error);
    throw new Error(`Yousign API Error: ${error.message || response.statusText}`);
  }

  console.log(`[Yousign] Appel ${endpoint} réussi (${responseTime}ms)`);
  return response.json();
}

// ============================================
// SIGNATURE REQUESTS
// ============================================

export interface CreateYousignRequestParams {
  name: string;
  externalId?: string;
  orderedSigners?: boolean;
  reminderSettings?: {
    intervalInDays: number;
    maxOccurrences: number;
  };
  expirationDate?: string;
  customExperienceId?: string;
}

/**
 * Créer une nouvelle procédure de signature
 */
export async function createSignatureRequest(
  params: CreateYousignRequestParams
): Promise<YousignSignatureRequest> {
  return yousignFetch<YousignSignatureRequest>("/signature_requests", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      delivery_mode: "email",
      ordered_signers: params.orderedSigners ?? false,
      timezone: "Europe/Paris",
      external_id: params.externalId,
      expiration_date: params.expirationDate,
      custom_experience_id: params.customExperienceId,
      reminder_settings: params.reminderSettings ? {
        interval_in_days: params.reminderSettings.intervalInDays,
        max_occurrences: params.reminderSettings.maxOccurrences,
      } : undefined,
    }),
  });
}

/**
 * Récupérer une procédure de signature
 */
export async function getSignatureRequest(
  signatureRequestId: string
): Promise<YousignSignatureRequest> {
  return yousignFetch<YousignSignatureRequest>(`/signature_requests/${signatureRequestId}`);
}

/**
 * Activer une procédure (envoyer aux signataires)
 */
export async function activateSignatureRequest(
  signatureRequestId: string
): Promise<YousignSignatureRequest> {
  return yousignFetch<YousignSignatureRequest>(
    `/signature_requests/${signatureRequestId}/activate`,
    { method: "POST" }
  );
}

/**
 * Annuler une procédure
 */
export async function cancelSignatureRequest(
  signatureRequestId: string,
  reason?: string
): Promise<void> {
  await yousignFetch(`/signature_requests/${signatureRequestId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Annulé par l'utilisateur" }),
  });
}

// ============================================
// DOCUMENTS
// ============================================

/**
 * Ajouter un document à une procédure
 */
export async function addDocument(
  signatureRequestId: string,
  documentBase64: string,
  filename: string
): Promise<YousignDocument> {
  return yousignFetch<YousignDocument>(
    `/signature_requests/${signatureRequestId}/documents`,
    {
      method: "POST",
      body: JSON.stringify({
        nature: "signable_document",
        content: documentBase64,
        filename,
      }),
    }
  );
}

/**
 * Télécharger le document signé
 */
export async function downloadSignedDocumentById(
  signatureRequestId: string,
  documentId: string
): Promise<Buffer> {
  const apiKey = await getYousignApiKey();
  const response = await fetch(
    `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/documents/${documentId}/download`,
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Erreur lors du téléchargement du document signé");
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Télécharger le journal des preuves (audit trail)
 */
export async function downloadAuditTrail(
  signatureRequestId: string
): Promise<Buffer> {
  const apiKey = await getYousignApiKey();
  const response = await fetch(
    `${YOUSIGN_API_URL}/signature_requests/${signatureRequestId}/audit_trails/download`,
    {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Erreur lors du téléchargement du journal des preuves");
  }

  return Buffer.from(await response.arrayBuffer());
}

// ============================================
// SIGNERS
// ============================================

/**
 * Ajouter un signataire à une procédure
 */
export async function addSigner(
  signatureRequestId: string,
  signer: CreateSignerDTO,
  documentId: string,
  fields: Omit<YousignField, "document_id">[]
): Promise<YousignSigner> {
  const signerData: YousignSigner = {
    info: {
      first_name: signer.first_name,
      last_name: signer.last_name,
      email: signer.email,
      phone_number: signer.phone,
      locale: "fr",
    },
    signature_level: signer.signature_level || "electronic_signature",
    signature_authentication_mode: signer.phone ? "otp_sms" : "otp_email",
    redirect_urls: {
      success: `${process.env.NEXT_PUBLIC_APP_URL}/signature/success`,
      error: `${process.env.NEXT_PUBLIC_APP_URL}/signature/error`,
    },
    fields: fields.map(f => ({ ...f, document_id: documentId })),
  };

  return yousignFetch<YousignSigner>(
    `/signature_requests/${signatureRequestId}/signers`,
    {
      method: "POST",
      body: JSON.stringify(signerData),
    }
  );
}

/**
 * Envoyer un rappel à un signataire
 */
export async function sendSignerReminder(
  signatureRequestId: string,
  signerId: string
): Promise<void> {
  await yousignFetch(
    `/signature_requests/${signatureRequestId}/signers/${signerId}/send_reminder`,
    { method: "POST" }
  );
}

// ============================================
// WEBHOOKS
// ============================================

import * as crypto from "crypto";

/**
 * Vérifier la signature d'un webhook Yousign
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!YOUSIGN_WEBHOOK_SECRET) {
    console.warn("YOUSIGN_WEBHOOK_SECRET non configuré, vérification ignorée");
    return true;
  }

  const hmac = crypto.createHmac("sha256", YOUSIGN_WEBHOOK_SECRET);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Calculer la position des champs de signature sur un PDF
 * (positions par défaut pour un bail standard)
 */
export function getDefaultSignaturePositions(
  documentId: string,
  signerIndex: number,
  totalSigners: number
): YousignField[] {
  // Position de base pour la signature (en bas à droite de la dernière page)
  const baseX = 350;
  const baseY = 700 - (signerIndex * 80); // Espacer verticalement les signatures
  
  return [
    {
      type: "signature",
      document_id: documentId,
      page: 1, // Dernière page (à ajuster selon le document)
      x: baseX,
      y: baseY,
      width: 150,
      height: 50,
    },
    {
      type: "mention",
      document_id: documentId,
      page: 1,
      x: baseX,
      y: baseY + 55,
      mention: "Lu et approuvé",
    },
  ];
}

/**
 * Formater le nom du document pour l'archivage
 */
export function formatDocumentName(
  type: string,
  entityName: string,
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().split("T")[0];
  const sanitized = entityName.replace(/[^a-zA-Z0-9]/g, "_");
  return `${dateStr}_${type}_${sanitized}_Signe.pdf`;
}

