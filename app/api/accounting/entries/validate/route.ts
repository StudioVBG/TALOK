/**
 * API Route: Validate Accounting Entries
 * POST /api/accounting/entries/validate - Valide des écritures comptables
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ValidateSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1, "Au moins une écriture requise"),
  validation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/accounting/entries/validate
 * Valide un lot d'écritures comptables
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Seuls les administrateurs peuvent valider les écritures");
    }

    const body = await request.json();
    const validation = ValidateSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entry_ids, validation_date } = validation.data;
    const validDate = validation_date || new Date().toISOString().split("T")[0];

    // Vérifier que toutes les écritures existent et ne sont pas déjà validées
    const { data: entries, error: fetchError } = await supabase
      .from("accounting_entries")
      .select("id, ecriture_num, valid_date, journal_code, debit, credit")
      .in("id", entry_ids);

    if (fetchError) {
      throw new ApiError(500, "Erreur lors de la vérification des écritures");
    }

    if (!entries || entries.length !== entry_ids.length) {
      throw new ApiError(400, "Certaines écritures n'existent pas");
    }

    const alreadyValidated = entries.filter(e => e.valid_date);
    if (alreadyValidated.length > 0) {
      throw new ApiError(400, `${alreadyValidated.length} écriture(s) déjà validée(s)`);
    }

    // Vérifier l'équilibre par journal
    const byJournal = entries.reduce((acc, e) => {
      if (!acc[e.journal_code]) {
        acc[e.journal_code] = { debit: 0, credit: 0 };
      }
      acc[e.journal_code].debit += e.debit || 0;
      acc[e.journal_code].credit += e.credit || 0;
      return acc;
    }, {} as Record<string, { debit: number; credit: number }>);

    const unbalanced = Object.entries(byJournal).filter(
      ([, v]) => Math.abs(v.debit - v.credit) > 0.01
    );

    if (unbalanced.length > 0) {
      const details = unbalanced.map(([j, v]) =>
        `${j}: Débit=${v.debit.toFixed(2)}, Crédit=${v.credit.toFixed(2)}`
      ).join("; ");
      throw new ApiError(400, `Écritures non équilibrées: ${details}`);
    }

    // Valider les écritures
    const { error: updateError, count } = await supabase
      .from("accounting_entries")
      .update({ valid_date: validDate })
      .in("id", entry_ids)
      .is("valid_date", null);

    if (updateError) {
      console.error("[Entries API] Erreur validation:", updateError);
      throw new ApiError(500, "Erreur lors de la validation");
    }

    return NextResponse.json({
      success: true,
      message: `${count} écriture(s) validée(s)`,
      data: {
        validated_count: count,
        validation_date: validDate,
        journals_validated: Object.keys(byJournal),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
