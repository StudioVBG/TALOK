/**
 * Service Stripe Connect pour les reversements aux propriétaires
 *
 * Permet aux propriétaires de recevoir les loyers directement sur leur compte bancaire
 * via Stripe Connect Express.
 */

import { getStripeCredentials } from "@/lib/services/credentials-service";

const STRIPE_API_URL = "https://api.stripe.com/v1";

// Types
export interface ConnectAccount {
  id: string;
  type: "express" | "standard" | "custom";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements?: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    disabled_reason: string | null;
  };
  business_type?: "individual" | "company";
  country: string;
  default_currency: string;
  external_accounts?: {
    data: Array<{
      id: string;
      last4: string;
      bank_name: string;
      currency: string;
    }>;
  };
}

export interface AccountLink {
  url: string;
  expires_at: number;
}

export interface Transfer {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  description?: string;
  source_transaction?: string;
  transfer_group?: string;
}

export interface PayoutSchedule {
  delay_days: number;
  interval: "manual" | "daily" | "weekly" | "monthly";
  weekly_anchor?: string;
  monthly_anchor?: number;
}

// Helpers
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
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        result[`${newKey}[${index}]`] = String(item);
      });
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
// ACCOUNTS
// ============================================

/**
 * Créer un compte Stripe Connect Express
 */
export async function createConnectAccount(params: {
  email: string;
  country?: string;
  businessType?: "individual" | "company";
  metadata?: Record<string, string>;
}): Promise<ConnectAccount> {
  return stripeRequest<ConnectAccount>("/accounts", "POST", {
    type: "express",
    country: params.country || "FR",
    email: params.email,
    business_type: params.businessType || "individual",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: params.metadata,
    settings: {
      payouts: {
        schedule: {
          interval: "daily", // Virements quotidiens
          delay_days: 2, // Délai minimum pour la France
        },
      },
    },
  });
}

/**
 * Récupérer un compte Stripe Connect
 */
export async function getConnectAccount(accountId: string): Promise<ConnectAccount> {
  return stripeRequest<ConnectAccount>(`/accounts/${accountId}`);
}

/**
 * Mettre à jour un compte Stripe Connect
 */
export async function updateConnectAccount(
  accountId: string,
  params: {
    email?: string;
    businessType?: "individual" | "company";
    metadata?: Record<string, string>;
  }
): Promise<ConnectAccount> {
  return stripeRequest<ConnectAccount>(`/accounts/${accountId}`, "POST", {
    email: params.email,
    business_type: params.businessType,
    metadata: params.metadata,
  });
}

/**
 * Supprimer un compte Stripe Connect
 */
export async function deleteConnectAccount(accountId: string): Promise<{ id: string; deleted: boolean }> {
  return stripeRequest(`/accounts/${accountId}`, "DELETE");
}

// ============================================
// ONBOARDING
// ============================================

/**
 * Créer un lien d'onboarding pour un compte Connect
 */
export async function createAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type?: "account_onboarding" | "account_update";
}): Promise<AccountLink> {
  return stripeRequest<AccountLink>("/account_links", "POST", {
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: params.type || "account_onboarding",
    collect: "eventually_due", // Collecter les infos nécessaires
  });
}

/**
 * Créer un lien de dashboard Express
 */
export async function createLoginLink(accountId: string): Promise<{ url: string }> {
  return stripeRequest<{ url: string }>(`/accounts/${accountId}/login_links`, "POST");
}

// ============================================
// TRANSFERS
// ============================================

/**
 * Créer un transfert vers un compte Connect
 * (pour envoyer les loyers aux propriétaires)
 */
export async function createTransfer(params: {
  amount: number; // en centimes
  destinationAccountId: string;
  currency?: string;
  description?: string;
  sourceTransaction?: string; // ID du payment_intent/charge source
  transferGroup?: string;
  metadata?: Record<string, string>;
}): Promise<Transfer> {
  return stripeRequest<Transfer>("/transfers", "POST", {
    amount: params.amount,
    currency: params.currency || "eur",
    destination: params.destinationAccountId,
    description: params.description,
    source_transaction: params.sourceTransaction,
    transfer_group: params.transferGroup,
    metadata: params.metadata,
  });
}

/**
 * Récupérer un transfert
 */
export async function getTransfer(transferId: string): Promise<Transfer> {
  return stripeRequest<Transfer>(`/transfers/${transferId}`);
}

/**
 * Lister les transferts d'un compte
 */
