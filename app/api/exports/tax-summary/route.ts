export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { year, property_ids } = body;

    if (!year) {
      return NextResponse.json({ error: "Année requise" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Accès réservé aux propriétaires" }, { status: 403 });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    let query = supabase
      .from("invoices")
      .select("montant_total, montant_loyer, montant_charges, periode, statut")
      .eq("owner_id", profile.id)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (property_ids?.length) {
      const { data: leases } = await supabase
        .from("leases")
        .select("id")
        .in("property_id", property_ids);
      if (leases?.length) {
        query = query.in("lease_id", leases.map((l: { id: string }) => l.id));
      }
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error("[TaxSummary] Query error:", error);
      return NextResponse.json({ error: "Erreur de récupération" }, { status: 500 });
    }

    const totalRevenue = (invoices || []).reduce(
      (sum: number, inv: { montant_loyer?: number }) => sum + (inv.montant_loyer || 0),
      0
    );
    const totalCharges = (invoices || []).reduce(
      (sum: number, inv: { montant_charges?: number }) => sum + (inv.montant_charges || 0),
      0
    );

    return NextResponse.json({
      success: true,
      summary: {
        year,
        total_revenue: totalRevenue,
        total_charges: totalCharges,
        net_revenue: totalRevenue - totalCharges,
        invoice_count: invoices?.length || 0,
      },
    });
  } catch (error) {
    console.error("[TaxSummary] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
