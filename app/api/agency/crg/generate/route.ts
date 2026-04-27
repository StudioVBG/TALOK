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
      .select(
        "id, agency_entity_id, management_fee_type, management_fee_rate, management_fee_fixed_cents, status",
      )
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

    // Calcul des totaux à partir des écritures comptables réelles
    // postées par mandant-payment-entry et mandant-reversement-entry.
    // Auparavant tout était hardcodé à 0 — le CRG montrait des
    // ressources nulles même quand les paiements remplissaient bien
    // les écritures sources.
    //
    // On agrège sur le sous-compte mandant 467MXXXXX (auxiliary
    // resolved par owner_profile_id du mandant) — les écritures
    // touchent toutes ce compte sur la branche mandant. La somme se
    // fait via les entry_lines pour avoir les montants nets, en
    // filtrant sur l'entité agence + la fenêtre de période.
    const agencyEntityId = (mandate as any).agency_entity_id as string;

    async function sumLinesBySource(source: string, account: string) {
      // On cumule les credits - debits sur le compte cible. Pour
      // 706100 (commissions) et 467 (mandant) la convention engine
      // est : credit = augmentation côté positif. Cf. les builders
      // dans engine.ts (auto:agency_*).
      const { data } = await (supabase as any)
        .from("accounting_entry_lines")
        .select(
          "debit_cents, credit_cents, accounting_entries!inner(entity_id, source, entry_date)",
        )
        .eq("accounting_entries.entity_id", agencyEntityId)
        .eq("accounting_entries.source", source)
        .gte("accounting_entries.entry_date", period_start)
        .lte("accounting_entries.entry_date", period_end)
        .like("account_number", `${account}%`);

      let total = 0;
      for (const row of (data ?? []) as Array<{
        debit_cents: number | null;
        credit_cents: number | null;
      }>) {
        total += (row.credit_cents ?? 0) - (row.debit_cents ?? 0);
      }
      return total;
    }

    // Loyers encaissés = crédit sur 467 par auto:agency_loyer_mandant
    const totalRentCollectedCents = await sumLinesBySource(
      "auto:agency_loyer_mandant",
      "467",
    );
    // Honoraires = crédit sur 706100 par auto:agency_commission
    const totalFeesCents = await sumLinesBySource(
      "auto:agency_commission",
      "706100",
    );
    // Reversements déjà effectués sur la période (signe négatif côté
    // 467 puisque l'écriture débite 467). On lit |total| pour rester
    // positif dans le résultat, puis on s'en sert dans l'unpaid si
    // besoin. Pour le moment, on n'expose pas dans le payload — la
    // colonne agency_crg n'a pas de slot dédié.
    // const totalReversedCents = Math.abs(
    //   await sumLinesBySource("auto:agency_reversement", "467"),
    // );

    const totalChargesPaidCents = 0; // À implémenter quand les
    // dépenses owner sous mandat seront tracées par auxiliary 467.

    // Net réversement à venir : ce que l'agence devrait reverser au
    // mandant pour la période = collecte - charges - honoraires.
    const netReversementCents =
      totalRentCollectedCents - totalChargesPaidCents - totalFeesCents;

    // Impayés : on compte les invoices ouvertes (non payées) sur la
    // période, scopées aux properties du mandat.
    const unpaidRentCents = 0; // À implémenter avec lookup invoices.

    // Sanity : les fees calculées via le mandant peuvent diverger du
    // taux mandat si management_fee a changé en cours de période.
    // C'est OK — l'engine a déjà appliqué le bon taux à chaque paiement.
    // On garde le mandate.management_fee_* uniquement pour audit.
    void mandate.management_fee_type;
    void mandate.management_fee_rate;
    void mandate.management_fee_fixed_cents;

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

    // PAS de mise à jour balance_cents ici. Le solde du compte
    // mandant est maintenu transactionnellement par
    // ensureMandantPaymentEntries (incrément à chaque paiement) et
    // ensureMandantReversementEntry (décrément à chaque reversement).
    // L'incrémenter à la génération du CRG provoquerait un
    // double-comptage massif (P0.5).

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
