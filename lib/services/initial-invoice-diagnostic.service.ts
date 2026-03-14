import { isInvoicePayableStatus, PAYABLE_INVOICE_STATUSES } from "@/lib/payments/tenant-payment-flow";

const TENANT_ROLES = new Set([
  "locataire_principal",
  "locataire",
  "tenant",
  "principal",
  "colocataire",
]);

export type LeaseDiagnosticLease = {
  id: string;
  statut: string | null;
  signature_completed_at?: string | null;
  activated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LeaseDiagnosticInvoice = {
  id: string;
  lease_id?: string | null;
  periode?: string | null;
  montant_total?: number | null;
  statut?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  date_paiement?: string | null;
  owner_id?: string | null;
  tenant_id?: string | null;
};

export type LeaseDiagnosticSigner = {
  id: string;
  role?: string | null;
  profile_id?: string | null;
  invited_email?: string | null;
  signature_status?: string | null;
  signed_at?: string | null;
  updated_at?: string | null;
};

export type LeaseDiagnosticAudit = {
  id?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  user_id?: string | null;
};

export type LeaseDiagnosticOutbox = {
  id?: string | null;
  event_type?: string | null;
  payload?: Record<string, unknown> | null;
  created_at?: string | null;
  processed_at?: string | null;
};

export type LeaseDiagnosticPayment = {
  id: string;
  invoice_id?: string | null;
  montant?: number | null;
  moyen?: string | null;
  statut?: string | null;
  provider_ref?: string | null;
  created_at?: string | null;
  date_paiement?: string | null;
};

export type LeaseDiagnosticDocument = {
  id: string;
  type?: string | null;
  storage_path?: string | null;
  name?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type InitialInvoiceProbableCause =
  | "lease_not_found"
  | "main_tenant_profile_missing"
  | "no_invoice_for_lease"
  | "initial_invoice_not_recognized"
  | "active_without_initial_invoice"
  | "initial_invoice_present";

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function isInitialInvoiceLike(invoice: {
  metadata?: Record<string, unknown> | null;
  type?: string | null;
} | null | undefined): boolean {
  if (!invoice) return false;
  const metadataType =
    invoice.metadata && typeof invoice.metadata.type === "string"
      ? invoice.metadata.type
      : null;
  return metadataType === "initial_invoice" || invoice.type === "initial_invoice";
}

function getMainTenantSigner(signers: LeaseDiagnosticSigner[]) {
  return signers.find((signer) => {
    const role = String(signer.role || "").toLowerCase();
    return TENANT_ROLES.has(role);
  }) ?? null;
}

function getInvoicePaymentSummary(
  invoiceId: string | null,
  invoiceTotal: number,
  payments: LeaseDiagnosticPayment[]
) {
  if (!invoiceId) {
    return {
      totalPaid: 0,
      remainingAmount: invoiceTotal,
      settlementStatus: "missing" as const,
      relatedPayments: [] as LeaseDiagnosticPayment[],
    };
  }

  const relatedPayments = payments.filter((payment) => payment.invoice_id === invoiceId);
  const settledStatuses = new Set(["succeeded", "paid"]);
  const totalPaid = roundCurrency(
    relatedPayments.reduce((sum, payment) => {
      if (!settledStatuses.has(String(payment.statut || ""))) {
        return sum;
      }
      return sum + Number(payment.montant || 0);
    }, 0)
  );
  const remainingAmount = roundCurrency(Math.max(0, invoiceTotal - totalPaid));

  let settlementStatus: "missing" | "pending" | "partial" | "paid" = "pending";
  if (relatedPayments.length === 0) {
    settlementStatus = "missing";
  } else if (remainingAmount <= 0) {
    settlementStatus = "paid";
  } else if (totalPaid > 0) {
    settlementStatus = "partial";
  }

  return {
    totalPaid,
    remainingAmount,
    settlementStatus,
    relatedPayments,
  };
}

export function buildInitialInvoiceDiagnostic(input: {
  lease: LeaseDiagnosticLease | null;
  invoices: LeaseDiagnosticInvoice[];
  signers: LeaseDiagnosticSigner[];
  auditEntries: LeaseDiagnosticAudit[];
  outboxEvents: LeaseDiagnosticOutbox[];
  payments: LeaseDiagnosticPayment[];
  documents: LeaseDiagnosticDocument[];
}) {
  const {
    lease,
    invoices,
    signers,
    auditEntries,
    outboxEvents,
    payments,
    documents,
  } = input;

  if (!lease) {
    return {
      probableCause: "lease_not_found" as const,
      summary: {
        title: "Bail introuvable",
        description: "Aucun bail n'a été trouvé pour l'identifiant demandé.",
      },
    };
  }

  const mainTenantSigner = getMainTenantSigner(signers);
  const recognizedInitialInvoice =
    [...invoices]
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .find(isInitialInvoiceLike) ?? null;
  const likelyInitialCandidates = invoices.filter((invoice) => {
    const looseType =
      typeof invoice.type === "string" && invoice.type.toLowerCase().includes("initial");
    const metadataLooseType =
      typeof invoice.metadata?.type === "string" &&
      invoice.metadata.type.toLowerCase().includes("initial");
    return looseType || metadataLooseType;
  });

  const createdEvent = outboxEvents.find((event) => event.event_type === "Invoice.InitialCreated") ?? null;
  const leaseSignedAudit = auditEntries.find((entry) => entry.action === "lease_signed") ?? null;

  const invoiceTotal = Number(recognizedInitialInvoice?.montant_total || 0);
  const paymentSummary = getInvoicePaymentSummary(
    recognizedInitialInvoice?.id ?? null,
    invoiceTotal,
    payments
  );

  const receiptDocuments = documents.filter((document) => {
    if (document.type !== "quittance") return false;
    const invoiceId = document.metadata?.invoice_id;
    const paymentId = document.metadata?.payment_id;
    return (
      invoiceId === recognizedInitialInvoice?.id ||
      paymentSummary.relatedPayments.some((payment) => payment.id === paymentId)
    );
  });

  const issues: string[] = [];
  let probableCause: InitialInvoiceProbableCause = "initial_invoice_present";

  if (!mainTenantSigner?.profile_id) {
    probableCause = "main_tenant_profile_missing";
    issues.push(
      "Le signataire locataire principal n'a pas de profile_id résolu au moment du diagnostic."
    );
  }

  if (invoices.length === 0) {
    probableCause =
      lease.statut === "active" ? "active_without_initial_invoice" : "no_invoice_for_lease";
    issues.push("Aucune facture n'est rattachée à ce bail.");
  } else if (!recognizedInitialInvoice) {
    probableCause =
      lease.statut === "active" ? "active_without_initial_invoice" : "initial_invoice_not_recognized";
    issues.push(
      "Des factures existent mais aucune n'est reconnue comme initial_invoice via type ou metadata.type."
    );
  }

  if (createdEvent && !recognizedInitialInvoice) {
    issues.push(
      "Un événement Invoice.InitialCreated existe dans l'outbox mais aucune facture initiale reconnue n'est visible."
    );
  }

  if (recognizedInitialInvoice && !isInvoicePayableStatus(recognizedInitialInvoice.statut || null) && paymentSummary.remainingAmount > 0) {
    issues.push(
      `La facture initiale existe mais son statut (${recognizedInitialInvoice.statut || "null"}) n'est pas payable par le flux standard.`
    );
  }

  return {
    probableCause,
    summary: {
      title:
        probableCause === "initial_invoice_present"
          ? "Facture initiale détectée"
          : "Facture initiale absente ou incohérente",
      description:
        probableCause === "initial_invoice_present"
          ? "Le bail possède une facture initiale reconnue par la logique métier."
          : "Le bail ne présente pas de facture initiale exploitable dans la chaîne de paiement.",
    },
    lease: {
      ...lease,
      is_signed_workflow_status: ["fully_signed", "active", "notice_given", "terminated", "archived"].includes(
        String(lease.statut || "")
      ),
    },
    invoices: invoices.map((invoice) => ({
      ...invoice,
      is_initial_invoice: isInitialInvoiceLike(invoice),
      marker_type: invoice.type || null,
      marker_metadata_type:
        invoice.metadata && typeof invoice.metadata.type === "string"
          ? invoice.metadata.type
          : null,
      is_payable_status: isInvoicePayableStatus(invoice.statut || null),
    })),
    signers: {
      main_tenant: mainTenantSigner,
      all: signers,
    },
    events: {
      outbox_initial_created: createdEvent,
      recent_outbox: outboxEvents,
      lease_signed_audit: leaseSignedAudit,
      recent_audit: auditEntries,
    },
    paymentStack: {
      payable_statuses: [...PAYABLE_INVOICE_STATUSES],
      initial_invoice_id: recognizedInitialInvoice?.id ?? null,
      initial_invoice_status: recognizedInitialInvoice?.statut ?? null,
      can_create_payment_intent:
        Boolean(recognizedInitialInvoice) &&
        isInvoicePayableStatus(recognizedInitialInvoice?.statut || null) &&
        paymentSummary.remainingAmount > 0,
      total_amount: invoiceTotal,
      total_paid: paymentSummary.totalPaid,
      remaining_amount: paymentSummary.remainingAmount,
      settlement_status: paymentSummary.settlementStatus,
      related_payments: paymentSummary.relatedPayments,
      blocking_reason: !recognizedInitialInvoice
        ? "Aucune facture initiale reconnue."
        : !isInvoicePayableStatus(recognizedInitialInvoice.statut || null)
          ? `Statut de facture non payable (${recognizedInitialInvoice.statut || "null"}).`
          : paymentSummary.remainingAmount <= 0
            ? "Facture deja reglee."
            : null,
    },
    pdfStack: {
      invoice_pdf_generated_by_flow: false,
      receipt_pdf_generated_after_payment_only: true,
      receipt_download_route: recognizedInitialInvoice
        ? `/api/invoices/${recognizedInitialInvoice.id}/receipt`
        : null,
      receipt_documents: receiptDocuments.map((document) => ({
        id: document.id,
        type: document.type ?? null,
        storage_path: document.storage_path ?? null,
        created_at: document.created_at ?? null,
      })),
      note:
        "Dans ce flux, le PDF genere automatiquement est la quittance apres paiement reussi, pas la facture initiale elle-meme.",
    },
    heuristics: {
      likely_initial_candidates: likelyInitialCandidates,
      issues,
    },
  };
}
