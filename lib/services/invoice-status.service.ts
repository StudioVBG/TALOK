import type { InvoiceRow } from "@/lib/supabase/database.types";

// Type très permissif pour rester compatible avec createClient et getServiceClient
// (le client réel est utilisé en production, ce type sert uniquement à éviter `any` brut)
type SupabaseLike = any;

export interface InvoiceSettlement {
  invoice: Pick<InvoiceRow, "id" | "montant_total" | "statut" | "date_paiement"> | null;
  totalPaid: number;
  remaining: number;
  status: "draft" | "sent" | "partial" | "paid" | "late" | "cancelled";
  isSettled: boolean;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getInvoiceSettlement(
  supabase: SupabaseLike,
  invoiceId: string
): Promise<InvoiceSettlement | null> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, montant_total, statut, date_paiement")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoiceData = invoice as Pick<
    InvoiceRow,
    "id" | "montant_total" | "statut" | "date_paiement"
  > | null;

  if (!invoiceData) {
    return null;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("montant")
    .eq("invoice_id", invoiceId)
    .in("statut", ["succeeded", "paid"]);

  const totalPaid = roundCurrency(
    ((payments as Array<{ montant?: number | null }> | null) ?? []).reduce(
      (sum, payment) => sum + Number(payment.montant || 0),
      0
    )
  );

  const rawRemaining = roundCurrency(Math.max(0, Number(invoiceData.montant_total || 0) - totalPaid));
  const hasAnyPayment = totalPaid > 0;

  // Fallback: si la facture est déjà marquée "paid" en base (ex: via webhook Stripe)
  // mais qu'aucune ligne payments n'existe, on considère la facture réglée.
  const invoiceMarkedPaid = invoiceData.statut === "paid";
  const isSettled = rawRemaining <= 0 || (!hasAnyPayment && invoiceMarkedPaid);
  const remaining = isSettled ? 0 : rawRemaining;

  let status = (invoiceData.statut || "sent") as InvoiceSettlement["status"];
  if (isSettled) {
    status = "paid";
  } else if (hasAnyPayment) {
    status = "partial";
  }

  return {
    invoice: invoiceData,
    totalPaid,
    remaining,
    status,
    isSettled,
  };
}

export async function syncInvoiceStatusFromPayments(
  supabase: SupabaseLike,
  invoiceId: string,
  paidAt?: string | null
): Promise<InvoiceSettlement | null> {
  const settlement = await getInvoiceSettlement(supabase, invoiceId);

  if (!settlement) {
    return null;
  }

  const nextStatus = settlement.status;
  const nextPaymentDate = settlement.isSettled
    ? paidAt || settlement.invoice?.date_paiement || new Date().toISOString()
    : null;

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({
      statut: nextStatus,
      date_paiement: nextPaymentDate,
    })
    .eq("id", invoiceId);

  if (invoiceUpdateError) {
    console.error(
      "[syncInvoiceStatusFromPayments] Invoice status update failed:",
      invoiceUpdateError,
    );
  }

  // Bug 11 : quand une facture est entièrement réglée, on annule les anciens
  // Payment Intents `pending` orphelins liés à cette facture. Sans ce nettoyage,
  // l'historique côté propriétaire continue d'afficher "55€ — En attente — Date
  // non renseignée" alors que la facture est marquée "Payée".
  //
  // NB : le statut `cancelled` sur payments est autorisé depuis la
  // migration 20260411120000_harden_payments_check_constraints.sql.
  // Avant cette migration, cette update échouait silencieusement sur
  // la CHECK (ancien set = pending|succeeded|failed|refunded).
  if (settlement.isSettled) {
    const { error: cleanupError } = await supabase
      .from("payments")
      .update({ statut: "cancelled" })
      .eq("invoice_id", invoiceId)
      .in("statut", ["pending", "processing"]);

    if (cleanupError) {
      // Non bloquant : la facture est déjà marquée payée, c'est l'essentiel.
      // On log quand même pour ne plus perdre silencieusement les échecs.
      console.warn(
        "[syncInvoiceStatusFromPayments] Cleanup pending payments failed:",
        cleanupError,
      );
    }
  }

  return {
    ...settlement,
    invoice: settlement.invoice
      ? {
          ...settlement.invoice,
          statut: nextStatus,
          date_paiement: nextPaymentDate,
        }
      : settlement.invoice,
  };
}

export async function getInitialInvoiceSettlement(
  supabase: SupabaseLike,
  leaseId: string
): Promise<InvoiceSettlement | null> {
  // 1. Chercher par metadata.type = "initial_invoice"
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("metadata->>type", "initial_invoice")
    .order("created_at", { ascending: true })
    .maybeSingle();

  const metadataInvoiceId = (invoice as { id?: string } | null)?.id;
  if (metadataInvoiceId) {
    return getInvoiceSettlement(supabase, metadataInvoiceId);
  }

  // 2. Chercher par colonne type = "initial_invoice"
  const { data: typedInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("type", "initial_invoice")
    .order("created_at", { ascending: true })
    .maybeSingle();

  const typedInvoiceId = (typedInvoice as { id?: string } | null)?.id;
  if (typedInvoiceId) {
    return getInvoiceSettlement(supabase, typedInvoiceId);
  }

  // 3. Fallback: première facture du bail par date de création
  //    Aligne le comportement avec resolveFirstInvoice (lease-readiness.ts)
  const { data: firstInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const firstInvoiceId = (firstInvoice as { id?: string } | null)?.id;
  if (!firstInvoiceId) {
    // No invoice exists for this lease — nothing to pay,
    // so the settlement condition is considered met.
    return {
      invoice: null,
      totalPaid: 0,
      remaining: 0,
      status: "paid",
      isSettled: true,
    };
  }

  return getInvoiceSettlement(supabase, firstInvoiceId);
}
