/**
 * Service de paiement via Stripe
 * 
 * Gère les paiements de loyers, dépôts de garantie, etc.
 * Récupère automatiquement les credentials depuis la DB (Admin > Intégrations)
 */

import { getStripeCredentials } from "./credentials-service";

// Types
export interface PaymentIntent {
  amount: number; // En centimes
  currency?: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  receiptEmail?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  status?: string;
  error?: string;
}

export interface CustomerData {
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
}

export interface CustomerResult {
  success: boolean;
  customerId?: string;
  error?: string;
}

// Configuration
const STRIPE_API_URL = "https://api.stripe.com/v1";

/**
 * Récupère la clé secrète Stripe
 */
async function getApiKey(): Promise<string | null> {
  const credentials = await getStripeCredentials();
  if (credentials?.secretKey) {
    return credentials.secretKey;
  }
  return process.env.STRIPE_SECRET_KEY || null;
}

/**
 * Effectue une requête vers l'API Stripe
 */
async function stripeRequest(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, any>
): Promise<any> {
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    throw new Error("Stripe n'est pas configuré. Ajoutez votre clé API dans Admin > Intégrations.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };

  let requestBody: string | undefined;
  
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = new URLSearchParams(flattenObject(body)).toString();
  }

  const response = await fetch(`${STRIPE_API_URL}${endpoint}`, {
    method,
    headers,
    body: requestBody,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Erreur Stripe: ${response.status}`);
  }

  return data;
}

/**
 * Aplatit un objet pour les paramètres URL
 */
function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    
    if (value === undefined || value === null) continue;
    
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "object") {
          Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
        } else {
          result[`${newKey}[${index}]`] = String(item);
        }
      });
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

/**
 * Crée un PaymentIntent pour un paiement
 * Active 3D Secure (SCA) pour conformité PSD2/DSP2
 */
export async function createPaymentIntent(
  options: PaymentIntent
): Promise<PaymentResult> {
  try {
    const data = await stripeRequest("/payment_intents", "POST", {
      amount: options.amount,
      currency: options.currency || "eur",
      customer: options.customerId,
      description: options.description,
      metadata: options.metadata,
      receipt_email: options.receiptEmail,
      automatic_payment_methods: { enabled: true },
      // Activation 3D Secure (SCA) - Conformité PSD2/DSP2
      payment_method_options: {
        card: {
          request_three_d_secure: "any", // Demande 3DS pour toutes les cartes éligibles
        },
      },
    });

    return {
      success: true,
      paymentIntentId: data.id,
      clientSecret: data.client_secret,
      status: data.status,
    };
  } catch (error: unknown) {
    console.error("[Stripe] Erreur création PaymentIntent:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Confirme un paiement
 */
export async function confirmPayment(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<PaymentResult> {
  try {
    const data = await stripeRequest(`/payment_intents/${paymentIntentId}/confirm`, "POST", {
      payment_method: paymentMethodId,
    });

    return {
      success: true,
      paymentIntentId: data.id,
      status: data.status,
    };
  } catch (error: unknown) {
    console.error("[Stripe] Erreur confirmation:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Récupère le statut d'un paiement
 */
export async function getPaymentStatus(paymentIntentId: string): Promise<PaymentResult> {
  try {
    const data = await stripeRequest(`/payment_intents/${paymentIntentId}`);

    return {
      success: true,
      paymentIntentId: data.id,
      status: data.status,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Crée un client Stripe
 */
export async function createCustomer(customer: CustomerData): Promise<CustomerResult> {
  try {
    const data = await stripeRequest("/customers", "POST", {
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      address: customer.address ? {
        line1: customer.address.line1,
        line2: customer.address.line2,
        city: customer.address.city,
        postal_code: customer.address.postalCode,
        country: customer.address.country || "FR",
      } : undefined,
      metadata: customer.metadata,
    });

    return {
      success: true,
      customerId: data.id,
    };
  } catch (error: unknown) {
    console.error("[Stripe] Erreur création client:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Récupère un client Stripe par email
 */
export async function findCustomerByEmail(email: string): Promise<CustomerResult> {
  try {
    const data = await stripeRequest(`/customers?email=${encodeURIComponent(email)}`);

    if (data.data && data.data.length > 0) {
      return {
        success: true,
        customerId: data.data[0].id,
      };
    }

    return {
      success: true,
      customerId: undefined,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Crée un remboursement
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number, // En centimes, undefined = remboursement total
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
): Promise<{
  success: boolean;
  refundId?: string;
  status?: string;
  error?: string;
}> {
  try {
    const data = await stripeRequest("/refunds", "POST", {
      payment_intent: paymentIntentId,
      amount,
      reason,
    });

    return {
      success: true,
      refundId: data.id,
      status: data.status,
    };
  } catch (error: unknown) {
    console.error("[Stripe] Erreur remboursement:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Vérifie la signature d'un webhook Stripe
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string
): Promise<{ success: boolean; event?: any; error?: string }> {
  try {
    const credentials = await getStripeCredentials();
    const webhookSecret = credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return {
        success: false,
        error: "Webhook secret non configuré",
      };
    }

    // Vérification simplifiée de la signature
    const timestamp = signature.split(",").find(s => s.startsWith("t="))?.split("=")[1];
    const v1Signature = signature.split(",").find(s => s.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !v1Signature) {
      return {
        success: false,
        error: "Signature invalide",
      };
    }

    const crypto = await import("crypto");
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");

    if (v1Signature !== expectedSignature) {
      return {
        success: false,
        error: "Signature ne correspond pas",
      };
    }

    return {
      success: true,
      event: JSON.parse(payload),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error.message,
    };
  }
}
