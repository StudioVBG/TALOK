/**
 * Sprint 0.d — pure planner for the regularization settle entry.
 *
 * Generates the set of accounting lines (and side-effect flags) required
 * by POST /api/charges/regularization/[id]/apply depending on the chosen
 * settlement_method and the sign of the balance.
 *
 * Pure : no DB access, no Stripe, no Supabase. Callers feed DB rows +
 * choices in, get a plan out, then persist.
 *
 * Accounting pattern — 3 lines per entry, strictly balanced :
 *
 *   B (complément dû — stripe | next_rent | installments_12, balance > 0) :
 *     DB 419100  totalProvisions   (clear the provisions liability)
 *     DB 411000  balance           (tenant receivable — owner recovers)
 *     CR 708000  totalActual        (revenue refacturation, = provisions+balance)
 *
 *   C (trop-perçu — deduction, balance < 0) :
 *     DB 419100  totalProvisions
 *     CR 411000  |balance|          (tenant payable — owner owes back)
 *     CR 708000  totalActual        (= provisions - |balance|)
 *
 *   D (waived — renonciation propriétaire, balance > 0) :
 *     DB 419100  totalProvisions
 *     DB 654000  balance             (déductible revenus fonciers)
 *     CR 708000  totalActual
 *
 *   E (installments_12, balance > 0) : identique B (le schedule des 12
 *     encaissements vit dans un module séparé — hors périmètre Sprint 0.d).
 *
 * Déviation vs skill talok-charges-regularization section 6 : le skill
 * propose un pattern impliquant 419100 + 411000 + 614100 + 708000 sur 4
 * lignes, mais il ne balance pas (SUM(D) ≠ SUM(C)). Le pattern à 3
 * lignes ci-dessus balance strictement et isole 614100 comme compte
 * d'expense qui reste renseigné tel que payé pendant l'exercice —
 * aucun besoin de "reclasser" au settle.
 */

import type { EntryLine } from "@/lib/accounting/engine";
import { PCG_ACCOUNTS } from "./constants";
import type { SettlementMethod } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettlementEntryInput {
  /** Régul id — utilisé en `reference` de l'écriture. */
  regularizationId: string;
  settlementMethod: SettlementMethod;
  /** Requis si 'installments_12' (2..12). Sinon forcer à 1. */
  installmentCount: number;
  totalProvisionsCents: number;
  totalActualCents: number;
  /** = totalActual - totalProvisions ; >0 complément dû, <0 trop-perçu. */
  balanceCents: number;
  /** Période de la régul — pour le label. */
  fiscalYear: number;
  /** Pour l'identification dans le label (optionnel). */
  leaseLabel?: string;
}

export interface SettlementEntryPlan {
  label: string;
  source: "charge_regularization_settle";
  reference: string;
  lines: EntryLine[];
  /** True pour 'stripe' — la route doit créer une invoice + PaymentIntent. */
  requiresInvoice: boolean;
  /** True pour 'installments_12' — le schedule des 12 mois est géré hors entry. */
  requiresInstallmentSchedule: boolean;
}

export class SettlementEntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementEntryValidationError";
  }
}

// ---------------------------------------------------------------------------
// Validation (pre-conditions)
// ---------------------------------------------------------------------------

