/**
 * Service de signature électronique via Yousign
 * 
 * Gère la création de procédures de signature et le suivi des signatures
 * Récupère automatiquement les credentials depuis la DB (Admin > Intégrations)
 */

import { getYousignCredentials } from "./credentials-service";

// Types
export interface YousignSigner {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  locale?: "fr" | "en";
}

export interface YousignDocument {
  name: string;
  content: string; // Base64 encoded
  contentType?: string;
}

export interface SignatureRequest {
  name: string;
  documents: YousignDocument[];
  signers: YousignSigner[];
  deliveryMode?: "email" | "none";
  orderedSigners?: boolean;
  expirationDate?: string;
  customExperience?: {
    redirectUrls?: {
      success?: string;
      error?: string;
    };
  };
}

export interface SignatureResult {
  success: boolean;
  requestId?: string;
  signers?: { id: string; email: string; signUrl?: string }[];
  error?: string;
}

// Configuration
const YOUSIGN_API_URL = process.env.YOUSIGN_API_URL || "https://api.yousign.app/v3";
const YOUSIGN_SANDBOX = process.env.YOUSIGN_SANDBOX === "true";

/**
 * Récupère la clé API Yousign
 */
async function getApiKey(): Promise<string | null> {
  // Essayer de récupérer depuis la DB
  const credentials = await getYousignCredentials();
  if (credentials?.apiKey) {
    return credentials.apiKey;
  }
  
  // Fallback sur l'environnement
  return process.env.YOUSIGN_API_KEY || null;
}

/**
 * Crée une demande de signature
 */
export async function createSignatureRequest(
  request: SignatureRequest
): Promise<SignatureResult> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: "Yousign n'est pas configuré. Ajoutez votre clé API dans Admin > Intégrations.",
    };
  }

  try {
    // 1. Créer la signature request
    const signatureRequestResponse = await fetch(`${YOUSIGN_API_URL}/signature_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: request.name,
        delivery_mode: request.deliveryMode || "email",
        ordered_signers: request.orderedSigners || false,
        expiration_date: request.expirationDate,
        custom_experience_id: undefined, // Optionnel
      }),
    });

    if (!signatureRequestResponse.ok) {
      const error = await signatureRequestResponse.json();
      return {
        success: false,
        error: error.detail || error.message || "Erreur création demande",
      };
    }

    const signatureRequest = await signatureRequestResponse.json();
    const requestId = signatureRequest.id;

    // 2. Ajouter les documents
    for (const doc of request.documents) {
      const documentResponse = await fetch(`${YOUSIGN_API_URL}/signature_requests/${requestId}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          name: doc.name,
          file_content: doc.content,
          file_name: doc.name,
        }),
      });

      if (!documentResponse.ok) {
        const error = await documentResponse.json();
        return {
          success: false,
          error: `Erreur ajout document: ${error.detail || error.message}`,
        };
      }
    }

    // 3. Ajouter les signataires
    const addedSigners: { id: string; email: string; signUrl?: string }[] = [];

    for (const signer of request.signers) {
      const signerResponse = await fetch(`${YOUSIGN_API_URL}/signature_requests/${requestId}/signers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          info: {
            first_name: signer.firstName,
            last_name: signer.lastName,
            email: signer.email,
            phone_number: signer.phone,
            locale: signer.locale || "fr",
          },
          signature_authentication_mode: signer.phone ? "otp_sms" : "no_otp",
        }),
      });

      if (!signerResponse.ok) {
        const error = await signerResponse.json();
        return {
          success: false,
          error: `Erreur ajout signataire: ${error.detail || error.message}`,
        };
      }

      const addedSigner = await signerResponse.json();
      addedSigners.push({
        id: addedSigner.id,
        email: signer.email,
      });
    }

    // 4. Activer la demande de signature
    const activateResponse = await fetch(`${YOUSIGN_API_URL}/signature_requests/${requestId}/activate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!activateResponse.ok) {
      const error = await activateResponse.json();
      return {
        success: false,
        error: `Erreur activation: ${error.detail || error.message}`,
      };
    }

    return {
      success: true,
      requestId,
      signers: addedSigners,
    };
  } catch (error: any) {
    console.error("[Yousign] Erreur:", error);
    return {
      success: false,
      error: error.message || "Erreur inattendue",
    };
  }
}

/**
 * Récupère le statut d'une demande de signature
 */
export async function getSignatureRequestStatus(requestId: string): Promise<{
  success: boolean;
  status?: string;
  signers?: { id: string; status: string; signedAt?: string }[];
  error?: string;
}> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: "Yousign n'est pas configuré.",
    };
  }

  try {
    const response = await fetch(`${YOUSIGN_API_URL}/signature_requests/${requestId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.detail || error.message,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      status: data.status,
      signers: data.signers?.map((s: any) => ({
        id: s.id,
        status: s.status,
        signedAt: s.signature_date,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Télécharge le document signé
 */
export async function downloadSignedDocument(requestId: string): Promise<{
  success: boolean;
  content?: Buffer;
  error?: string;
}> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: "Yousign n'est pas configuré.",
    };
  }

  try {
    const response = await fetch(
      `${YOUSIGN_API_URL}/signature_requests/${requestId}/documents/download`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.detail || error.message,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    
    return {
      success: true,
      content: buffer,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Annule une demande de signature
 */
export async function cancelSignatureRequest(requestId: string, reason?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: "Yousign n'est pas configuré.",
    };
  }

  try {
    const response = await fetch(`${YOUSIGN_API_URL}/signature_requests/${requestId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        reason: reason || "cancelled_by_owner",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.detail || error.message,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

