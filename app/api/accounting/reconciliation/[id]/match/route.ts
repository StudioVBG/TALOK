/**
 * API Route: Match Bank Transaction
 * POST /api/accounting/reconciliation/:id/match - Pointer une transaction
 * DELETE /api/accounting/reconciliation/:id/match - Dépointer
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const MatchSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1, "Au moins une écriture requise"),
  lettrage: z.string().max(10).optional(),
});

const UnmatchSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1),
});

/**
 * POST /api/accounting/reconciliation/:id/match
 * Pointer des écritures (lettrage)
 */
export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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
      throw new ApiError(403, "Accès réservé aux administrateurs");
    }

    // Vérifier le rapprochement
    const { data: reconciliation } = await supabase
      .from("bank_reconciliations")
      .select("id, statut, periode")
      .eq("id", id)
      .single();

    if (!reconciliation) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    if (reconciliation.statut === "locked") {
      throw new ApiError(400, "Rapprochement verrouillé");
    }

    const body = await request.json();
    const validation = MatchSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entry_ids, lettrage } = validation.data;

    // Générer un code de lettrage si non fourni
    const lettrageCode = lettrage || `L${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const today = new Date().toISOString().split("T")[0];

    // Vérifier que les écritures existent et ne sont pas déjà pointées
    const { data: entries, error: fetchError } = await supabase
      .from("accounting_entries")
      .select("id, ecriture_num, ecriture_let, debit, credit")
      .in("id", entry_ids);

    if (fetchError || !entries || entries.length !== entry_ids.length) {
      throw new ApiError(400, "Certaines écritures n'existent pas");
    }

    const alreadyMatched = entries.filter(e => e.ecriture_let);
    if (alreadyMatched.length > 0) {
      throw new ApiError(400, `${alreadyMatched.length} écriture(s) déjà pointée(s)`);
    }

    // Vérifier l'équilibre des écritures à pointer
    const totals = entries.reduce(
      (acc, e) => ({
        debit: acc.debit + (e.debit || 0),
        credit: acc.credit + (e.credit || 0),
      }),
      { debit: 0, credit: 0 }
    );

    if (Math.abs(totals.debit - totals.credit) > 0.01) {
      throw new ApiError(400,
        `Les écritures ne sont pas équilibrées: Débit=${totals.debit.toFixed(2)}, Crédit=${totals.credit.toFixed(2)}`
      );
    }

    // Pointer les écritures
    const { error: updateError, count } = await supabase
      .from("accounting_entries")
      .update({
        ecriture_let: lettrageCode,
        date_let: today,
      })
      .in("id", entry_ids);

    if (updateError) {
      throw new ApiError(500, "Erreur lors du pointage");
    }

    return NextResponse.json({
      success: true,
      message: `${count} écriture(s) pointée(s)`,
      data: {
        lettrage: lettrageCode,
        date_lettrage: today,
        entries_matched: count,
        balance: {
          debit: totals.debit,
          credit: totals.credit,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/accounting/reconciliation/:id/match
 * Dépointer des écritures
 */
export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
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
      throw new ApiError(403, "Accès réservé aux administrateurs");
    }

    const { data: reconciliation } = await supabase
      .from("bank_reconciliations")
      .select("id, statut")
      .eq("id", id)
      .single();

    if (!reconciliation) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    if (reconciliation.statut === "locked") {
      throw new ApiError(400, "Rapprochement verrouillé");
    }

    const body = await request.json();
    const validation = UnmatchSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { error, count } = await supabase
      .from("accounting_entries")
      .update({
        ecriture_let: null,
        date_let: null,
      })
      .in("id", validation.data.entry_ids);

    if (error) {
      throw new ApiError(500, "Erreur lors du dépointage");
    }

    return NextResponse.json({
      success: true,
      message: `${count} écriture(s) dépointée(s)`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
