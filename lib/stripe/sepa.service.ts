/**
 * Service Stripe SEPA pour les prélèvements automatiques
 */

import { getStripeCredentials } from "@/lib/services/credentials-service";

const STRIPE_API_URL = "https://api.stripe.com/v1";

interface StripeCustomer {
  id: string;
  email: string;
  name: string;
}

interface StripePaymentMethod {
  id: string;
  type: string;
  sepa_debit?: {
    bank_code: string;
    branch_code: string;
    country: string;
    fingerprint: string;
    last4: string;
  };
}

interface StripeMandate {
  id: string;
  status: string;
  type: string;
  payment_method: string;
}

interface SetupIntent {
  id: string;
  client_secret: string;
  status: string;
  payment_method?: string;
  mandate?: string;
}

async function getApiKey(): Promise<string> {
  const credentials = await getStripeCredentials();
  if (credentials?.secretKey) {
    return credentials.secretKey;
  }
  const envKey = process.env.STRIPE_SECRET_KEY;
  if (!envKey) {
    throw new Error("Clé API Stripe non configurée");
  }
  return envKey;
}

function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else {
      result[newKey] = String(value);
    }
  }
  return result;
}

async function stripeRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, any>
): Promise<T> {
  const apiKey = await getApiKey();

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

  return data as T;
}

// ============================================
// CUSTOMERS
// ============================================

export async function createOrGetCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<StripeCustomer> {
  // Chercher un client existant
  const existing = await stripeRequest<{ data: StripeCustomer[] }>(
    `/customers?email=${encodeURIComponent(email)}&limit=1`
  );

  if (existing.data.length > 0) {
    return existing.data[0];
  }

  // Créer un nouveau client
  return stripeRequest<StripeCustomer>("/customers", "POST", {
    email,
    name,
    metadata,
  });
}

// ============================================
// SEPA SETUP
// ============================================

/**
 * Créer un SetupIntent pour configurer un mandat SEPA
 */
export async function createSepaSetupIntent(
  customerId: string,
  metadata?: Record<string, string>
): Promise<SetupIntent> {
  return stripeRequest<SetupIntent>("/setup_intents", "POST", {
    customer: customerId,
    payment_method_types: ["sepa_debit"],
    usage: "off_session",
    metadata,
  });
}

/**
 * Récupérer un SetupIntent
 */
export async function getSetupIntent(setupIntentId: string): Promise<SetupIntent> {
  return stripeRequest<SetupIntent>(`/setup_intents/${setupIntentId}`);
}

/**
 * Confirmer un SetupIntent avec l'IBAN
 */
export async function confirmSepaSetupIntent(
  setupIntentId: string,
  iban: string,
  accountHolderName: string,
  email: string
): Promise<SetupIntent> {
  // Créer la méthode de paiement
  const paymentMethod = await stripeRequest<StripePaymentMethod>(
    "/payment_methods",
    "POST",
    {
      type: "sepa_debit",
      sepa_debit: { iban },
      billing_details: {
        name: accountHolderName,
        email,
      },
    }
  );

  // Confirmer le SetupIntent
  return stripeRequest<SetupIntent>(
    `/setup_intents/${setupIntentId}/confirm`,
    "POST",
    {
      payment_method: paymentMethod.id,
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: "127.0.0.1", // À remplacer par l'IP réelle
            user_agent: "Talok/1.0",
          },
        },
      },
    }
  );
}

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * Lister les méthodes de paiement SEPA d'un client
 */
export async function listSepaPaymentMethods(
  customerId: string
): Promise<StripePaymentMethod[]> {
  const response = await stripeRequest<{ data: StripePaymentMethod[] }>(
    `/payment_methods?customer=${customerId}&type=sepa_debit`
  );
  return response.data;
}

/**
 * Détacher une méthode de paiement
 */
export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await stripeRequest(`/payment_methods/${paymentMethodId}/detach`, "POST");
}

// ============================================
// MANDATES
// ============================================

/**
 * Récupérer un mandat Stripe
 */
export async function getMandate(mandateId: string): Promise<StripeMandate> {
  return stripeRequest<StripeMandate>(`/mandates/${mandateId}`);
}

// ============================================
// PRÉLÈVEMENTS
// ============================================

export interface CreateSepaPaymentParams {
  customerId: string;
  paymentMethodId: string;
  amount: number; // en centimes
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  mandateId?: string;
}

/**
 * Créer un prélèvement SEPA
 */
export async function createSepaPayment(
  params: CreateSepaPaymentParams
): Promise<{
  id: string;
  status: string;
  amount: number;
}> {
  const paymentIntent = await stripeRequest<{
    id: string;
    status: string;
    amount: number;
  }>("/payment_intents", "POST", {
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    amount: params.amount,
    currency: params.currency || "eur",
    payment_method_types: ["sepa_debit"],
    confirm: true,
    off_session: true,
    description: params.description,
    metadata: params.metadata,
    mandate: params.mandateId,
  });

  return paymentIntent;
}

/**
 * Vérifier le statut d'un prélèvement
 */
export async function getPaymentStatus(paymentIntentId: string): Promise<{
  id: string;
  status: string;
  amount: number;
  last_payment_error?: {
    code: string;
    message: string;
  };
}> {
  return stripeRequest(`/payment_intents/${paymentIntentId}`);
}

// ============================================
// REMBOURSEMENTS
// ============================================

/**
 * Rembourser un prélèvement
 */
export async function refundSepaPayment(
  paymentIntentId: string,
  amount?: number, // en centimes, undefined = total
  reason?: "duplicate" | "fraudulent" | "requested_by_customer"
): Promise<{
  id: string;
  status: string;
  amount: number;
}> {
  return stripeRequest("/refunds", "POST", {
    payment_intent: paymentIntentId,
    amount,
    reason,
  });
}

// ============================================
// WEBHOOKS
// ============================================

export type SepaEventType =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "setup_intent.succeeded"
  | "setup_intent.setup_failed"
  | "mandate.updated"
  | "charge.dispute.created";

export interface SepaWebhookEvent {
  id: string;
  type: SepaEventType;
  data: {
    object: any;
  };
}

/**
 * Vérifier la signature d'un webhook Stripe
 */
export async function verifySepaWebhook(
  payload: string,
  signature: string
): Promise<SepaWebhookEvent | null> {
  const credentials = await getStripeCredentials();
  const webhookSecret = credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn("Webhook secret non configuré");
    return JSON.parse(payload) as SepaWebhookEvent;
  }

  // Vérifier la signature
  const crypto = await import("crypto");
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const v1 = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !v1) {
    throw new Error("Signature invalide");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  if (v1 !== expectedSig) {
    throw new Error("Signature ne correspond pas");
  }

  return JSON.parse(payload) as SepaWebhookEvent;
}

// ============================================
// EXPORT
// ============================================

export const sepaService = {
  createOrGetCustomer,
  createSepaSetupIntent,
  getSetupIntent,
  confirmSepaSetupIntent,
  listSepaPaymentMethods,
  detachPaymentMethod,
  getMandate,
  createSepaPayment,
  getPaymentStatus,
  refundSepaPayment,
  verifySepaWebhook,
};







