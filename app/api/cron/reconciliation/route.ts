/**
 * CRON Job de réconciliation SOTA 2026
 *
 * Vérifie la cohérence entre:
 * - Factures et paiements
 * - Paiements en double
 * - Factures sans paiement après X jours
 * - Montants partiels
 *
 * Exécuter quotidiennement via Vercel Cron ou Edge Function
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET;

interface ReconciliationResult {
  timestamp: string;
  duration: number;
  checks: {
    name: string;
    status: "ok" | "warning" | "error";
    count: number;
    details?: unknown[];
  }[];
  summary: {
    total_checked: number;
    warnings: number;
    errors: number;
    auto_fixed: number;
  };
}

/**
 * GET /api/cron/reconciliation
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Vérifier l'autorisation
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const result: ReconciliationResult = {
    timestamp: new Date().toISOString(),
    duration: 0,
    checks: [],
    summary: {
      total_checked: 0,
      warnings: 0,
      errors: 0,
      auto_fixed: 0,
    },
  };

  try {
    // 1. Factures payées sans paiement confirmé
    const paidWithoutPayment = await checkPaidInvoicesWithoutPayment(serviceClient);
    result.checks.push(paidWithoutPayment);

    // 2. Paiements en double
    const duplicatePayments = await checkDuplicatePayments(serviceClient);
    result.checks.push(duplicatePayments);

    // 3. Factures impayées depuis plus de 30 jours
    const overdueInvoices = await checkOverdueInvoices(serviceClient);
    result.checks.push(overdueInvoices);

    // 4. Montants incohérents (paiement != facture)
    const amountMismatches = await checkAmountMismatches(serviceClient);
    result.checks.push(amountMismatches);

    // 5. Paiements orphelins (sans facture)
    const orphanPayments = await checkOrphanPayments(serviceClient);
    result.checks.push(orphanPayments);

    // 6. Mandats SEPA expirés avec baux actifs
    const expiredMandates = await checkExpiredMandates(serviceClient);
    result.checks.push(expiredMandates);

    // Calculer le résumé
    for (const check of result.checks) {
      result.summary.total_checked += check.count;
      if (check.status === "warning") result.summary.warnings++;
      if (check.status === "error") result.summary.errors++;
    }

    result.duration = Date.now() - startTime;

    // Logger le résultat
    await serviceClient.from("audit_log").insert({
      action: "reconciliation_complete",
      entity_type: "system",
      metadata: {
        duration: result.duration,
        warnings: result.summary.warnings,
        errors: result.summary.errors,
        auto_fixed: result.summary.auto_fixed,
      },
    });

    // Notifier si erreurs critiques
    if (result.summary.errors > 0) {
      await notifyAdmins(serviceClient, result);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Reconciliation] Erreur:", error);
    return NextResponse.json(
      { error: "Erreur de réconciliation", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}

/**
 * Vérifie les factures marquées payées mais sans paiement confirmé
 */
async function checkPaidInvoicesWithoutPayment(
  serviceClient: ReturnType<typeof createClient>
) {
  const { data: invoices, error } = await serviceClient
    .from("invoices")
    .select(`
      id,
      montant_total,
      statut,
      periode,
      payments(id, montant, statut)
    `)
    .eq("statut", "paid");

  if (error) throw error;

  const problematic = (invoices || []).filter((inv: any) => {
    const confirmedPayments = (inv.payments || []).filter(
      (p: any) => p.statut === "confirmed"
    );
    return confirmedPayments.length === 0;
  });

  return {
    name: "Factures payées sans paiement confirmé",
    status: problematic.length > 0 ? "error" : "ok",
    count: problematic.length,
    details: problematic.slice(0, 10).map((inv: any) => ({
      invoice_id: inv.id,
      periode: inv.periode,
      montant: inv.montant_total,
    })),
  } as const;
}

/**
 * Vérifie les paiements en double
 */
async function checkDuplicatePayments(
  serviceClient: ReturnType<typeof createClient>
) {
  const { data, error } = await serviceClient.rpc("find_duplicate_payments");

  if (error) {
    console.warn("[Reconciliation] RPC find_duplicate_payments non disponible");
    return {
      name: "Paiements en double",
      status: "ok" as const,
      count: 0,
    };
  }

  return {
    name: "Paiements en double",
    status: (data?.length || 0) > 0 ? "warning" : "ok",
    count: data?.length || 0,
    details: data?.slice(0, 10),
  } as const;
}

/**
 * Vérifie les factures impayées depuis plus de 30 jours
 */
