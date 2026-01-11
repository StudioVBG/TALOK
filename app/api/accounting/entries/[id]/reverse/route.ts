/**
 * API Route: Reverse Accounting Entry
 * POST /api/accounting/entries/:id/reverse - Crée une écriture d'extourne
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const ReverseSchema = z.object({
  motif: z.string().min(1, "Le motif est requis").max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * POST /api/accounting/entries/:id/reverse
 * Crée une écriture d'extourne (inverse) pour annuler une écriture validée
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
      throw new ApiError(403, "Seuls les administrateurs peuvent extourner des écritures");
    }

    const body = await request.json();
    const validation = ReverseSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { motif, date } = validation.data;
    const reversalDate = date || new Date().toISOString().split("T")[0];

    // Récupérer l'écriture originale
    const { data: original, error: fetchError } = await supabase
      .from("accounting_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !original) {
      throw new ApiError(404, "Écriture non trouvée");
    }

    // Générer le numéro d'écriture d'extourne
    const year = reversalDate.substring(0, 4);
    const { count } = await supabase
      .from("accounting_entries")
      .select("*", { count: "exact", head: true })
      .eq("journal_code", "OD")
      .gte("ecriture_date", `${year}-01-01`)
      .lte("ecriture_date", `${year}-12-31`);

    const ecritureNum = `OD-${year}-${String((count || 0) + 1).padStart(6, "0")}`;

    // Créer l'écriture d'extourne (inverse les débits/crédits)
    const { data: reversal, error: insertError } = await supabase
      .from("accounting_entries")
      .insert({
        journal_code: "OD", // Opérations Diverses pour les extournes
        ecriture_num: ecritureNum,
        ecriture_date: reversalDate,
        compte_num: original.compte_num,
        compte_lib: original.compte_lib,
        compte_aux_num: original.compte_aux_num,
        compte_aux_lib: original.compte_aux_lib,
        piece_ref: `EXT-${original.piece_ref}`,
        piece_date: reversalDate,
        ecriture_lib: `Extourne: ${motif} (réf: ${original.ecriture_num})`,
        debit: original.credit, // Inverse
        credit: original.debit, // Inverse
        owner_id: original.owner_id,
        property_id: original.property_id,
        invoice_id: original.invoice_id,
        payment_id: original.payment_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Entries API] Erreur création extourne:", insertError);
      throw new ApiError(500, "Erreur lors de la création de l'extourne");
    }

    // Si l'écriture originale affectait un compte mandant, mettre à jour le solde
    if (original.owner_id && original.compte_num.startsWith("4671")) {
      // Inverser l'impact sur le solde mandant propriétaire
      await supabase.rpc("update_mandant_balance", {
        p_profile_id: original.owner_id,
        p_property_id: original.property_id,
        p_account_type: "proprietaire",
        p_debit: original.credit, // Inverse
        p_credit: original.debit, // Inverse
      });
    }

    return NextResponse.json({
      success: true,
      message: `Écriture d'extourne créée: ${ecritureNum}`,
      data: {
        original: original,
        reversal: reversal,
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
