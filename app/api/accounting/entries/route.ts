/**
 * API Route: Accounting Entries Collection
 * GET /api/accounting/entries - Liste les écritures comptables
 * POST /api/accounting/entries - Crée une écriture comptable
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Schema de validation pour création d'écriture
const CreateEntrySchema = z.object({
  journal_code: z.enum(["VE", "AC", "BQ", "BM", "OD", "AN"]),
  compte_num: z.string().min(4).max(10),
  compte_lib: z.string().min(1).max(255),
  piece_ref: z.string().min(1).max(50),
  ecriture_lib: z.string().min(1).max(255),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  ecriture_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compte_aux_num: z.string().max(20).optional(),
  compte_aux_lib: z.string().max(255).optional(),
  owner_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
  invoice_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
}).refine(data => data.debit > 0 || data.credit > 0, {
  message: "Une écriture doit avoir un débit ou un crédit non nul",
}).refine(data => !(data.debit > 0 && data.credit > 0), {
  message: "Une écriture ne peut pas avoir à la fois un débit et un crédit",
});

/**
 * GET /api/accounting/entries
 * Liste les écritures comptables avec filtrage
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

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    const { searchParams } = new URL(request.url);
    const journalCode = searchParams.get("journal_code");
    const compteNum = searchParams.get("compte_num");
    const ownerId = searchParams.get("owner_id");
    const propertyId = searchParams.get("property_id");
    const invoiceId = searchParams.get("invoice_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const pieceRef = searchParams.get("piece_ref");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("accounting_entries")
      .select("*", { count: "exact" });

    // Filtrage par rôle
    if (profile.role !== "admin") {
      query = query.eq("owner_id", profile.id);
    }

    // Filtres
    if (journalCode) query = query.eq("journal_code", journalCode);
    if (compteNum) query = query.ilike("compte_num", `${compteNum}%`);
    if (ownerId) query = query.eq("owner_id", ownerId);
    if (propertyId) query = query.eq("property_id", propertyId);
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    if (pieceRef) query = query.ilike("piece_ref", `%${pieceRef}%`);
    if (startDate) query = query.gte("ecriture_date", startDate);
    if (endDate) query = query.lte("ecriture_date", endDate);

    query = query
      .order("ecriture_date", { ascending: false })
      .order("ecriture_num", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: entries, error, count } = await query;

    if (error) {
      console.error("[Entries API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des écritures");
    }

    // Calculer les totaux
    const totals = (entries || []).reduce(
      (acc, e) => ({
        debit: acc.debit + (e.debit || 0),
        credit: acc.credit + (e.credit || 0),
      }),
      { debit: 0, credit: 0 }
    );

    return NextResponse.json({
      success: true,
      data: entries || [],
      meta: {
        total: count || 0,
        limit,
        offset,
        totals: {
          debit: Math.round(totals.debit * 100) / 100,
          credit: Math.round(totals.credit * 100) / 100,
          balance: Math.round((totals.debit - totals.credit) * 100) / 100,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/entries
 * Crée une nouvelle écriture comptable
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
      throw new ApiError(403, "Seuls les administrateurs peuvent créer des écritures");
    }

    const body = await request.json();
    const validation = CreateEntrySchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;
    const today = new Date().toISOString().split("T")[0];

    // Générer le numéro d'écriture
    const year = (data.ecriture_date || today).substring(0, 4);
    const { count } = await supabase
      .from("accounting_entries")
      .select("*", { count: "exact", head: true })
      .eq("journal_code", data.journal_code)
      .gte("ecriture_date", `${year}-01-01`)
      .lte("ecriture_date", `${year}-12-31`);

    const ecritureNum = `${data.journal_code}-${year}-${String((count || 0) + 1).padStart(6, "0")}`;

    // Récupérer le libellé du compte
    const { data: compte } = await supabase
      .from("accounting_accounts")
      .select("libelle")
      .eq("numero", data.compte_num)
      .single();

    const { data: entry, error } = await supabase
      .from("accounting_entries")
      .insert({
        journal_code: data.journal_code,
        ecriture_num: ecritureNum,
        ecriture_date: data.ecriture_date || today,
        compte_num: data.compte_num,
        compte_lib: compte?.libelle || data.compte_lib,
        compte_aux_num: data.compte_aux_num,
        compte_aux_lib: data.compte_aux_lib,
        piece_ref: data.piece_ref,
        piece_date: data.ecriture_date || today,
        ecriture_lib: data.ecriture_lib,
        debit: data.debit,
        credit: data.credit,
        owner_id: data.owner_id,
        property_id: data.property_id,
        invoice_id: data.invoice_id,
        payment_id: data.payment_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[Entries API] Erreur création:", error);
      throw new ApiError(500, "Erreur lors de la création de l'écriture");
    }

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