async function checkOverdueInvoices(
  serviceClient: ReturnType<typeof createClient>
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: invoices, error } = await serviceClient
    .from("invoices")
    .select("id, montant_total, periode, created_at, statut")
    .in("statut", ["sent", "late"])
    .lt("created_at", thirtyDaysAgo.toISOString());

  if (error) throw error;

  // Mettre à jour le statut en "late" si nécessaire
  const toUpdate = (invoices || []).filter((inv: any) => inv.statut === "sent");
  if (toUpdate.length > 0) {
    await serviceClient
      .from("invoices")
      .update({ statut: "late" })
      .in("id", toUpdate.map((inv: any) => inv.id));
  }

  return {
    name: "Factures impayées > 30 jours",
    status: (invoices?.length || 0) > 0 ? "warning" : "ok",
    count: invoices?.length || 0,
    details: invoices?.slice(0, 10).map((inv: any) => ({
      invoice_id: inv.id,
      periode: inv.periode,
      montant: inv.montant_total,
      created_at: inv.created_at,
    })),
  } as const;
}

/**
 * Vérifie les incohérences de montant entre facture et paiements
 */
async function checkAmountMismatches(
  serviceClient: ReturnType<typeof createClient>
) {
  const { data: invoices, error } = await serviceClient
    .from("invoices")
    .select(`
      id,
      montant_total,
      statut,
      payments(montant, statut)
    `)
    .eq("statut", "paid");

  if (error) throw error;

  const mismatches = (invoices || []).filter((inv: any) => {
    const confirmedPayments = (inv.payments || []).filter(
      (p: any) => p.statut === "confirmed"
    );
    const totalPaid = confirmedPayments.reduce(
      (sum: number, p: any) => sum + (p.montant || 0),
      0
    );
    // Tolérance de 1 centime pour les arrondis
    return Math.abs(totalPaid - inv.montant_total) > 0.01;
  });

  return {
    name: "Incohérences montant facture/paiement",
    status: mismatches.length > 0 ? "error" : "ok",
    count: mismatches.length,
    details: mismatches.slice(0, 10).map((inv: any) => {
      const totalPaid = (inv.payments || [])
        .filter((p: any) => p.statut === "confirmed")
        .reduce((sum: number, p: any) => sum + (p.montant || 0), 0);
      return {
        invoice_id: inv.id,
        expected: inv.montant_total,
        actual: totalPaid,
        difference: totalPaid - inv.montant_total,
      };
    }),
  } as const;
}

/**
 * Vérifie les paiements sans facture associée
 */
async function checkOrphanPayments(
  serviceClient: ReturnType<typeof createClient>
) {
  const { data: payments, error } = await serviceClient
    .from("payments")
    .select("id, montant, created_at, invoice_id")
    .is("invoice_id", null)
    .eq("statut", "confirmed");

  if (error) throw error;

  return {
    name: "Paiements orphelins (sans facture)",
    status: (payments?.length || 0) > 0 ? "warning" : "ok",
    count: payments?.length || 0,
    details: payments?.slice(0, 10),
  } as const;
}

/**
 * Vérifie les mandats SEPA expirés avec baux actifs
 */
async function checkExpiredMandates(
  serviceClient: ReturnType<typeof createClient>
) {
  const { data: mandates, error } = await serviceClient
    .from("sepa_mandates")
    .select(`
      id,
      status,
      lease_id,
      leases!inner(statut)
    `)
    .in("status", ["expired", "cancelled", "failed"])
    .eq("leases.statut", "active");

  if (error) {
    // Table peut ne pas exister
    return {
      name: "Mandats SEPA expirés avec baux actifs",
      status: "ok" as const,
      count: 0,
    };
  }

  return {
    name: "Mandats SEPA expirés avec baux actifs",
    status: (mandates?.length || 0) > 0 ? "warning" : "ok",
    count: mandates?.length || 0,
    details: mandates?.slice(0, 10).map((m: any) => ({
      mandate_id: m.id,
      lease_id: m.lease_id,
      status: m.status,
    })),
  } as const;
}

/**
 * Notifie les admins en cas d'erreurs critiques
 */
async function notifyAdmins(
  serviceClient: ReturnType<typeof createClient>,
  result: ReconciliationResult
) {
  // Récupérer les admins
  const { data: admins } = await serviceClient
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!admins || admins.length === 0) return;

  const errorChecks = result.checks.filter((c) => c.status === "error");

  for (const admin of admins) {
    await serviceClient.from("notifications").insert({
      recipient_id: admin.id,
      type: "alert",
      title: "Réconciliation: erreurs détectées",
      message: `${result.summary.errors} problème(s) de cohérence détecté(s): ${errorChecks.map((c) => c.name).join(", ")}`,
      link: "/admin/reconciliation",
      priority: "high",
    });
  }

  // Émettre un événement pour alerting externe
  await serviceClient.from("outbox").insert({
    event_type: "System.ReconciliationErrors",
    payload: {
      errors: result.summary.errors,
      warnings: result.summary.warnings,
      checks: errorChecks,
    },
  });
}
