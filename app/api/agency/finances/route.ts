export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/agency/finances?period=month|quarter|year
 *
 * Vue d'ensemble des flux financiers de l'agence sur la période demandée.
 * Agrège : invoices (loyers encaissés / en attente) + agency_commissions
 * (commissions générées) + agency_mandant_accounts (reversements via
 * last_reversement_at, approximation).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Period = "week" | "month" | "quarter" | "year";

interface FinanceTransaction {
  id: string;
  type: "loyer" | "commission" | "virement";
  description: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
}

const periodToInterval = (period: Period): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);
  switch (period) {
    case "week":
      start.setDate(now.getDate() - 7);
      break;
    case "quarter":
      start.setMonth(now.getMonth() - 3);
      break;
    case "year":
      start.setFullYear(now.getFullYear() - 1);
      break;
    case "month":
    default:
      start.setMonth(now.getMonth() - 1);
      break;
  }
  return { start, end };
};

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }
    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const period = (request.nextUrl.searchParams.get("period") ?? "month") as Period;
    const { start, end } = periodToInterval(period);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const { data: mandates } = await (supabase as any)
      .from("agency_mandates")
      .select("id, property_ids, owner:profiles!agency_mandates_owner_profile_id_fkey(prenom, nom)")
      .eq("agency_profile_id", profile.id);

    const propertyIds = new Set<string>();
    const ownerByMandate = new Map<string, string>();
    for (const m of (mandates ?? []) as Array<{
      id: string;
      property_ids: string[] | null;
      owner: { prenom: string | null; nom: string | null } | null;
    }>) {
      const ownerName = m.owner
        ? `${m.owner.prenom ?? ""} ${m.owner.nom ?? ""}`.trim() || "—"
        : "—";
      ownerByMandate.set(m.id, ownerName);
      for (const pid of m.property_ids ?? []) propertyIds.add(pid);
    }

    if (propertyIds.size === 0) {
      return NextResponse.json({
        stats: defaultStats(),
        transactions: [],
        period,
      });
    }

    const propIds = Array.from(propertyIds);

    const { data: leases } = await supabase
      .from("leases")
      .select("id, property_id, tenant:profiles!leases_tenant_id_fkey(prenom, nom)")
      .in("property_id", propIds);

    const leaseIds: string[] = [];
    const tenantByLease = new Map<string, string>();
    for (const l of (leases ?? []) as Array<{
      id: string;
      tenant: { prenom: string | null; nom: string | null } | null;
    }>) {
      leaseIds.push(l.id);
      tenantByLease.set(
        l.id,
        l.tenant
          ? `${l.tenant.prenom ?? ""} ${l.tenant.nom ?? ""}`.trim() || "Locataire"
          : "Locataire",
      );
    }

    const transactions: FinanceTransaction[] = [];
    let loyersEncaisses = 0;
    let loyersEnAttente = 0;

    if (leaseIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, lease_id, montant_total, statut, periode, created_at, updated_at")
        .in("lease_id", leaseIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(100);

      for (const inv of (invoices ?? []) as Array<{
        id: string;
        lease_id: string;
        montant_total: number | string | null;
        statut: string;
        created_at: string;
        updated_at: string;
      }>) {
        const amount = toNumber(inv.montant_total);
        const tenantName = tenantByLease.get(inv.lease_id) ?? "Locataire";
        if (inv.statut === "paid") {
          loyersEncaisses += amount;
          transactions.push({
            id: `inv-${inv.id}`,
            type: "loyer",
            description: `Loyer encaissé — ${tenantName}`,
            amount,
            date: inv.updated_at ?? inv.created_at,
            status: "completed",
          });
        } else if (inv.statut === "sent" || inv.statut === "late") {
          loyersEnAttente += amount;
          transactions.push({
            id: `inv-${inv.id}`,
            type: "loyer",
            description: `Loyer attendu — ${tenantName}`,
            amount,
            date: inv.created_at,
            status: "pending",
          });
        }
      }
    }

    let commissionsGenerees = 0;
    const mandateIds = Array.from(ownerByMandate.keys());
    if (mandateIds.length > 0) {
      const { data: commissions } = await supabase
        .from("agency_commissions")
        .select("id, mandate_id, montant_total_ttc, statut, periode, created_at")
        .in("mandate_id", mandateIds)
        .gte("created_at", startIso)
        .lte("created_at", endIso)
        .order("created_at", { ascending: false })
        .limit(100);

      for (const c of (commissions ?? []) as Array<{
        id: string;
        mandate_id: string;
        montant_total_ttc: number | string | null;
        statut: string;
        created_at: string;
      }>) {
        const amount = toNumber(c.montant_total_ttc);
        commissionsGenerees += amount;
        transactions.push({
          id: `com-${c.id}`,
          type: "commission",
          description: `Commission — ${ownerByMandate.get(c.mandate_id) ?? "Mandant"}`,
          amount: -Math.abs(amount),
          date: c.created_at,
          status: c.statut === "paid" ? "completed" : "pending",
        });
      }
    }

    let virementsEffectues = 0;
    // Note : les virements aux propriétaires ne sont pas encore implémentés
    // (cf. /api/agency/accounts/[id]/reverse — TODO bank transfer + écriture
    // comptable). Quand le pipeline Stripe Connect sera câblé, agréger ici
    // les écritures `accounting_entries` avec source = 'auto:agency_reversement'.
    void mandateIds;

    transactions.sort((a, b) => b.date.localeCompare(a.date));

    return NextResponse.json({
      stats: {
        loyersEncaisses,
        loyersEnAttente,
        commissionsGenerees,
        virementsEffectues,
      },
      transactions: transactions.slice(0, 50),
      period,
    });
  } catch (error) {
    console.error("[api/agency/finances] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}

function defaultStats() {
  return {
    loyersEncaisses: 0,
    loyersEnAttente: 0,
    commissionsGenerees: 0,
    virementsEffectues: 0,
  };
}
