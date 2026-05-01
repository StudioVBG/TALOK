/**
 * API Route: Syndic Copropriété — Exercise Closing
 * POST /api/accounting/syndic/close - Close copro exercise
 *
 * 1. Verify all entries validated
 * 2. Repartition: distribute class 6 charges among lots by tantièmes
 * 3. Create solde entries to zero out class 6/7
 * 4. Verify result = 0 (adjust rounding if needed)
 * 5. Lock exercise
 * 6. Return closing summary + trigger annexe generation
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import {
  createEntry,
  validateEntry,
  getBalance,
  closeExercise,
} from "@/lib/accounting/engine";
import { getCoproAccount } from "@/lib/accounting/syndic/fund-calls";
import { generateCoproAnnexes } from "@/lib/accounting/syndic/annexes";
import { logCoproAction } from "@/lib/audit/copro-audit";

export const dynamic = "force-dynamic";

const CloseSchema = z.object({
  entityId: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

/**
 * POST /api/accounting/syndic/close
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CloseSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, exerciseId } = validation.data;

    // Verify exercise exists and is open
    const { data: exercise, error: exErr } = await (supabase as any)
      .from("accounting_exercises")
      .select("*")
      .eq("id", exerciseId)
      .eq("entity_id", entityId)
      .single();

    if (exErr || !exercise) {
      throw new ApiError(404, "Exercice non trouve");
    }

    if (exercise.status === "closed") {
      throw new ApiError(400, "Exercice deja cloture");
    }

    // Step 1: Verify all entries validated
    const { count: unvalidatedCount } = await supabase
      .from("accounting_entries")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", exerciseId)
      .eq("entity_id", entityId)
      .eq("is_validated", false);

    if (unvalidatedCount && unvalidatedCount > 0) {
      throw new ApiError(
        409,
        `Impossible de cloturer: ${unvalidatedCount} ecriture(s) non validee(s)`,
      );
    }

    // Load balance
    const balance = await getBalance(supabase, entityId, exerciseId);

    // Step 2: Repartition — distribute class 6 charges among lots by tantièmes
    const class6Accounts = balance.filter((b) =>
      b.accountNumber.startsWith("6"),
    );
    const class7Accounts = balance.filter((b) =>
      b.accountNumber.startsWith("7"),
    );

    // Total charges (class 6 = debit balances)
    const totalCharges = class6Accounts.reduce(
      (sum, b) => sum + b.soldeDebitCents,
      0,
    );
    // Total produits (class 7 = credit balances)
    const totalProduits = class7Accounts.reduce(
      (sum, b) => sum + b.soldeCreditCents,
      0,
    );

    // Load active lots for repartition
    const { data: lots } = await (supabase as any)
      .from("copro_lots")
      .select("*")
      .eq("copro_entity_id", entityId)
      .eq("is_active", true)
      .order("lot_number");

    if (!lots || lots.length === 0) {
      throw new ApiError(400, "Aucun lot actif pour la repartition");
    }

    const totalTantiemes = lots.reduce(
      (sum: number, l: any) => sum + (l.tantiemes_generaux as number),
      0,
    );

    const today = new Date().toISOString().split("T")[0];
    const closingEntries: string[] = [];

    // Step 3: Create closing entries to zero out class 6 accounts
    // For each class 6 account with a balance, distribute to copro accounts
    for (const account of class6Accounts) {
      const solde = account.soldeDebitCents;
      if (solde <= 0) continue;

      // Zero out the class 6 account (credit it)
      // and distribute debit to copro accounts by tantièmes
      const lines: Array<{
        accountNumber: string;
        debitCents: number;
        creditCents: number;
        label?: string;
      }> = [];

      // Credit the class 6 account to zero it
      lines.push({
        accountNumber: account.accountNumber,
        debitCents: 0,
        creditCents: solde,
        label: `Solde ${account.label}`,
      });

      // Debit copro accounts proportionally
      let allocated = 0;
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const lotTantiemes = lot.tantiemes_generaux as number;
        const isLast = i === lots.length - 1;

        const lotAmount = isLast
          ? solde - allocated
          : Math.round((solde * lotTantiemes) / totalTantiemes);

        if (lotAmount <= 0) continue;
        allocated += lotAmount;

        const coproAccount = getCoproAccount(lot.lot_number as string);
        lines.push({
          accountNumber: coproAccount,
          debitCents: lotAmount,
          creditCents: 0,
          label: `Repartition ${account.label} — lot ${lot.lot_number}`,
        });
      }

      if (lines.length >= 2) {
        const entry = await createEntry(supabase, {
          entityId,
          exerciseId,
          journalCode: "CL",
          entryDate: today,
          label: `Cloture — repartition ${account.label}`,
          source: "auto:copro_closing",
          userId: user.id,
          lines,
        });

        await validateEntry(supabase, entry.id, user.id);
        closingEntries.push(entry.id);
      }
    }

    // Zero out class 7 accounts (credit balance → debit to zero, credit to copro)
    for (const account of class7Accounts) {
      const solde = account.soldeCreditCents;
      if (solde <= 0) continue;

      const lines: Array<{
        accountNumber: string;
        debitCents: number;
        creditCents: number;
        label?: string;
      }> = [];

      // Debit the class 7 account to zero it
      lines.push({
        accountNumber: account.accountNumber,
        debitCents: solde,
        creditCents: 0,
        label: `Solde ${account.label}`,
      });

      // Credit copro accounts proportionally
      let allocated = 0;
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const lotTantiemes = lot.tantiemes_generaux as number;
        const isLast = i === lots.length - 1;

        const lotAmount = isLast
          ? solde - allocated
          : Math.round((solde * lotTantiemes) / totalTantiemes);

        if (lotAmount <= 0) continue;
        allocated += lotAmount;

        const coproAccount = getCoproAccount(lot.lot_number as string);
        lines.push({
          accountNumber: coproAccount,
          debitCents: 0,
          creditCents: lotAmount,
          label: `Repartition ${account.label} — lot ${lot.lot_number}`,
        });
      }

      if (lines.length >= 2) {
        const entry = await createEntry(supabase, {
          entityId,
          exerciseId,
          journalCode: "CL",
          entryDate: today,
          label: `Cloture — solde ${account.label}`,
          source: "auto:copro_closing",
          userId: user.id,
          lines,
        });

        await validateEntry(supabase, entry.id, user.id);
        closingEntries.push(entry.id);
      }
    }

    // Step 4: Verify result = 0 after closing entries
    const postBalance = await getBalance(supabase, entityId, exerciseId);
    const postClass6 = postBalance
      .filter((b) => b.accountNumber.startsWith("6"))
      .reduce((s, b) => s + b.soldeDebitCents - b.soldeCreditCents, 0);
    const postClass7 = postBalance
      .filter((b) => b.accountNumber.startsWith("7"))
      .reduce((s, b) => s + b.soldeCreditCents - b.soldeDebitCents, 0);

    const residual = postClass6 - postClass7;

    // Adjust rounding if small residual remains
    if (residual !== 0 && Math.abs(residual) <= lots.length) {
      const adjustEntry = await createEntry(supabase, {
        entityId,
        exerciseId,
        journalCode: "CL",
        entryDate: today,
        label: "Ajustement arrondi cloture copro",
        source: "auto:copro_closing_rounding",
        userId: user.id,
        lines:
          residual > 0
            ? [
                {
                  accountNumber: "671000",
                  debitCents: 0,
                  creditCents: residual,
                },
                {
                  accountNumber: "450000",
                  debitCents: residual,
                  creditCents: 0,
                },
              ]
            : [
                {
                  accountNumber: "718000",
                  debitCents: Math.abs(residual),
                  creditCents: 0,
                },
                {
                  accountNumber: "450000",
                  debitCents: 0,
                  creditCents: Math.abs(residual),
                },
              ],
      });

      await validateEntry(supabase, adjustEntry.id, user.id);
      closingEntries.push(adjustEntry.id);
    }

    // Step 5: Lock exercise
    await closeExercise(supabase, exerciseId, user.id);

    // Step 6: Generate annexes
    let annexes = null;
    try {
      annexes = await generateCoproAnnexes(supabase, entityId, exerciseId);
    } catch {
      // Non-blocking: annexes generation failure doesn't prevent closing
    }

    // Audit trail (action critical : clôture exercice = irréversible, impact comptable + fiscal)
    await logCoproAction({
      userId: user.id,
      profileId: profile.id,
      action: "close",
      entityType: "copro_accounting_close",
      entityId: exerciseId,
      siteId: entityId,
      riskLevel: "critical",
      metadata: {
        total_charges_cents: totalCharges,
        total_produits_cents: totalProduits,
        closing_entries_count: closingEntries.length,
        lots_count: lots.length,
        total_tantiemes: totalTantiemes,
        annexes_generated: annexes !== null,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      data: {
        closedExercise: exerciseId,
        totalChargesCents: totalCharges,
        totalProduitsCents: totalProduits,
        closingEntries: closingEntries.length,
        lotsCount: lots.length,
        totalTantiemes,
        residualAdjusted: residual !== 0 && Math.abs(residual) <= lots.length,
        annexes,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unvalidated entries remain")
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    }
    return handleApiError(error);
  }
}
