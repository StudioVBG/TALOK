export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import {
  buildInitialInvoiceDiagnostic,
  type LeaseDiagnosticAudit,
  type LeaseDiagnosticDocument,
  type LeaseDiagnosticInvoice,
  type LeaseDiagnosticOutbox,
  type LeaseDiagnosticPayment,
  type LeaseDiagnosticSigner,
} from "@/lib/services/initial-invoice-diagnostic.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
    rateLimit: "adminCritical",
    auditAction: "lease-initial-invoice-diagnostic",
  });
  if (isAdminAuthError(auth)) return auth;

  const { id: leaseId } = await params;
  const supabase = createServiceRoleClient();

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, statut, signature_completed_at, activated_at, created_at, updated_at")
    .eq("id", leaseId)
    .maybeSingle();

  if (leaseError) {
    return NextResponse.json({ error: leaseError.message }, { status: 500 });
  }

  if (!lease) {
    const diagnostic = buildInitialInvoiceDiagnostic({
      lease: null,
      invoices: [],
      signers: [],
      auditEntries: [],
      outboxEvents: [],
      payments: [],
      documents: [],
    });
    return NextResponse.json(diagnostic, { status: 404 });
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select(
      "id, lease_id, periode, montant_total, statut, type, metadata, created_at, date_paiement, owner_id, tenant_id"
    )
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: true });

  if (invoicesError) {
    return NextResponse.json({ error: invoicesError.message }, { status: 500 });
  }

  const invoiceIds = (invoices ?? []).map((invoice: any) => invoice.id).filter(Boolean);

  const [
    signersResult,
    auditResult,
    outboxResult,
    paymentsResult,
    documentsResult,
  ] = await Promise.all([
    supabase
      .from("lease_signers")
      .select("id, role, profile_id, invited_email, signature_status, signed_at, updated_at")
      .eq("lease_id", leaseId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, metadata, created_at, user_id")
      .eq("entity_type", "lease")
      .eq("entity_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("outbox")
      .select("id, event_type, payload, created_at, processed_at")
      .in("event_type", [
        "Invoice.InitialCreated",
        "Lease.TenantSigned",
        "Lease.OwnerSigned",
        "Lease.FullySigned",
      ])
      .order("created_at", { ascending: false })
      .limit(100),
    invoiceIds.length > 0
      ? supabase
          .from("payments")
          .select("id, invoice_id, montant, moyen, statut, provider_ref, created_at, date_paiement")
          .in("invoice_id", invoiceIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("documents")
      .select("id, type, storage_path, title, metadata, created_at")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false }),
  ]);

  if (signersResult.error || auditResult.error || outboxResult.error || paymentsResult.error || documentsResult.error) {
    const error =
      signersResult.error ||
      auditResult.error ||
      outboxResult.error ||
      paymentsResult.error ||
      documentsResult.error;
    return NextResponse.json({ error: error?.message || "Erreur serveur" }, { status: 500 });
  }

  const filteredOutbox = ((outboxResult.data as LeaseDiagnosticOutbox[] | null) ?? []).filter((event) => {
    const payloadLeaseId =
      event.payload && typeof event.payload.lease_id === "string"
        ? event.payload.lease_id
        : null;
    return payloadLeaseId === leaseId;
  });

  const diagnostic = buildInitialInvoiceDiagnostic({
    lease: lease as any,
    invoices: (invoices as LeaseDiagnosticInvoice[] | null) ?? [],
    signers: (signersResult.data as LeaseDiagnosticSigner[] | null) ?? [],
    auditEntries: (auditResult.data as LeaseDiagnosticAudit[] | null) ?? [],
    outboxEvents: filteredOutbox,
    payments: (paymentsResult.data as LeaseDiagnosticPayment[] | null) ?? [],
    documents: (documentsResult.data as unknown as LeaseDiagnosticDocument[] | null) ?? [],
  });

  return NextResponse.json(diagnostic);
}
