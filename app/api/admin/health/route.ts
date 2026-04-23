export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/health
 * Dashboard santé système : latence DB, erreurs crons, volumétries clés,
 * statut des intégrations critiques.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { isStripeServerConfigured } from "@/lib/stripe";

type Status = "ok" | "warning" | "critical";

interface HealthCheck {
  name: string;
  status: Status;
  latency_ms?: number;
  message?: string;
  value?: number | string;
}

export async function GET(request: Request) {
  const auth = await requireAdminPermissions(request, ["admin.reports.read"], {
    rateLimit: "adminStandard",
    auditAction: "Consultation de la santé plateforme",
  });
  if (isAdminAuthError(auth)) return auth;

  const checks: HealthCheck[] = [];
  const supabase = createServiceRoleClient();

  // 1. Latence DB (SELECT 1 via un count léger)
  const dbStart = Date.now();
  try {
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const latency = Date.now() - dbStart;
    checks.push({
      name: "Base de données",
      status: error ? "critical" : latency > 500 ? "warning" : "ok",
      latency_ms: latency,
      message: error ? error.message : `Latence p50 ${latency} ms`,
    });
  } catch (e) {
    checks.push({
      name: "Base de données",
      status: "critical",
      message: e instanceof Error ? e.message : "Erreur inconnue",
    });
  }

  // 2. Crons en erreur sur les dernières 24h
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count: cronErrors } = await supabase
      .from("cron_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error")
      .gte("started_at", since24h);
    checks.push({
      name: "Tâches planifiées (24 h)",
      status: (cronErrors || 0) === 0 ? "ok" : (cronErrors || 0) > 5 ? "critical" : "warning",
      value: cronErrors || 0,
      message:
        (cronErrors || 0) === 0
          ? "Aucune erreur sur les dernières 24 heures"
          : `${cronErrors} exécution${(cronErrors || 0) > 1 ? "s" : ""} en erreur`,
    });
  } catch {
    checks.push({
      name: "Tâches planifiées (24 h)",
      status: "warning",
      message: "Table cron_logs inaccessible",
    });
  }

  // 3. Webhooks Stripe en échec (audit_logs action LIKE 'stripe_webhook_failed')
  try {
    const { count: webhookErrors } = await supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .ilike("action", "%stripe_webhook_failed%")
      .gte("created_at", since24h);
    checks.push({
      name: "Webhooks Stripe (24 h)",
      status:
        (webhookErrors || 0) === 0 ? "ok" : (webhookErrors || 0) > 10 ? "critical" : "warning",
      value: webhookErrors || 0,
      message:
        (webhookErrors || 0) === 0
          ? "Aucun webhook en échec"
          : `${webhookErrors} webhook${(webhookErrors || 0) > 1 ? "s" : ""} en échec`,
    });
  } catch {
    // Silencieux — si audit_logs n'existe pas ou RLS bloque
  }

  // 4. Configuration Stripe
  checks.push({
    name: "Intégration Stripe",
    status: isStripeServerConfigured() ? "ok" : "critical",
    message: isStripeServerConfigured()
      ? "STRIPE_SECRET_KEY configurée"
      : "STRIPE_SECRET_KEY manquante",
  });

  // 5. Volumétrie utilisateurs
  try {
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    const { count: usersToday } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h);
    checks.push({
      name: "Utilisateurs",
      status: "ok",
      value: totalUsers || 0,
      message: `${totalUsers || 0} utilisateurs totaux · +${usersToday || 0} depuis 24 h`,
    });
  } catch {
    // ignore
  }

  // 6. Uploads en erreur dernière heure (si table disponible)
  // — optionnel, dépend de la colonne audit_logs.entity_type
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { count: uploadErrors } = await supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("success", false)
      .gte("created_at", since1h);
    if (typeof uploadErrors === "number") {
      checks.push({
        name: "Actions en erreur (1 h)",
        status:
          uploadErrors === 0 ? "ok" : uploadErrors > 20 ? "critical" : "warning",
        value: uploadErrors,
        message:
          uploadErrors === 0
            ? "Aucune action en erreur"
            : `${uploadErrors} action${uploadErrors > 1 ? "s" : ""} en échec dans audit_logs`,
      });
    }
  } catch {
    // ignore
  }

  const worst: Status = checks.reduce<Status>((worst, c) => {
    if (worst === "critical" || c.status === "critical") return "critical";
    if (worst === "warning" || c.status === "warning") return "warning";
    return "ok";
  }, "ok");

  return NextResponse.json({
    status: worst,
    checked_at: new Date().toISOString(),
    checks,
  });
}
