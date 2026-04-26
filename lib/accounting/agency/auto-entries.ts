/**
 * Agency Auto-Entries — Double-entry accounting for agency management
 *
 * Creates paired accounting entries for:
 * - Loyer collection (mandant accounting + agency commission)
 * - Reversement (funds transfer to mandant)
 *
 * RULES:
 * - ALWAYS integer cents
 * - ALWAYS balanced (sum(D) = sum(C))
 * - 467XXX = mandant sub-account
 * - 512000 = Banque mandant (separate bank per Hoguet)
 * - 706000 = Loyers
 * - 706100 = Honoraires de gestion
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createEntry } from "@/lib/accounting/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgencyLoyerParams {
  agencyEntityId: string;
  mandantId: string;
  mandantAccountNumber: string; // 467XXX
  amountCents: number;
  commissionRate: number;
  tenantName: string;
  propertyAddress: string;
  exerciseId: string;
  reference: string;
}

export interface ReversementParams {
  agencyEntityId: string;
  mandantAccountNumber: string; // 467XXX
  amountCents: number;
  exerciseId: string;
  mandantName: string;
}

// ---------------------------------------------------------------------------
// Loyer collection: mandant side + agency commission
// ---------------------------------------------------------------------------

/**
 * Create paired entries for a collected rent:
 *
 * 1. Mandant accounting:
 *    D:512000 Banque mandant (rent received on mandant bank account)
 *    C:706000 Loyers (revenue for the mandant)
 *
 * 2. Agency commission:
 *    D:467XXX Mandant sub-account (amount owed by mandant to agency)
 *    C:706100 Honoraires gestion (agency management fee revenue)
 */
export async function createAgencyLoyerEntries(
  supabase: SupabaseClient,
  params: AgencyLoyerParams,
) {
  const commissionCents = Math.round(
    (params.amountCents * params.commissionRate) / 100,
  );

  const today = new Date().toISOString().split("T")[0];

  // 1. Mandant accounting: D:512000 Banque mandant / C:706000 Loyers
  const mandantEntry = await createEntry(supabase, {
    entityId: params.agencyEntityId,
    exerciseId: params.exerciseId,
    journalCode: "BQ",
    entryDate: today,
    label: `Loyer ${params.tenantName} - ${params.propertyAddress}`,
    source: "auto:agency_loyer_mandant",
    reference: params.reference,
    userId: "system",
    autoValidate: true,
    lines: [
      {
        accountNumber: "512000",
        debitCents: params.amountCents,
        creditCents: 0,
        label: "Banque mandant",
      },
      {
        accountNumber: "706000",
        debitCents: 0,
        creditCents: params.amountCents,
        label: "Loyers",
      },
    ],
  });

  // 2. Agency commission: D:467XXX Mandant / C:706100 Honoraires
  const agencyEntry = await createEntry(supabase, {
    entityId: params.agencyEntityId,
    exerciseId: params.exerciseId,
    journalCode: "VE",
    entryDate: today,
    label: `Honoraires gestion ${params.tenantName}`,
    source: "auto:agency_commission",
    reference: params.reference,
    userId: "system",
    autoValidate: true,
    lines: [
      {
        accountNumber: params.mandantAccountNumber,
        debitCents: commissionCents,
        creditCents: 0,
        label: "Mandant",
      },
      {
        accountNumber: "706100",
        debitCents: 0,
        creditCents: commissionCents,
        label: "Honoraires gestion",
      },
    ],
  });

  return { mandantEntry, agencyEntry, commissionCents };
}

// ---------------------------------------------------------------------------
// Reversement: transfer funds back to mandant
// ---------------------------------------------------------------------------

/**
 * Create a reversement entry — funds transferred from agency mandant bank
 * account to the mandant's own bank account.
 *
 * D:467XXX Mandant sub-account (clearing the debt to mandant)
 * C:512000 Banque mandant (funds leaving the mandant bank account)
 */
export async function createReversementEntry(
  supabase: SupabaseClient,
  params: ReversementParams,
) {
  const today = new Date().toISOString().split("T")[0];

  return createEntry(supabase, {
    entityId: params.agencyEntityId,
    exerciseId: params.exerciseId,
    journalCode: "BQ",
    entryDate: today,
    label: `Reversement ${params.mandantName}`,
    source: "auto:agency_reversement",
    userId: "system",
    autoValidate: true,
    lines: [
      {
        accountNumber: params.mandantAccountNumber,
        debitCents: 0,
        creditCents: params.amountCents,
      },
      {
        accountNumber: "512000",
        debitCents: params.amountCents,
        creditCents: 0,
        label: "Banque mandant",
      },
    ],
  });
}
