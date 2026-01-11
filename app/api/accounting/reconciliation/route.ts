/**
 * API Route: Bank Reconciliation
 * GET /api/accounting/reconciliation - Liste les rapprochements
 * POST /api/accounting/reconciliation - Crée un rapprochement
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { CreateReconciliationSchema } from "@/lib/validations/accounting";

export const dynamic = "force-dynamic";

/**
 * GET /api/accounting/reconciliation
 * Liste les rapprochements bancaires
 */
export async function GET(request: Request) {
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
      throw new ApiError(403, "Accès réservé aux administrateurs");
    }

    const { searchParams } = new URL(request.url);
    const compteType = searchParams.get("compte_type");
    const statut = searchParams.get("statut");
    const year = searchParams.get("year");
    const limit = parseInt(searchParams.get("limit") || "24");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("bank_reconciliations")
      .select("*", { count: "exact" });

    if (compteType) query = query.eq("compte_type", compteType);
    if (statut) query = query.eq("statut", statut);
    if (year) query = query.ilike("periode", `${year}-%`);

    query = query
      .order("periode", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: reconciliations, error, count } = await query;

    if (error) {
      console.error("[Reconciliation API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des rapprochements");
    }

    return NextResponse.json({
      success: true,
      data: reconciliations || [],
      meta: { total: count || 0, limit, offset },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/reconciliation
 * Crée un nouveau rapprochement bancaire
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
      throw new ApiError(403, "Accès réservé aux administrateurs");
    }

    const body = await request.json();
    const validation = CreateReconciliationSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;

    // Vérifier qu'il n'existe pas déjà un rapprochement pour cette période
    const { data: existing } = await supabase
      .from("bank_reconciliations")
      .select("id, statut")
      .eq("periode", data.periode)
      .eq("compte_type", data.compte_type)
      .single();

    if (existing) {
      if (existing.statut === "locked") {
        throw new ApiError(400, "Un rapprochement verrouillé existe déjà pour cette période");
      }
      // Retourner l'existant si en brouillon
      return NextResponse.json({
        success: true,
        data: existing,
        message: "Rapprochement existant retourné",
      });
    }

    const { data: reconciliation, error } = await supabase
      .from("bank_reconciliations")
      .insert({
        periode: data.periode,
        compte_type: data.compte_type,
        date_reconciliation: new Date().toISOString().split("T")[0],
        solde_banque: data.solde_banque,
        solde_comptable: data.solde_comptable,
        operations_non_pointees: [],
        statut: "draft",
        notes: data.notes,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[Reconciliation API] Erreur création:", error);
      throw new ApiError(500, "Erreur lors de la création du rapprochement");
    }

    return NextResponse.json({
      success: true,
      data: reconciliation,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
