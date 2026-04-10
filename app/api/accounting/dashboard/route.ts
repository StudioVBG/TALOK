/**
 * API Route: Dashboard comptable propriétaire
 * GET /api/accounting/dashboard?year=2025
 *
 * Feature gate: hasAccounting (plan Confort+)
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";
import { resolvePropertyIdsForEntity } from "@/lib/accounting/resolve-entity-filter";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Feature gate
    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "La comptabilité est disponible à partir du plan Confort.",
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // Profil
    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const ownerId = profile.id;

    // Paramètres
    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      throw new ApiError(400, "Année invalide");
    }

    // Entity filter
    const entityId = searchParams.get("entityId");
    const propIds = await resolvePropertyIdsForEntity(serviceClient, ownerId, entityId);

    // ────────────────────────────────────────────
    // 1. Baux actifs de l'année
    // ────────────────────────────────────────────

    let leasesQuery = serviceClient
      .from("leases")
      .select(`
        id, loyer, charges_forfaitaires, date_debut, date_fin, statut, property_id,
        property:properties!inner(id, adresse_complete)
      `)
      .eq("property.owner_id", ownerId)
      .in("statut", ["active", "terminated"]);
    if (propIds) leasesQuery = leasesQuery.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: leases } = await leasesQuery;

    // ────────────────────────────────────────────
    // 2. Factures de l'année
    // ────────────────────────────────────────────

    let invoicesQuery = serviceClient
      .from("invoices")
      .select("id, periode, montant_total, montant_loyer, montant_charges, statut, lease_id, property_id")
      .eq("owner_id", ownerId)
      .gte("periode", `${year}-01`)
      .lte("periode", `${year}-12`);
    if (propIds) invoicesQuery = invoicesQuery.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: invoices } = await invoicesQuery;

    // ────────────────────────────────────────────
    // 3. Paiements encaissés de l'année
    // ────────────────────────────────────────────

    let paymentsQuery = serviceClient
      .from("payments")
      .select(`
        id, montant, date_paiement,
        invoice:invoices!inner(owner_id, periode, lease_id, property_id)
      `)
      .eq("statut", "succeeded")
      .eq("invoice.owner_id", ownerId)
      .gte("date_paiement", `${year}-01-01`)
      .lte("date_paiement", `${year}-12-31`);
    if (propIds) paymentsQuery = paymentsQuery.in("invoice.property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: payments } = await paymentsQuery;

    // ────────────────────────────────────────────
    // 4. Dépenses de l'année
    // ────────────────────────────────────────────

    let expensesQuery = serviceClient
      .from("expenses")
      .select("id, montant, date_depense, category, property_id")
      .eq("owner_profile_id", ownerId).eq("statut", "confirmed")
      .gte("date_depense", `${year}-01-01`).lte("date_depense", `${year}-12-31`);
    if (propIds) expensesQuery = expensesQuery.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: expenseRows } = await expensesQuery;

    // ────────────────────────────────────────────
    // Calculs
    // ────────────────────────────────────────────

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allInvoices = (invoices || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPayments = (payments || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLeases = (leases || []) as any[];

    // Loyer attendu : somme des montants_total des factures émises
    const totalRentExpected = allInvoices.reduce(
      (sum, inv) => sum + (Number(inv.montant_total) || 0),
      0
    );
    const totalRentCollected = allPayments.reduce(
      (sum, p) => sum + (Number(p.montant) || 0),
      0
    );

    // Charges collectées
    const totalChargesCollected = allInvoices
      .filter((i) => i.statut === "paid")
      .reduce((sum, inv) => sum + (Number(inv.montant_charges) || 0), 0);

    // Impayés
    const unpaidInvoices = allInvoices.filter(
      (i) => i.statut === "late" || i.statut === "sent"
    );
    const unpaidCount = unpaidInvoices.length;
    const unpaidAmount = unpaidInvoices.reduce(
      (sum, inv) => sum + (Number(inv.montant_total) || 0),
      0
    );

    // ────────────────────────────────────────────
    // Commission de gestion (mandant_accounts)
    // ────────────────────────────────────────────
    // Pour un propriétaire géré par une agence (mandat de gestion signé),
    // on retrouve sa ligne dans `mandant_accounts` via `mandant_user_id`.
    // Le `commission_rate` (en %) s'applique au total des loyers encaissés.
    // Pour un propriétaire en gestion directe, aucune ligne => commission = 0.
    let commissionRate = 0;
    {
      const { data: mandate } = await (serviceClient as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (k: string, v: string) => {
              eq: (k: string, v: boolean) => {
                maybeSingle: () => Promise<{
                  data: { commission_rate: number | string | null } | null;
                }>;
              };
            };
          };
        };
      })
        .from("mandant_accounts")
        .select("commission_rate")
        .eq("mandant_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      commissionRate = Number(mandate?.commission_rate ?? 0) || 0;
    }
    const totalCommissions = Math.round(
      totalRentCollected * (commissionRate / 100) * 100,
    ) / 100;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allExpenses = (expenseRows || []) as any[];
    const totalExpenses = allExpenses.reduce(
      (sum: number, e: any) => sum + (Number(e.montant) || 0), 0
    );

    const netIncome = totalRentCollected - totalCommissions - totalExpenses;
    const collectionRate =
      totalRentExpected > 0
        ? Math.round((totalRentCollected / totalRentExpected) * 10000) / 100
        : 0;

    // ────────────────────────────────────────────
    // Ventilation mensuelle
    // ────────────────────────────────────────────

    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mm = String(month).padStart(2, "0");
      const prefix = `${year}-${mm}`;

      const monthInvoices = allInvoices.filter((inv) =>
        (inv.periode || "").startsWith(prefix)
      );
      const monthPayments = allPayments.filter((p) =>
        ((p as any).date_paiement || "").startsWith(prefix)
      );

      const rentExpected = monthInvoices.reduce(
        (sum: number, inv: any) => sum + (Number(inv.montant_total) || 0),
        0
      );
      const rentCollected = monthPayments.reduce(
        (sum: number, p: any) => sum + (Number(p.montant) || 0),
        0
      );
      const monthExpenses = allExpenses
        .filter((e: any) => (e.date_depense || "").startsWith(prefix))
        .reduce((sum: number, e: any) => sum + (Number(e.montant) || 0), 0);

      return {
        month,
        rentExpected,
        rentCollected,
        expenses: monthExpenses,
        netIncome: rentCollected - monthExpenses,
      };
    });

    // ────────────────────────────────────────────
    // Ventilation par bien
    // ────────────────────────────────────────────

    const propertyMap = new Map<
      string,
      { name: string; expected: number; collected: number }
    >();

    for (const lease of allLeases) {
      const propId = lease.property_id || lease.property?.id;
      const propName =
        lease.property?.adresse_complete || "Bien";
      if (propId && !propertyMap.has(propId)) {
        propertyMap.set(propId, { name: propName, expected: 0, collected: 0 });
      }
    }

    for (const inv of allInvoices) {
      const propId = inv.property_id;
      if (propId) {
        const entry = propertyMap.get(propId);
        if (entry) {
          entry.expected += Number(inv.montant_total) || 0;
        } else {
          propertyMap.set(propId, {
            name: "Bien",
            expected: Number(inv.montant_total) || 0,
            collected: 0,
          });
        }
      }
    }

    for (const p of allPayments) {
      const propId = (p.invoice as any)?.property_id;
      if (propId) {
        const entry = propertyMap.get(propId);
        if (entry) {
          entry.collected += Number(p.montant) || 0;
        }
      }
    }

    const byProperty = Array.from(propertyMap.entries()).map(
      ([propertyId, data]) => ({
        propertyId,
        propertyName: data.name,
        rentExpected: data.expected,
        rentCollected: data.collected,
        collectionRate:
          data.expected > 0
            ? Math.round((data.collected / data.expected) * 10000) / 100
            : 0,
        unpaidAmount: Math.max(0, data.expected - data.collected),
      })
    );

    return NextResponse.json({
      summary: {
        totalRentExpected,
        totalRentCollected,
        totalChargesCollected,
        totalCommissions,
        totalExpenses,
        netIncome,
        collectionRate,
        unpaidCount,
        unpaidAmount,
      },
      monthlyBreakdown,
      byProperty,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
