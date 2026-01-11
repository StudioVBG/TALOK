/**
 * API Route: Accounting Entry Detail
 * GET /api/accounting/entries/:id - Détail d'une écriture
 * PUT /api/accounting/entries/:id - Modifier une écriture (avant validation)
 * DELETE /api/accounting/entries/:id - Supprimer une écriture (avant validation)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const UpdateEntrySchema = z.object({
  ecriture_lib: z.string().min(1).max(255).optional(),
  compte_aux_num: z.string().max(20).optional().nullable(),
  compte_aux_lib: z.string().max(255).optional().nullable(),
  ecriture_let: z.string().max(10).optional().nullable(),
  date_let: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/**
 * GET /api/accounting/entries/:id
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

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    let query = supabase
      .from("accounting_entries")
      .select(`
        *,
        invoice:invoices(id, periode, montant_total, statut),
        payment:payments(id, montant, statut, date_paiement)
      `)
      .eq("id", id);

    if (profile.role !== "admin") {
      query = query.eq("owner_id", profile.id);
    }

    const { data: entry, error } = await query.single();

    if (error || !entry) {
      throw new ApiError(404, "Écriture non trouvée");
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/accounting/entries/:id
 * Modifier une écriture non validée
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
      throw new ApiError(403, "Seuls les administrateurs peuvent modifier les écritures");
    }

    // Vérifier que l'écriture existe et n'est pas validée
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id, valid_date")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new ApiError(404, "Écriture non trouvée");
    }

    if (existing.valid_date) {
      throw new ApiError(400, "Impossible de modifier une écriture validée");
    }

    const body = await request.json();
    const validation = UpdateEntrySchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { data: entry, error } = await supabase
      .from("accounting_entries")
      .update(validation.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Entries API] Erreur modification:", error);
      throw new ApiError(500, "Erreur lors de la modification");
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/accounting/entries/:id
 * Supprimer une écriture non validée
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
      throw new ApiError(403, "Seuls les administrateurs peuvent supprimer les écritures");
    }

    // Vérifier que l'écriture existe et n'est pas validée
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id, valid_date, ecriture_num")
      .eq("id", id)
      .single();

    if (!existing) {
      throw new ApiError(404, "Écriture non trouvée");
    }

    if (existing.valid_date) {
      throw new ApiError(400, "Impossible de supprimer une écriture validée. Utilisez une écriture d'extourne.");
    }

    const { error } = await supabase
      .from("accounting_entries")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Entries API] Erreur suppression:", error);
      throw new ApiError(500, "Erreur lors de la suppression");
    }

    return NextResponse.json({
      success: true,
      message: `Écriture ${existing.ecriture_num} supprimée`
    });
  } catch (error) {
    return handleApiError(error);
  }
}
