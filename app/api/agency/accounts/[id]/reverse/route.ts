export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * POST /api/agency/accounts/[id]/reverse — Process reversement to mandant
 *
 * Transfers funds from mandant account to the owner's bank account.
 * Hoguet compliance: funds must be reversed within 30 days.
 */

const reverseSchema = z.object({
  amount_cents: z.number().positive("Le montant doit etre positif"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { amount_cents } = reverseSchema.parse(body);

    // Get account and verify ownership
    const { data: account } = await supabase
      .from("agency_mandant_accounts")
      .select(`
        id, balance_cents, mandate_id,
        mandate:agency_mandates!agency_mandant_accounts_mandate_id_fkey(
          agency_profile_id, mandant_bank_iban,
          owner:profiles!agency_mandates_owner_profile_id_fkey(
            prenom, nom
          )
        )
      `)
      .eq("id", id)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Compte mandant non trouve" }, { status: 404 });
    }

    const mandate = account.mandate as any;
    if (mandate?.agency_profile_id !== profile.id) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    if (amount_cents > account.balance_cents) {
      return NextResponse.json(
        { error: "Montant superieur au solde disponible" },
        { status: 400 }
      );
    }

    if (!mandate?.mandant_bank_iban) {
      return NextResponse.json(
        { error: "IBAN mandant non renseigne. Mettez a jour le mandat." },
        { status: 400 }
      );
    }

    // Process reversement
    const newBalance = account.balance_cents - amount_cents;
    const { data: updated, error: updateError } = await supabase
      .from("agency_mandant_accounts")
      .update({
        balance_cents: newBalance,
        last_reversement_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // TODO: Trigger actual bank transfer via payment provider
    // TODO: Create accounting entry for the reversement

    return NextResponse.json({
      account: updated,
      reversement: {
        amount_cents,
        iban: mandate.mandant_bank_iban,
        beneficiary: `${mandate.owner?.prenom || ""} ${mandate.owner?.nom || ""}`.trim(),
        processed_at: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Donnees invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[agency/accounts/[id]/reverse]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
