export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/accounting/gl - Récupérer le grand-livre agrégé
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";

    if (scope === "global" && !isAdmin) {
      return NextResponse.json(
        { error: "Seul l'admin peut voir le grand-livre global" },
        { status: 403 }
      );
    }

    // Récupérer les factures
    let invoicesQuery = supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          property:properties!inner(owner_id)
        )
      `);

    if (scope === "owner") {
      invoicesQuery = invoicesQuery.eq("lease.property.owner_id", profileData?.id as any);
    }

    if (startDate) {
      // @ts-ignore - Supabase typing issue
      invoicesQuery = invoicesQuery.gte("periode", startDate);
    }

    if (endDate) {
      // @ts-ignore - Supabase typing issue
      invoicesQuery = invoicesQuery.lte("periode", endDate);
    }

    const { data: invoices } = await invoicesQuery;

    // Agréger par mois
    const monthlyAggregates: Record<string, any> = {};
    const invoicesData = (invoices || []) as any[];
    for (const invoice of invoicesData) {
      const month = invoice.periode;
      if (!monthlyAggregates[month]) {
        monthlyAggregates[month] = {
          month,
          total_invoices: 0,
          total_amount: 0,
          paid_amount: 0,
          unpaid_amount: 0,
        };
      }
      monthlyAggregates[month].total_invoices++;
      monthlyAggregates[month].total_amount += parseFloat(invoice.montant_total || 0);
      if (invoice.statut === "paid") {
        monthlyAggregates[month].paid_amount += parseFloat(invoice.montant_total || 0);
      } else {
        monthlyAggregates[month].unpaid_amount += parseFloat(invoice.montant_total || 0);
      }
    }

    return NextResponse.json({
      aggregates: Object.values(monthlyAggregates),
      scope,
      period: { start_date: startDate, end_date: endDate },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