function validateInput(input: SettlementEntryInput): void {
  const {
    totalProvisionsCents: prov,
    totalActualCents: actual,
    balanceCents: balance,
    settlementMethod: method,
    installmentCount: count,
  } = input;

  if (!Number.isInteger(prov) || prov < 0) {
    throw new SettlementEntryValidationError(
      `totalProvisionsCents must be a non-negative integer (got ${prov})`,
    );
  }
  if (!Number.isInteger(actual) || actual < 0) {
    throw new SettlementEntryValidationError(
      `totalActualCents must be a non-negative integer (got ${actual})`,
    );
  }
  if (!Number.isInteger(balance)) {
    throw new SettlementEntryValidationError(
      `balanceCents must be an integer (got ${balance})`,
    );
  }
  if (balance !== actual - prov) {
    throw new SettlementEntryValidationError(
      `balanceCents (${balance}) must equal totalActualCents (${actual}) - totalProvisionsCents (${prov})`,
    );
  }
  if (!Number.isInteger(count) || count < 1 || count > 12) {
    throw new SettlementEntryValidationError(
      `installmentCount must be an integer in [1, 12] (got ${count})`,
    );
  }
  if (method === "installments_12") {
    if (count < 2) {
      throw new SettlementEntryValidationError(
        "installments_12 requires installmentCount >= 2 (use 'next_rent' for a single payment)",
      );
    }
  } else if (count !== 1) {
    throw new SettlementEntryValidationError(
      `installmentCount must be 1 for settlement_method='${method}' (got ${count})`,
    );
  }

  // Balance sign constraints per scenario
  if (method === "deduction") {
    if (balance >= 0) {
      throw new SettlementEntryValidationError(
        "'deduction' requires balanceCents < 0 (trop-perçu). Use 'next_rent' or 'stripe' for complément dû.",
      );
    }
  } else if (
    method === "stripe" ||
    method === "next_rent" ||
    method === "installments_12" ||
    method === "waived"
  ) {
    if (balance <= 0) {
      throw new SettlementEntryValidationError(
        `'${method}' requires balanceCents > 0 (complément dû). Use 'deduction' for trop-perçu.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Line generators
// ---------------------------------------------------------------------------

function linesForComplementDue(
  prov: number,
  balance: number,
  actual: number,
  pieceRef: string,
): EntryLine[] {
  // DB 419100 prov / DB 411000 balance / CR 708000 actual
  return [
    {
      accountNumber: PCG_ACCOUNTS.PROVISIONS_RECUES,
      label: "Régul — solde des provisions",
      debitCents: prov,
      creditCents: 0,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.LOCATAIRE,
      label: "Régul — créance complément",
      debitCents: balance,
      creditCents: 0,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.CHARGES_REFACTUREES,
      label: "Régul — refacturation charges",
      debitCents: 0,
      creditCents: actual,
      pieceRef,
    },
  ];
}

function linesForTropPercu(
  prov: number,
  balanceAbs: number,
  actual: number,
  pieceRef: string,
): EntryLine[] {
  // DB 419100 prov / CR 411000 |balance| / CR 708000 actual
  return [
    {
      accountNumber: PCG_ACCOUNTS.PROVISIONS_RECUES,
      label: "Régul — solde des provisions",
      debitCents: prov,
      creditCents: 0,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.LOCATAIRE,
      label: "Régul — remboursement trop-perçu",
      debitCents: 0,
      creditCents: balanceAbs,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.CHARGES_REFACTUREES,
      label: "Régul — refacturation charges",
      debitCents: 0,
      creditCents: actual,
      pieceRef,
    },
  ];
}

function linesForWaived(
  prov: number,
  balance: number,
  actual: number,
  pieceRef: string,
): EntryLine[] {
  // DB 419100 prov / DB 654000 balance / CR 708000 actual
  return [
    {
      accountNumber: PCG_ACCOUNTS.PROVISIONS_RECUES,
      label: "Régul — solde des provisions",
      debitCents: prov,
      creditCents: 0,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.CHARGES_NON_RECUPEREES,
      label: "Régul — renonciation charges non récupérées",
      debitCents: balance,
      creditCents: 0,
      pieceRef,
    },
    {
      accountNumber: PCG_ACCOUNTS.CHARGES_REFACTUREES,
      label: "Régul — refacturation charges",
      debitCents: 0,
      creditCents: actual,
      pieceRef,
    },
  ];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Plan the settlement entry — pure. Throws on any pre-condition violation.
 */
export function planSettlementEntry(
  input: SettlementEntryInput,
): SettlementEntryPlan {
  validateInput(input);

  const {
    regularizationId,
    settlementMethod: method,
    totalProvisionsCents: prov,
    totalActualCents: actual,
    balanceCents: balance,
    fiscalYear,
    leaseLabel,
  } = input;

  const pieceRef = `REG-${regularizationId.slice(0, 8)}`;
  const labelSuffix = leaseLabel ? ` — ${leaseLabel}` : "";
  const label = `Régularisation charges ${fiscalYear}${labelSuffix}`;

  let lines: EntryLine[];
  switch (method) {
    case "stripe":
    case "next_rent":
    case "installments_12":
      lines = linesForComplementDue(prov, balance, actual, pieceRef);
      break;
    case "deduction":
      lines = linesForTropPercu(prov, Math.abs(balance), actual, pieceRef);
      break;
    case "waived":
      lines = linesForWaived(prov, balance, actual, pieceRef);
      break;
    default: {
      // Exhaustiveness — the type guarantees all variants handled.
      const _exhaustive: never = method;
      throw new SettlementEntryValidationError(
        `Unhandled settlement_method: ${_exhaustive as string}`,
      );
    }
  }

  return {
    label,
    source: "charge_regularization_settle",
    reference: regularizationId,
    lines,
    requiresInvoice: method === "stripe",
    requiresInstallmentSchedule: method === "installments_12",
  };
}
