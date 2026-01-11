/**
 * API Route: Finalize Bank Reconciliation
 * POST /api/accounting/reconciliation/:id/finalize - Valide et verrouille
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { FinalizeReconciliationSchema } from "@/lib/validations/accounting";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/accounting/reconciliation/:id/finalize
 * Valide et verrouille le rapprochement bancaire
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

    const { data: reconciliation } = await supabase
      .from("bank_reconciliations")
      .select("*")
      .eq("id", id)
      .single();

    if (!reconciliation) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    if (reconciliation.statut === "locked") {
      throw new ApiError(400, "Rapprochement déjà verrouillé");
    }

    const body = await request.json().catch(() => ({}));
    const validation = FinalizeReconciliationSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { force, notes } = validation.data;

    // Vérifier l'équilibre
    const ecart = Math.abs(reconciliation.solde_banque - reconciliation.solde_comptable);

    if (ecart > 0.01 && !force) {
      throw new ApiError(400,
        `Le rapprochement n'est pas équilibré (écart: ${ecart.toFixed(2)}€). ` +
        `Utilisez force=true pour forcer la validation.`
      );
    }

    // Compter les écritures non pointées de la période
    const [year, month] = reconciliation.periode.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];
    const journalCode = reconciliation.compte_type === "agence" ? "BQ" : "BM";

    const { count: unmatchedCount } = await supabase
      .from("accounting_entries")
      .select("*", { count: "exact", head: true })
      .eq("journal_code", journalCode)
      .gte("ecriture_date", startDate)
      .lte("ecriture_date", endDate)
      .is("ecriture_let", null);

    // Mettre à jour le rapprochement
    const { data: updated, error } = await supabase
      .from("bank_reconciliations")
      .update({
        statut: "locked",
        validated_at: new Date().toISOString(),
        validated_by: user.id,
        notes: notes ? `${reconciliation.notes || ""}\n[Validation] ${notes}`.trim() : reconciliation.notes,
        operations_non_pointees: reconciliation.operations_non_pointees,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, "Erreur lors de la validation");
    }

    return NextResponse.json({
      success: true,
      message: `Rapprochement ${reconciliation.periode} verrouillé`,
      data: {
        ...updated,
        summary: {
          solde_banque: reconciliation.solde_banque,
          solde_comptable: reconciliation.solde_comptable,
          ecart: ecart,
          ecritures_non_pointees: unmatchedCount || 0,
          force_applied: ecart > 0.01 && force,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
