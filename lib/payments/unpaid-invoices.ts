/**
 * Centralized helpers for "unpaid invoice" calculations.
 *
 * Source de vérité pour TOUTES les pages tenant qui affichent des montants
 * impayés / à régulariser. Évite les divergences (35 € sur dashboard vs 105 €
 * sur la page paiements) qui surgissent quand chaque écran réimplémente sa
 * propre logique de filtrage.
 */

import { PAYABLE_INVOICE_STATUSES } from "./tenant-payment-flow";

/**
 * Statuts considérés comme "impayés" — agrégés depuis les statuts canoniques
 * du state-machine + les statuts legacy encore présents en base.
 *
 * Une facture est "impayée" si :
 *   - son statut est dans cette liste
 *   - ET sa date d'échéance est passée (ou absente)
 */
export const UNPAID_INVOICE_STATUSES = [
  ...PAYABLE_INVOICE_STATUSES,
  "pending",
  "reminder_sent",
  "collection",
  "viewed",
] as const;

export type UnpaidInvoiceStatus = (typeof UNPAID_INVOICE_STATUSES)[number];

const UNPAID_STATUS_SET = new Set<string>(UNPAID_INVOICE_STATUSES);

/**
 * Forme minimale d'une facture pour les calculs côté client.
 * Compatible avec les types Supabase générés et les structures legacy
 * (TenantInvoice, InvoiceWithPayments, etc.).
 */
export interface InvoiceLike {
  statut?: string | null;
  montant_total?: number | string | null;
  due_date?: string | null;
  date_echeance?: string | null;
  created_at?: string | null;
  type?: string | null;
}

function toAmount(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Date d'échéance "effective" — `date_echeance` puis `due_date` puis `created_at`.
 */
export function getInvoiceEffectiveDueDate(
  invoice: InvoiceLike
): Date | null {
  return (
    toDate(invoice.date_echeance) ||
    toDate(invoice.due_date) ||
    toDate(invoice.created_at)
  );
}

/**
 * Une facture compte-t-elle dans le total "à régulariser" ?
 *
 * @param invoice  La facture à évaluer
 * @param referenceDate  Date de référence (par défaut : maintenant)
 */
export function isInvoiceUnpaid(
  invoice: InvoiceLike,
  referenceDate: Date = new Date()
): boolean {
  const status = invoice.statut?.toString();
  if (!status) return false;
  if (!UNPAID_STATUS_SET.has(status)) return false;

  const dueDate = getInvoiceEffectiveDueDate(invoice);
  // Pas de date d'échéance → on considère qu'elle est due maintenant
  if (!dueDate) return true;
  // L'échéance est dans le futur → ce n'est pas (encore) un impayé
  return dueDate.getTime() <= referenceDate.getTime();
}

export interface UnpaidStats<T extends InvoiceLike = InvoiceLike> {
  /** Montant total à régulariser, arrondi au centime */
  totalAmount: number;
  /** Nombre de factures impayées */
  count: number;
  /** Liste des factures impayées (triées par date d'échéance ascendante) */
  invoices: T[];
}

/**
 * Calcule les statistiques d'impayés à partir d'une liste de factures.
 * Utilisé par dashboard, page paiements et bandeau actions documents.
 */
export function computeUnpaidStats<T extends InvoiceLike>(
  invoices: readonly T[] | null | undefined,
  referenceDate: Date = new Date()
): UnpaidStats<T> {
  if (!invoices || invoices.length === 0) {
    return { totalAmount: 0, count: 0, invoices: [] };
  }

  const unpaid = invoices.filter((inv) => isInvoiceUnpaid(inv, referenceDate));

  unpaid.sort((a, b) => {
    const dateA = getInvoiceEffectiveDueDate(a)?.getTime() ?? 0;
    const dateB = getInvoiceEffectiveDueDate(b)?.getTime() ?? 0;
    return dateA - dateB;
  });

  const totalAmount = unpaid.reduce(
    (sum, inv) => sum + toAmount(inv.montant_total),
    0
  );

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    count: unpaid.length,
    invoices: unpaid,
  };
}

/**
 * Récupère la prochaine facture à échéance future (date >= today).
 *
 * Utilisé par les widgets "Prochaine échéance". À la différence d'un simple
 * `[...invoices].sort()[0]`, cette fonction écarte les factures dont
 * l'échéance est passée — celles-ci appartiennent à la section "impayés".
 */
export function getNextUpcomingInvoice<T extends InvoiceLike>(
  invoices: readonly T[] | null | undefined,
  referenceDate: Date = new Date()
): T | null {
  if (!invoices || invoices.length === 0) return null;

  const startOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const upcoming = invoices
    .filter((inv) => {
      const status = inv.statut?.toString();
      if (!status) return false;
      // Doit pouvoir devenir un impayé futur
      if (!UNPAID_STATUS_SET.has(status)) return false;
      const dueDate = getInvoiceEffectiveDueDate(inv);
      if (!dueDate) return false;
      return dueDate.getTime() >= startOfToday.getTime();
    })
    .sort((a, b) => {
      const dateA = getInvoiceEffectiveDueDate(a)!.getTime();
      const dateB = getInvoiceEffectiveDueDate(b)!.getTime();
      return dateA - dateB;
    });

  return upcoming[0] ?? null;
}

/**
 * Calcule le score de ponctualité d'un locataire.
 *
 * @returns `null` si aucun paiement n'a encore été enregistré (pas de score),
 *          sinon un pourcentage entre 0 et 100.
 */
export function computePunctualityScore<T extends InvoiceLike>(
  invoices: readonly T[] | null | undefined
): { score: number | null; paidCount: number; totalCount: number } {
  if (!invoices || invoices.length === 0) {
    return { score: null, paidCount: 0, totalCount: 0 };
  }

  // On n'évalue que les vraies factures de loyer, hors statuts neutres
  const rentInvoices = invoices.filter(
    (i) => i.type !== "initial_invoice" && i.statut !== "cancelled" && i.statut !== "draft"
  );
  if (rentInvoices.length === 0) {
    return { score: null, paidCount: 0, totalCount: 0 };
  }

  const paidCount = rentInvoices.filter(
    (i) => i.statut === "paid" || i.statut === "receipt_generated" || i.statut === "succeeded"
  ).length;

  // Pas un seul paiement enregistré → on ne peut pas calculer un score
  if (paidCount === 0) {
    return { score: null, paidCount: 0, totalCount: rentInvoices.length };
  }

  const lateCount = rentInvoices.filter((i) =>
    i.statut === "late" ||
    i.statut === "overdue" ||
    i.statut === "unpaid" ||
    i.statut === "reminder_sent" ||
    i.statut === "collection" ||
    i.statut === "written_off"
  ).length;

  const score = Math.round(
    ((rentInvoices.length - lateCount) / rentInvoices.length) * 100
  );

  return { score, paidCount, totalCount: rentInvoices.length };
}
