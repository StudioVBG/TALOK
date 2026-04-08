/**
 * API Route: Accounting Entries Collection
 * GET /api/accounting/entries - Liste les écritures comptables
 * POST /api/accounting/entries - Crée une écriture comptable (flat or double-entry)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from '@/lib/accounting/feature-gates';
import { createEntry } from '@/lib/accounting/engine';

export const dynamic = "force-dynamic";

// Schema for legacy flat-entry mode (debit/credit fields)
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

// Schema for new double-entry mode (lines array)
const DoubleEntryLineSchema = z.object({
  accountNumber: z.string().min(3),
  label: z.string().optional(),
  debitCents: z.number().int().min(0),
  creditCents: z.number().int().min(0),
  pieceRef: z.string().optional(),
});

const DoubleEntrySchema = z.object({
  entity_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  journal_code: z.enum(["ACH", "VE", "BQ", "OD", "AN", "CL"]),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1).max(255),
  source: z.string().optional(),
  reference: z.string().optional(),
  lines: z.array(DoubleEntryLineSchema).min(2),
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

    // Feature gate: check subscription plan
    const featureGate = await requireAccountingAccess(profile.id, 'entries');
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const journalCode = searchParams.get("journal_code");
    const compteNum = searchParams.get("compte_num");
    const ownerId = searchParams.get("owner_id");
    const propertyId = searchParams.get("property_id");
    const invoiceId = searchParams.get("invoice_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const pieceRef = searchParams.get("piece_ref");
    const MAX_LIMIT = 500;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100") || 100, MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);

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
    const totals = (entries || []).reduce<{ debit: number; credit: number }>(
      (acc, e) => ({
        debit: acc.debit + ((e.debit as number) || 0),
        credit: acc.credit + ((e.credit as number) || 0),
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
 * Crée une nouvelle écriture comptable.
 *
 * Two modes:
 * - Double-entry mode (new): body contains `lines` array → uses engine createEntry
 * - Flat-entry mode (legacy): body contains `debit`/`credit` fields → old insert logic
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

    // Feature gate: check subscription plan
    const featureGatePost = await requireAccountingAccess(profile.id, 'entries');
    if (featureGatePost) return featureGatePost;

    const body = await request.json();

    // ---------- New double-entry mode (has `lines` array) ----------
    if (Array.isArray(body.lines)) {
      const validation = DoubleEntrySchema.safeParse(body);

      if (!validation.success) {
        throw new ApiError(400, validation.error.errors[0].message);
      }

      const data = validation.data;

      const entry = await createEntry(supabase, {
        entityId: data.entity_id,
        exerciseId: data.exercise_id,
        journalCode: data.journal_code,
        entryDate: data.entry_date,
        label: data.label,
        source: data.source,
        reference: data.reference,
        lines: data.lines,
        userId: user.id,
      });

      return NextResponse.json({ success: true, data: entry }, { status: 201 });
    }

    // ---------- Legacy flat-entry mode (debit/credit fields) ----------
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
