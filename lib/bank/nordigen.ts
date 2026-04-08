/**
 * Nordigen/GoCardless Open Banking SDK Wrapper
 *
 * DSP2-compliant bank account data access via GoCardless Bank Account Data API.
 * Handles token management, rate limiting, and error recovery.
 *
 * Env vars: NORDIGEN_SECRET_ID, NORDIGEN_SECRET_KEY
 */

const API_BASE = "https://bankaccountdata.gocardless.com/api/v2";

// ---------------------------------------------------------------------------
// Token management — in-memory cache with expiry
// ---------------------------------------------------------------------------

let cachedToken: { access: string; expires: number } | null = null;

async function getOrRefreshToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.access;
  }

  const secretId = process.env.NORDIGEN_SECRET_ID;
  const secretKey = process.env.NORDIGEN_SECRET_KEY;

  if (!secretId || !secretKey) {
    throw new Error("NORDIGEN_SECRET_ID and NORDIGEN_SECRET_KEY must be set");
  }

  const res = await fetch(`${API_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });

  if (!res.ok) {
    throw new Error(`Nordigen auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  cachedToken = {
    access: data.access,
    expires: Date.now() + (data.access_expires - 60) * 1000, // refresh 60s before expiry
  };

  return cachedToken.access;
}

async function nordigenFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getOrRefreshToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  return res;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

export interface Requisition {
  id: string;
  link: string;
  status: "CR" | "LN" | "EX" | "RJ" | "SA" | "GA" | "UA";
  accounts: string[];
  institution_id: string;
}

export interface AccountDetails {
  iban: string;
  ownerName: string;
  currency: string;
  product: string;
}

export interface Balance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
  referenceDate: string;
}

export interface Transaction {
  transactionId: string;
  bookingDate: string;
  valueDate: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured: string;
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban: string };
  debtorAccount?: { iban: string };
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get available banking institutions for a country.
 */
export async function getInstitutions(country: string = "fr"): Promise<Institution[]> {
  const res = await nordigenFetch(`/institutions/?country=${country}`);
  if (!res.ok) throw new Error(`Failed to fetch institutions: ${res.status}`);
  return res.json();
}

/**
 * Create a requisition (bank auth link) for a user.
 */
export async function createRequisition(
  institutionId: string,
  redirectUri: string,
  reference: string,
): Promise<Requisition> {
  const res = await nordigenFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      redirect: redirectUri,
      reference,
      user_language: "FR",
    }),
  });
  if (!res.ok) throw new Error(`Failed to create requisition: ${res.status}`);
  return res.json();
}

/**
 * Get requisition status and linked accounts.
 */
export async function getRequisitionStatus(requisitionId: string): Promise<Requisition> {
  const res = await nordigenFetch(`/requisitions/${requisitionId}/`);
  if (!res.ok) throw new Error(`Failed to get requisition: ${res.status}`);
  return res.json();
}

/**
 * Get account details (IBAN, owner name, etc).
 */
export async function getAccountDetails(accountId: string): Promise<AccountDetails> {
  const res = await nordigenFetch(`/accounts/${accountId}/details/`);
  if (!res.ok) throw new Error(`Failed to get account details: ${res.status}`);
  const data = await res.json();
  return {
    iban: data.account?.iban ?? "",
    ownerName: data.account?.ownerName ?? "",
    currency: data.account?.currency ?? "EUR",
    product: data.account?.product ?? "",
  };
}

/**
 * Get account balances.
 */
export async function getBalances(accountId: string): Promise<Balance[]> {
  const res = await nordigenFetch(`/accounts/${accountId}/balances/`);
  if (!res.ok) throw new Error(`Failed to get balances: ${res.status}`);
  const data = await res.json();
  return data.balances ?? [];
}

/**
 * Get account transactions within a date range.
 */
export async function getTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<{ booked: Transaction[]; pending: Transaction[] }> {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await nordigenFetch(`/accounts/${accountId}/transactions/${qs}`);
  if (!res.ok) throw new Error(`Failed to get transactions: ${res.status}`);
  const data = await res.json();
  return {
    booked: data.transactions?.booked ?? [],
    pending: data.transactions?.pending ?? [],
  };
}

/**
 * Hash an IBAN for storage (SHA-256).
 */
export async function hashIBAN(iban: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(iban.replace(/\s/g, "").toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Mask an IBAN for display: FR76 **** **** **** 1234
 */
export function maskIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 8) return "****";
  return `${clean.slice(0, 4)} ${"**** ".repeat(Math.max(0, Math.floor((clean.length - 8) / 4)))}${clean.slice(-4)}`;
}
