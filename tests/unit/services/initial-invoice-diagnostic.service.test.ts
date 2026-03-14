import { describe, expect, it } from "vitest";
import {
  buildInitialInvoiceDiagnostic,
  isInitialInvoiceLike,
} from "@/lib/services/initial-invoice-diagnostic.service";

describe("initial-invoice-diagnostic.service", () => {
  it("detecte une facture initiale absente sur un bail actif", () => {
    const diagnostic = buildInitialInvoiceDiagnostic({
      lease: {
        id: "lease_1",
        statut: "active",
      },
      invoices: [],
      signers: [
        {
          id: "signer_1",
          role: "locataire_principal",
          profile_id: "tenant_1",
          signature_status: "signed",
        },
      ],
      auditEntries: [],
      outboxEvents: [],
      payments: [],
      documents: [],
    });

    expect(diagnostic.probableCause).toBe("active_without_initial_invoice");
    if (!("paymentStack" in diagnostic)) {
      throw new Error("paymentStack manquant");
    }
    const paymentStack = (diagnostic as any).paymentStack;
    expect(paymentStack.initial_invoice_id).toBeNull();
    expect(paymentStack.can_create_payment_intent).toBe(false);
  });

  it("detecte une facture existante mais non reconnue comme initiale", () => {
    const diagnostic = buildInitialInvoiceDiagnostic({
      lease: {
        id: "lease_1",
        statut: "fully_signed",
      },
      invoices: [
        {
          id: "inv_1",
          lease_id: "lease_1",
          periode: "2026-03",
          montant_total: 950,
          statut: "sent",
          type: "loyer",
          metadata: {},
          created_at: "2026-03-14T10:00:00.000Z",
        },
      ],
      signers: [
        {
          id: "signer_1",
          role: "locataire_principal",
          profile_id: "tenant_1",
          signature_status: "signed",
        },
      ],
      auditEntries: [{ action: "lease_signed" }],
      outboxEvents: [{ event_type: "Invoice.InitialCreated", payload: { lease_id: "lease_1" } }],
      payments: [],
      documents: [],
    });

    expect(diagnostic.probableCause).toBe("initial_invoice_not_recognized");
    if (!("heuristics" in diagnostic)) {
      throw new Error("heuristics manquant");
    }
    const heuristics = (diagnostic as any).heuristics;
    expect(heuristics.issues).toContain(
      "Des factures existent mais aucune n'est reconnue comme initial_invoice via type ou metadata.type."
    );
    expect(heuristics.issues).toContain(
      "Un événement Invoice.InitialCreated existe dans l'outbox mais aucune facture initiale reconnue n'est visible."
    );
  });

  it("confirme que le PDF disponible est la quittance apres paiement", () => {
    const diagnostic = buildInitialInvoiceDiagnostic({
      lease: {
        id: "lease_1",
        statut: "fully_signed",
      },
      invoices: [
        {
          id: "inv_initial",
          lease_id: "lease_1",
          periode: "2026-03",
          montant_total: 1200,
          statut: "paid",
          type: "initial_invoice",
          metadata: { type: "initial_invoice" },
          created_at: "2026-03-14T10:00:00.000Z",
        },
      ],
      signers: [
        {
          id: "signer_1",
          role: "locataire_principal",
          profile_id: "tenant_1",
          signature_status: "signed",
        },
      ],
      auditEntries: [{ action: "lease_signed" }],
      outboxEvents: [{ event_type: "Invoice.InitialCreated", payload: { lease_id: "lease_1" } }],
      payments: [
        {
          id: "payment_1",
          invoice_id: "inv_initial",
          montant: 1200,
          statut: "succeeded",
        },
      ],
      documents: [
        {
          id: "doc_1",
          type: "quittance",
          storage_path: "quittances/lease_1/payment_1.pdf",
          metadata: {
            invoice_id: "inv_initial",
            payment_id: "payment_1",
          },
        },
      ],
    });

    expect(diagnostic.probableCause).toBe("initial_invoice_present");
    if (!("paymentStack" in diagnostic) || !("pdfStack" in diagnostic)) {
      throw new Error("paymentStack/pdfStack manquants");
    }
    const paymentStack = (diagnostic as any).paymentStack;
    const pdfStack = (diagnostic as any).pdfStack;
    expect(paymentStack.can_create_payment_intent).toBe(false);
    expect(pdfStack.invoice_pdf_generated_by_flow).toBe(false);
    expect(pdfStack.receipt_pdf_generated_after_payment_only).toBe(true);
    expect(pdfStack.receipt_download_route).toBe("/api/invoices/inv_initial/receipt");
    expect(pdfStack.receipt_documents).toHaveLength(1);
  });

  it("reconnait correctement une facture initiale par type ou metadata", () => {
    expect(isInitialInvoiceLike({ type: "initial_invoice", metadata: null })).toBe(true);
    expect(isInitialInvoiceLike({ type: null, metadata: { type: "initial_invoice" } })).toBe(true);
    expect(isInitialInvoiceLike({ type: "loyer", metadata: {} })).toBe(false);
  });
});
