export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

type ReportItem = {
  count: number;
  sampleIds: string[];
};

function isInitialInvoiceLike(invoice: { type?: string | null; metadata?: { type?: string | null } | null }) {
  return invoice.type === "initial_invoice" || invoice.metadata?.type === "initial_invoice";
}

async function buildReport() {
  const supabase = createServiceRoleClient();

  const [
    leasesResult,
    invoicesResult,
    signersResult,
    subscriptionsResult,
    connectResult,
    mandatesResult,
    schedulesResult,
    paymentsResult,
    transfersResult,
  ] = await Promise.all([
    supabase
      .from("leases")
      .select("id, statut, invoices(id, type, metadata)")
      .in("statut", ["active", "fully_signed"]),
    supabase
      .from("invoices")
      .select("id, lease_id, type, metadata")
      .or("type.eq.initial_invoice,metadata->>type.eq.initial_invoice"),
    supabase
      .from("lease_signers")
      .select("id, lease_id, role, profile_id, signature_status")
      .is("profile_id", null)
      .in("role", ["locataire_principal", "colocataire", "garant"]),
    supabase
      .from("subscriptions")
      .select("id, owner_id, stripe_customer_id, stripe_subscription_id, status")
      .not("stripe_customer_id", "is", null),
    supabase
      .from("stripe_connect_accounts")
      .select("id, profile_id, charges_enabled, payouts_enabled, details_submitted"),
    supabase
      .from("sepa_mandates")
      .select("id, lease_id, status, stripe_payment_method_id")
      .in("status", ["active", "pending"]),
    supabase
      .from("payment_schedules")
      .select("id, lease_id, mandate_id, payment_method_type, is_active"),
    supabase
      .from("payments")
      .select("id, invoice_id, provider_ref, statut")
      .eq("statut", "succeeded"),
    supabase
      .from("stripe_transfers")
      .select("id, payment_id, invoice_id, stripe_transfer_id, status"),
  ]);

  const leases = leasesResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const signers = signersResult.data ?? [];
  const subscriptions = subscriptionsResult.data ?? [];
  const connectAccounts = connectResult.data ?? [];
  const mandates = mandatesResult.data ?? [];
  const schedules = schedulesResult.data ?? [];
  const payments = paymentsResult.data ?? [];
  const transfers = transfersResult.data ?? [];

  const activeLeasesWithoutInitialInvoice = leases.filter((lease: any) => {
    const relatedInvoices = Array.isArray(lease.invoices) ? lease.invoices : [];
    return !relatedInvoices.some(isInitialInvoiceLike);
  });

  const initialInvoicesMissingMirror = invoices.filter((invoice: any) => {
    const byType = invoice.type === "initial_invoice";
    const byMetadata = invoice.metadata?.type === "initial_invoice";
    return byType !== byMetadata;
  });

  const subscriptionSyncGaps = subscriptions.filter(
    (subscription: any) =>
      subscription.stripe_customer_id && !subscription.stripe_subscription_id && subscription.status !== "canceled"
  );

  const connectNotReady = connectAccounts.filter(
    (account: any) => !account.charges_enabled || !account.payouts_enabled || !account.details_submitted
  );

  const scheduleByLease = new Map<string, any[]>();
  for (const schedule of schedules as any[]) {
    const key = String(schedule.lease_id);
    scheduleByLease.set(key, [...(scheduleByLease.get(key) ?? []), schedule]);
  }

  const mandatesWithoutSchedule = mandates.filter((mandate: any) => {
    const leaseSchedules = scheduleByLease.get(String(mandate.lease_id)) ?? [];
    return !leaseSchedules.some(
      (schedule) => schedule.payment_method_type === "sepa" && (schedule.mandate_id === mandate.id || schedule.is_active)
    );
  });

  const schedulesWithoutMandate = schedules.filter((schedule: any) => {
    if (schedule.payment_method_type !== "sepa" || !schedule.is_active) {
      return false;
    }
    return !schedule.mandate_id;
  });

  const transferPaymentIds = new Set(
    transfers
      .map((transfer: any) => transfer.payment_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
  const succeededPaymentsWithoutTransfer = payments.filter(
    (payment: any) => payment.provider_ref && !transferPaymentIds.has(payment.id)
  );

  const orphanTransfers = transfers.filter((transfer: any) => !transfer.payment_id || !transfer.invoice_id);

  const requiredEnv = {
    stripe_secret_key: Boolean(process.env.STRIPE_SECRET_KEY),
    stripe_publishable_key: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    stripe_webhook_secret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    app_url: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    sepa_creditor_name: Boolean(process.env.SEPA_CREDITOR_NAME),
    sepa_creditor_iban: Boolean(process.env.SEPA_CREDITOR_IBAN),
    cron_secret: Boolean(process.env.CRON_SECRET),
  };

  const summarize = (items: Array<{ id?: string | null; lease_id?: string | null }>): ReportItem => ({
    count: items.length,
    sampleIds: items
      .map((item) => item.id ?? item.lease_id ?? null)
      .filter((value): value is string => typeof value === "string")
      .slice(0, 10),
  });

  return {
    generated_at: new Date().toISOString(),
    environment: {
      required: requiredEnv,
      missing: Object.entries(requiredEnv)
        .filter(([, value]) => !value)
        .map(([key]) => key),
    },
    anomalies: {
      active_leases_without_initial_invoice: summarize(activeLeasesWithoutInitialInvoice as any[]),
      initial_invoices_missing_marker_mirror: summarize(initialInvoicesMissingMirror as any[]),
      unresolved_lease_signers: summarize(signers as any[]),
      subscriptions_missing_stripe_subscription_id: summarize(subscriptionSyncGaps as any[]),
      connect_accounts_not_ready: summarize(connectNotReady as any[]),
      sepa_mandates_without_schedule: summarize(mandatesWithoutSchedule as any[]),
      sepa_schedules_without_mandate: summarize(schedulesWithoutMandate as any[]),
      succeeded_payments_without_transfer: summarize(succeededPaymentsWithoutTransfer as any[]),
      orphan_stripe_transfers: summarize(orphanTransfers as any[]),
    },
  };
}

async function runRepairs(actions: string[]) {
  const supabase = createServiceRoleClient();
  const results: Array<{ action: string; updated: number }> = [];

  if (actions.includes("sync_initial_invoice_markers")) {
    const metadataResult = await supabase
      .from("invoices")
      .update({ type: "initial_invoice" })
      .eq("metadata->>type", "initial_invoice")
      .or("type.is.null,type.neq.initial_invoice")
      .select("id");

    const { data: typedInvoices } = await supabase
      .from("invoices")
      .select("id, metadata")
      .eq("type", "initial_invoice");

    let updatedMetadata = 0;
    for (const invoice of typedInvoices ?? []) {
      const metadata = (invoice as any).metadata ?? {};
      if (metadata?.type === "initial_invoice") continue;
      const { error } = await supabase
        .from("invoices")
        .update({ metadata: { ...metadata, type: "initial_invoice" } })
        .eq("id", (invoice as any).id);
      if (!error) updatedMetadata += 1;
    }

    results.push({
      action: "sync_initial_invoice_markers",
      updated: (metadataResult.data?.length ?? 0) + updatedMetadata,
    });
  }

  if (actions.includes("sync_sepa_payment_method_links")) {
    const [{ data: mandates }, { data: methods }] = await Promise.all([
      supabase
        .from("sepa_mandates")
        .select("id, tenant_profile_id, stripe_payment_method_id")
        .not("stripe_payment_method_id", "is", null),
      supabase
        .from("tenant_payment_methods")
        .select("id, tenant_profile_id, stripe_payment_method_id, sepa_mandate_id")
        .eq("type", "sepa_debit"),
    ]);

    let updated = 0;

    for (const method of methods ?? []) {
      if ((method as any).sepa_mandate_id) continue;
      const match = (mandates ?? []).find(
        (mandate: any) =>
          mandate.tenant_profile_id === (method as any).tenant_profile_id &&
          mandate.stripe_payment_method_id === (method as any).stripe_payment_method_id
      );

      if (!match) continue;

      const { error } = await supabase
        .from("tenant_payment_methods")
        .update({ sepa_mandate_id: match.id })
        .eq("id", (method as any).id);

      if (!error) updated += 1;
    }

    results.push({ action: "sync_sepa_payment_method_links", updated });
  }

  return results;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
    rateLimit: "adminCritical",
    auditAction: "payments-production-readiness-report",
  });
  if (isAdminAuthError(auth)) return auth;

  const report = await buildReport();
  return NextResponse.json(report);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermissions(request, ["admin.accounting.write"], {
    rateLimit: "adminCritical",
    auditAction: "payments-production-readiness-repair",
  });
  if (isAdminAuthError(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as { actions?: unknown };
  const actions = Array.isArray(body?.actions)
    ? body.actions.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (actions.length === 0) {
    return NextResponse.json({ error: "Aucune action de reparation fournie" }, { status: 400 });
  }

  const repairs = await runRepairs(actions);
  const report = await buildReport();

  return NextResponse.json({
    success: true,
    repairs,
    report,
  });
}
