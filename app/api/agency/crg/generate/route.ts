export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * POST /api/agency/crg/generate — Generate a CRG for a mandate
 *
 * Creates a Compte Rendu de Gestion for a given mandate and period.
 * Calculates rent collected, fees, and net reversement.
 */

const generateSchema = z.object({
  mandate_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "agency") {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    const body = await request.json();
    const { mandate_id, period_start, period_end } = generateSchema.parse(body);

    // Verify mandate belongs to this agency
    const { data: mandate } = await supabase
      .from("agency_mandates")
      .select("id, management_fee_type, management_fee_rate, management_fee_fixed_cents, status")
      .eq("id", mandate_id)
      .eq("agency_profile_id", profile.id)
      .single();

    if (!mandate) {
      return NextResponse.json({ error: "Mandat non trouve" }, { status: 404 });
    }

    if (mandate.status !== "active") {
      return NextResponse.json(
        { error: "Le mandat doit etre actif pour generer un CRG" },
        { status: 400 }
      );
    }

    // Check for existing CRG for this period
    const { data: existingCrg } = await supabase
      .from("agency_crg")
      .select("id")
      .eq("mandate_id", mandate_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .single();

    if (existingCrg) {
      return NextResponse.json(
        { error: "Un CRG existe deja pour cette periode" },
        { status: 409 }
      );
    }

    // Calculate CRG amounts
    // In production, these would come from actual payment/invoice records
    // For now, we compute based on mandate data
    const totalRentCollectedCents = 0; // Would be summed from payments
    const totalChargesPaidCents = 0;   // Would be summed from expenses
    const unpaidRentCents = 0;          // Would be computed from unpaid invoices

    // Calculate fees
    let totalFeesCents = 0;
    if (mandate.management_fee_type === "percentage" && mandate.management_fee_rate) {
      totalFeesCents = Math.round(totalRentCollectedCents * (Number(mandate.management_fee_rate) / 100));
    } else if (mandate.management_fee_type === "fixed" && mandate.management_fee_fixed_cents) {
      totalFeesCents = mandate.management_fee_fixed_cents;
    }

    const netReversementCents = totalRentCollectedCents - totalChargesPaidCents - totalFeesCents;

    // Create CRG
    const { data: crg, error: createError } = await supabase
      .from("agency_crg")
      .insert({
        mandate_id,
        period_start,
        period_end,
        total_rent_collected_cents: totalRentCollectedCents,
        total_charges_paid_cents: totalChargesPaidCents,
        total_fees_cents: totalFeesCents,
        net_reversement_cents: netReversementCents,
        unpaid_rent_cents: unpaidRentCents,
        status: "generated",
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Update mandant account balance
    const { data: account } = await supabase
      .from("agency_mandant_accounts")
      .select("id, balance_cents")
      .eq("mandate_id", mandate_id)
      .single();

    if (account) {
      await supabase
        .from("agency_mandant_accounts")
        .update({
          balance_cents: account.balance_cents + netReversementCents,
        })
        .eq("id", account.id);
    } else {
      // Create account if it doesn't exist
      await supabase
        .from("agency_mandant_accounts")
        .insert({
          mandate_id,
          balance_cents: netReversementCents,
        });
    }

    return NextResponse.json({ crg }, { status: 201 });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Donnees invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[agency/crg/generate]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
