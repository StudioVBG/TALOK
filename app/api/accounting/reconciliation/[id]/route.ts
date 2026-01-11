/**
 * API Route: Bank Reconciliation Detail
 * GET /api/accounting/reconciliation/:id - Détail d'un rapprochement
 * PUT /api/accounting/reconciliation/:id - Mise à jour
 * DELETE /api/accounting/reconciliation/:id - Suppression (brouillon uniquement)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/accounting/reconciliation/:id
 */
export async function GET(request: Request, context: Context) {
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

    const { data: reconciliation, error } = await supabase
      .from("bank_reconciliations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !reconciliation) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    // Récupérer les écritures non pointées pour la période
    const [year, month] = reconciliation.periode.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split("T")[0];

    const journalCode = reconciliation.compte_type === "agence" ? "BQ" : "BM";

    const { data: unmatched } = await supabase
      .from("accounting_entries")
      .select("id, ecriture_num, ecriture_date, ecriture_lib, debit, credit, ecriture_let")
      .eq("journal_code", journalCode)
      .gte("ecriture_date", startDate)
      .lte("ecriture_date", endDate)
      .is("ecriture_let", null)
      .order("ecriture_date", { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...reconciliation,
        unmatched_entries: unmatched || [],
        unmatched_count: unmatched?.length || 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/accounting/reconciliation/:id
 */
export async function PUT(request: Request, context: Context) {
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

    const { data: existing } = await supabase
      .from("bank_reconciliations")
      .select("id, statut")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    if (existing.statut === "locked") {
      throw new ApiError(400, "Impossible de modifier un rapprochement verrouillé");
    }

    const body = await request.json();
    const { solde_banque, solde_comptable, operations_non_pointees, notes } = body;

    const { data: reconciliation, error } = await supabase
      .from("bank_reconciliations")
      .update({
        solde_banque: solde_banque !== undefined ? solde_banque : undefined,
        solde_comptable: solde_comptable !== undefined ? solde_comptable : undefined,
        operations_non_pointees: operations_non_pointees !== undefined ? operations_non_pointees : undefined,
        notes: notes !== undefined ? notes : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, "Erreur lors de la mise à jour");
    }

    return NextResponse.json({ success: true, data: reconciliation });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/accounting/reconciliation/:id
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

    const { data: existing } = await supabase
      .from("bank_reconciliations")
      .select("id, statut, periode")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new ApiError(404, "Rapprochement non trouvé");
    }

    if (existing.statut !== "draft") {
      throw new ApiError(400, "Seuls les rapprochements en brouillon peuvent être supprimés");
    }

    const { error } = await supabase
      .from("bank_reconciliations")
      .delete()
      .eq("id", id);

    if (error) {
      throw new ApiError(500, "Erreur lors de la suppression");
    }

    return NextResponse.json({
      success: true,
      message: `Rapprochement ${existing.periode} supprimé`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