export async function listTransfers(params: {
  destinationAccountId?: string;
  limit?: number;
  startingAfter?: string;
}): Promise<{ data: Transfer[]; has_more: boolean }> {
  const query = new URLSearchParams();
  if (params.destinationAccountId) query.set("destination", params.destinationAccountId);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.startingAfter) query.set("starting_after", params.startingAfter);

  return stripeRequest<{ data: Transfer[]; has_more: boolean }>(
    `/transfers?${query.toString()}`
  );
}

/**
 * Annuler un transfert (créer un reversal)
 */
export async function reverseTransfer(
  transferId: string,
  amount?: number,
  description?: string
): Promise<{ id: string; amount: number; transfer: string }> {
  return stripeRequest(`/transfers/${transferId}/reversals`, "POST", {
    amount, // Si undefined, reverse le montant total
    description,
  });
}

// ============================================
// PAYMENT INTENTS WITH DESTINATION
// ============================================

/**
 * Créer un PaymentIntent avec destination vers un compte Connect
 * (paiement direct avec split)
 */
export async function createDestinationCharge(params: {
  amount: number;
  destinationAccountId: string;
  applicationFee?: number; // Commission Talok en centimes
  currency?: string;
  description?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  receiptEmail?: string;
}): Promise<{
  id: string;
  client_secret: string;
  status: string;
}> {
  const body: Record<string, any> = {
    amount: params.amount,
    currency: params.currency || "eur",
    description: params.description,
    customer: params.customerId,
    metadata: params.metadata,
    receipt_email: params.receiptEmail,
    automatic_payment_methods: { enabled: true },
    // Activation 3D Secure
    payment_method_options: {
      card: {
        request_three_d_secure: "any",
      },
    },
    // Destination: compte Connect du propriétaire
    transfer_data: {
      destination: params.destinationAccountId,
    },
  };

  // Si commission Talok spécifiée
  if (params.applicationFee && params.applicationFee > 0) {
    body.application_fee_amount = params.applicationFee;
  }

  return stripeRequest("/payment_intents", "POST", body);
}

// ============================================
// BALANCE
// ============================================

/**
 * Récupérer le solde d'un compte Connect
 */
export async function getAccountBalance(accountId: string): Promise<{
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}> {
  const apiKey = await getApiKey();

  const response = await fetch(`${STRIPE_API_URL}/balance`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Stripe-Account": accountId, // Header spécial pour accéder au compte Connect
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || `Erreur Stripe: ${response.status}`);
  }

  return data;
}

// ============================================
// PAYOUT SCHEDULE
// ============================================

/**
 * Mettre à jour le calendrier de paiement d'un compte
 */
export async function updatePayoutSchedule(
  accountId: string,
  schedule: PayoutSchedule
): Promise<ConnectAccount> {
  return stripeRequest<ConnectAccount>(`/accounts/${accountId}`, "POST", {
    settings: {
      payouts: {
        schedule: {
          interval: schedule.interval,
          delay_days: schedule.delay_days,
          weekly_anchor: schedule.weekly_anchor,
          monthly_anchor: schedule.monthly_anchor,
        },
      },
    },
  });
}

// ============================================
// HELPERS
// ============================================

/**
 * Vérifie si un compte est prêt à recevoir des paiements
 */
export function isAccountReady(account: ConnectAccount): boolean {
  return account.charges_enabled && account.payouts_enabled && account.details_submitted;
}

/**
 * Calcule les frais de la plateforme
 * Exemple: 2.5% de commission + 0.25€ fixe
 */
export function calculatePlatformFee(amount: number, rate = 0.025, fixedFee = 25): number {
  return Math.round(amount * rate + fixedFee);
}

/**
 * Calcule le montant net pour le propriétaire
 */
export function calculateNetAmount(
  amount: number,
  platformFee: number,
  stripeFee: number
): number {
  return amount - platformFee - stripeFee;
}

// ============================================
// EXPORT
// ============================================

export const connectService = {
  // Accounts
  createConnectAccount,
  getConnectAccount,
  updateConnectAccount,
  deleteConnectAccount,

  // Onboarding
  createAccountLink,
  createLoginLink,

  // Transfers
  createTransfer,
  getTransfer,
  listTransfers,
  reverseTransfer,

  // Payments
  createDestinationCharge,

  // Balance & Payouts
  getAccountBalance,
  updatePayoutSchedule,

  // Helpers
  isAccountReady,
  calculatePlatformFee,
  calculateNetAmount,
};
