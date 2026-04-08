/**
 * API Route: Récapitulatif fiscal PDF
 * GET /api/accounting/fiscal-summary?year=2025
 *
 * Feature gate: hasAccounting (plan Confort+)
 * Retourne un PDF téléchargeable
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";
import {
  generateFiscalSummaryPDF,
  type FiscalSummaryData,
} from "@/lib/accounting/fiscal-summary";
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

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Le récapitulatif fiscal est disponible à partir du plan Confort.",
          upgrade: true,
        },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, nom, prenom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propri��taires");
    }

    const ownerId = profile.id;
    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear())
    );

    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    const entityId = searchParams.get("entityId");
    const propIds = await resolvePropertyIdsForEntity(serviceClient, ownerId, entityId);

    // Fetch data for the PDF
    let paymentsQ = serviceClient
      .from("payments")
      .select(`
        id, montant, date_paiement,
        invoice:invoices!inner(owner_id, periode, montant_charges, property_id)
      `)
      .eq("statut", "succeeded")
      .eq("invoice.owner_id", ownerId)
      .gte("date_paiement", `${year}-01-01`)
      .lte("date_paiement", `${year}-12-31`);
    if (propIds) paymentsQ = paymentsQ.in("invoice.property_id", propIds.length > 0 ? propIds : ["__none__"]);

    let invoicesQ = serviceClient
      .from("invoices")
      .select("id, periode, montant_total, montant_loyer, montant_charges, statut, property_id")
      .eq("owner_id", ownerId)
      .gte("periode", `${year}-01`)
      .lte("periode", `${year}-12`);
    if (propIds) invoicesQ = invoicesQ.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);

    let expensesQ = serviceClient
      .from("expenses")
      .select("id, montant, date_depense, property_id")
      .eq("owner_profile_id", ownerId).eq("statut", "confirmed")
      .gte("date_depense", `${year}-01-01`).lte("date_depense", `${year}-12-31`);
    if (propIds) expensesQ = expensesQ.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);

    const { data: properties } = await serviceClient
      .from("properties")
      .select("id, adresse_complete")
      .eq("owner_id", ownerId);

    const propMap = new Map<string, string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (properties || []).map((p: any) => [p.id, p.adresse_complete || "Bien"])
    );

    const { data: payments } = await paymentsQ;
    const { data: invoices } = await invoicesQ;
    const { data: expenseRows } = await expensesQ;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allPayments = (payments || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allInvoices = (invoices || []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allExpenses = (expenseRows || []) as any[];

    const totalRentCollected = allPayments.reduce(
      (s, p) => s + (Number(p.montant) || 0),
      0
    );
    const totalChargesCollected = allInvoices
      .filter((i) => i.statut === "paid")
      .reduce((s, i) => s + (Number(i.montant_charges) || 0), 0);

    const totalExpenses = allExpenses.reduce(
      (s: number, e: any) => s + (Number(e.montant) || 0), 0
    );

    // Monthly breakdown
    const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const prefix = `${year}-${mm}`;
      const rentCollected = allPayments
        .filter((p: any) => (p.date_paiement || "").startsWith(prefix))
        .reduce((s: number, p: any) => s + (Number(p.montant) || 0), 0);
      const monthExpenses = allExpenses
        .filter((e: any) => (e.date_depense || "").startsWith(prefix))
        .reduce((s: number, e: any) => s + (Number(e.montant) || 0), 0);
      return { month: i + 1, rentCollected, expenses: monthExpenses, netIncome: rentCollected - monthExpenses };
    });

    // By property
    const propStats = new Map<string, { collected: number; unpaid: number }>();
    for (const p of allPayments) {
      const propId = (p.invoice as any)?.property_id;
      if (propId) {
        const e = propStats.get(propId) || { collected: 0, unpaid: 0 };
        e.collected += Number(p.montant) || 0;
        propStats.set(propId, e);
      }
    }
    for (const inv of allInvoices.filter((i) => i.statut === "late" || i.statut === "sent")) {
      const propId = inv.property_id;
      if (propId) {
        const e = propStats.get(propId) || { collected: 0, unpaid: 0 };
        e.unpaid += Number(inv.montant_total) || 0;
        propStats.set(propId, e);
      }
    }

    const byProperty = Array.from(propStats.entries()).map(([id, stats]) => ({
      propertyName: propMap.get(id) || "Bien",
      rentCollected: stats.collected,
      unpaidAmount: stats.unpaid,
    }));

    const ownerName = `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Propriétaire";

    const fiscalData: FiscalSummaryData = {
      year,
      ownerName,
      totalRentCollected,
      totalChargesCollected,
      totalCommissions: 0,
      totalExpenses,
      netIncome: totalRentCollected - totalExpenses,
      monthlyBreakdown,
      byProperty,
    };

    const pdfBytes = await generateFiscalSummaryPDF(fiscalData);

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Recap_fiscal_${year}_Talok.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
