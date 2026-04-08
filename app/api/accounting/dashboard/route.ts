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

    // ────────────────────────────────────────────
    // 1. Baux actifs de l'année
    // ────────────────────────────────────────────

    const { data: leases } = await serviceClient
      .from("leases")
      .select(`
        id,
        loyer,
        charges_forfaitaires,
        date_debut,
        date_fin,
        statut,
        property_id,
        property:properties!inner(id, adresse_complete)
      `)
      .eq("property.owner_id", ownerId)
      .in("statut", ["active", "terminated"]);

    // ────────────────────────────────────────────
    // 2. Factures de l'année
    // ────────────────────────────────────────────

    const { data: invoices } = await serviceClient
      .from("invoices")
      .select("id, periode, montant_total, montant_loyer, montant_charges, statut, lease_id, property_id")
      .eq("owner_id", ownerId)
      .gte("periode", `${year}-01`)
      .lte("periode", `${year}-12`);

    // ────────────────────────────────────────────
    // 3. Paiements encaissés de l'année
    // ────────────────────────────────────────────

    const { data: payments } = await serviceClient
      .from("payments")
      .select(`
        id,
        montant,
        date_paiement,
        statut,
        invoice_id,
        invoice:invoices!inner(
          owner_id,
          periode,
          lease_id,
          property_id
        )
      `)
      .eq("statut", "succeeded")
      .eq("invoice.owner_id", ownerId)
      .gte("date_paiement", `${year}-01-01`)
      .lte("date_paiement", `${year}-12-31`);

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

    // Commissions Talok — pas de table expenses, on estime 0 pour le MVP
    const totalCommissions = 0;
    const totalExpenses = 0;

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
        (sum, inv) => sum + (Number(inv.montant_total) || 0),
        0
      );
      const rentCollected = monthPayments.reduce(
        (sum, p) => sum + (Number(p.montant) || 0),
        0
      );

      return {
        month,
        rentExpected,
        rentCollected,
        expenses: 0,
        netIncome: rentCollected,
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
