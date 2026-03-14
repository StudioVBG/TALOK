import { getServiceClient } from "@/lib/supabase/service-client";

export const PAYABLE_INVOICE_STATUSES = [
  "sent",
  "late",
  "overdue",
  "partial",
  "unpaid",
] as const;

export type PayableInvoiceStatus = (typeof PAYABLE_INVOICE_STATUSES)[number];

interface InvoicePaymentRow {
  id: string;
  tenant_id: string | null;
  lease_id: string | null;
  montant_total: number | string | null;
  statut: string | null;
  leases: { property_id: string | null } | null;
}

interface PaymentRow {
  montant: number | string | null;
}

export interface TenantInvoicePaymentContext {
  invoiceId: string;
  tenantId: string | null;
  leaseId: string | null;
  propertyId: string | null;
  status: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isLeaseSigner: boolean;
  canTenantPay: boolean;
  isPayableStatus: boolean;
  isAlreadySettled: boolean;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isInvoicePayableStatus(
  status: string | null | undefined
): status is PayableInvoiceStatus {
  return PAYABLE_INVOICE_STATUSES.includes(status as PayableInvoiceStatus);
}

export function isLegacyTenantPaymentRouteEnabled(): boolean {
  return process.env.ENABLE_LEGACY_TENANT_PAYMENT_ROUTES === "true";
}

export async function getTenantInvoicePaymentContext(
  invoiceId: string,
  tenantProfileId: string
): Promise<TenantInvoicePaymentContext | null> {
  const serviceClient = getServiceClient();

  const { data: invoice, error: invoiceError } = await serviceClient
    .from("invoices")
    .select("id, tenant_id, lease_id, montant_total, statut, leases(property_id)")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return null;
  }

  const typedInvoice = invoice as unknown as InvoicePaymentRow;

  const { data: settledPayments } = await serviceClient
    .from("payments")
    .select("montant")
    .eq("invoice_id", invoiceId)
    .in("statut", ["succeeded", "paid"]);

  const paidAmount = roundCurrency(
    ((settledPayments as PaymentRow[] | null) ?? []).reduce(
      (sum, payment) => sum + Number(payment.montant || 0),
      0
    )
  );

  let isLeaseSigner = false;

  if (typedInvoice.lease_id) {
    const { data: signer } = await serviceClient
      .from("lease_signers")
      .select("id")
      .eq("lease_id", typedInvoice.lease_id)
      .eq("profile_id", tenantProfileId)
      .in("role", ["locataire_principal", "colocataire"])
      .maybeSingle();

    isLeaseSigner = Boolean(signer);
  }

  const totalAmount = roundCurrency(Number(typedInvoice.montant_total || 0));
  const remainingAmount = roundCurrency(Math.max(0, totalAmount - paidAmount));
  const canTenantPay =
    typedInvoice.tenant_id === tenantProfileId || isLeaseSigner;

  return {
    invoiceId: typedInvoice.id,
    tenantId: typedInvoice.tenant_id,
    leaseId: typedInvoice.lease_id,
    propertyId: typedInvoice.leases?.property_id ?? null,
    status: typedInvoice.statut,
    totalAmount,
    paidAmount,
    remainingAmount,
    isLeaseSigner,
    canTenantPay,
    isPayableStatus: isInvoicePayableStatus(typedInvoice.statut),
    isAlreadySettled:
      typedInvoice.statut === "paid" || remainingAmount <= 0,
  };
}
