import { describe, expect, it } from "vitest";
import {
  deriveLeaseReadinessState,
  type LeaseReadinessInput,
} from "@/app/owner/_data/lease-readiness";

function buildInput(
  overrides: Partial<LeaseReadinessInput> = {}
): LeaseReadinessInput {
  const baseLease: LeaseReadinessInput["lease"] = {
    id: "lease-1",
    statut: "fully_signed",
    signed_pdf_path: "leases/lease-1/bail.pdf",
    has_signed_edl: false,
    has_paid_initial: false,
    has_keys_handed_over: false,
  };

  const baseProperty: LeaseReadinessInput["property"] = {
    id: "property-1",
    dpe_classe_energie: "C",
    dpe_classe_climat: "A",
    dpe_date_validite: "2030-01-01",
  };

  return {
    lease: { ...baseLease, ...overrides.lease },
    property: { ...baseProperty, ...overrides.property },
    signers: overrides.signers ?? [
      {
        id: "tenant-1",
        role: "locataire_principal",
        signature_status: "signed",
        invited_email: "tenant@example.com",
      },
      {
        id: "owner-1",
        role: "proprietaire",
        signature_status: "signed",
      },
    ],
    payments: overrides.payments ?? [],
    invoices: overrides.invoices ?? [],
    documents: overrides.documents ?? [],
    edl: overrides.edl ?? null,
    dpeStatus: overrides.dpeStatus ?? {
      status: "VALID",
      source: "property_fields",
      data: {
        energy_class: "C",
        ges_class: "A",
        valid_until: "2030-01-01",
      },
    },
  };
}

describe("deriveLeaseReadinessState", () => {
  it("retourne edl_required quand le bail est signé sans EDL", () => {
    const state = deriveLeaseReadinessState(buildInput());

    expect(state.currentStep).toBe("edl_required");
    expect(state.nextAction.key).toBe("create_edl");
    expect(state.tabs.defaultTab).toBe("edl");
  });

  it("retourne edl_in_progress quand un EDL existe mais n'est pas signé", () => {
    const state = deriveLeaseReadinessState(
      buildInput({
        edl: {
          id: "edl-1",
          status: "in_progress",
        },
      })
    );

    expect(state.currentStep).toBe("edl_in_progress");
    expect(state.documentState.edl).toBe("in_progress");
    expect(state.nextAction.key).toBe("continue_edl");
  });

  it("retourne awaiting_first_payment quand le bail est actif avec facture impayée", () => {
    const state = deriveLeaseReadinessState(
      buildInput({
        lease: {
          id: "lease-1",
          statut: "active",
          has_signed_edl: true,
        },
        edl: {
          id: "edl-1",
          status: "signed",
        },
        invoices: [
          {
            id: "inv-1",
            montant_total: 1200,
            statut: "sent",
            created_at: "2026-01-01T00:00:00.000Z",
            metadata: { type: "initial_invoice" },
          },
        ],
      })
    );

    expect(state.currentStep).toBe("awaiting_first_payment");
    expect(state.paymentState.status).toBe("invoice_issued");
    expect(state.nextAction.key).toBe("open_payments");
  });

  it("retourne keys_to_handover quand le paiement est reçu mais pas les clés", () => {
    const state = deriveLeaseReadinessState(
      buildInput({
        lease: {
          id: "lease-1",
          statut: "active",
          has_signed_edl: true,
          has_paid_initial: true,
          has_keys_handed_over: false,
        },
        edl: {
          id: "edl-1",
          status: "signed",
        },
        invoices: [
          {
            id: "inv-1",
            montant_total: 1200,
            statut: "paid",
            created_at: "2026-01-01T00:00:00.000Z",
            metadata: { type: "initial_invoice" },
          },
        ],
        payments: [
          {
            id: "pay-1",
            montant: 1200,
            statut: "paid",
            invoice_id: "inv-1",
          },
        ],
      })
    );

    expect(state.currentStep).toBe("keys_to_handover");
    expect(state.paymentState.status).toBe("paid");
    expect(state.nextAction.key).toBe("handover_keys");
  });

  it("retourne active_stable quand le bail est actif et complet", () => {
    const state = deriveLeaseReadinessState(
      buildInput({
        lease: {
          id: "lease-1",
          statut: "active",
          has_signed_edl: true,
          has_paid_initial: true,
          has_keys_handed_over: true,
        },
        edl: {
          id: "edl-1",
          status: "signed",
        },
        invoices: [
          {
            id: "inv-1",
            montant_total: 1200,
            statut: "paid",
            created_at: "2026-01-01T00:00:00.000Z",
            metadata: { type: "initial_invoice" },
          },
        ],
        payments: [
          {
            id: "pay-1",
            montant: 1200,
            statut: "paid",
            invoice_id: "inv-1",
          },
        ],
        documents: [
          {
            id: "doc-1",
            type: "attestation_assurance",
            storage_path: "documents/insurance.pdf",
            created_at: "2026-01-02T00:00:00.000Z",
          },
        ],
      })
    );

    expect(state.currentStep).toBe("active_stable");
    expect(state.blockingReasons).toEqual([]);
    expect(state.documentState.completedCount).toBeGreaterThanOrEqual(3);
  });
});
