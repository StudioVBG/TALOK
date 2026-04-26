/**
 * API Route: Accounting Entries Collection
 * GET /api/accounting/entries - Liste les écritures comptables
 * POST /api/accounting/entries - Crée une écriture comptable (flat or double-entry)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
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
 *
 * Auth via user-scoped client, DB reads via service client to avoid RLS
 * recursion (42P17) on profiles that otherwise produces 500s.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
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
    // New double-entry schema filters on `entity_id` (legal_entities.id). The
    // legacy `owner_id` (profiles.id) is kept as a fallback for flat entries
    // that predate the engine rewrite.
    const entityId = searchParams.get("entity_id");
    const propertyId = searchParams.get("property_id");
    const invoiceId = searchParams.get("invoice_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    // Full-text search: match on label OR piece_ref. We still accept the
    // legacy `piece_ref` parameter name for backward compatibility.
    const search = searchParams.get("search") ?? searchParams.get("piece_ref");
    // Status filter: 'draft' | 'validated' | 'all' (default). Maps to the
    // new double-entry boolean `is_validated`.
    const statusParam = searchParams.get("status");
    // Source filter (new column): 'manual' | 'stripe' | 'ocr' | 'bank' | ...
    const sourceParam = searchParams.get("source");
    const MAX_LIMIT = 500;
    const limit = Math.min(parseInt(searchParams.get("limit") || "100") || 100, MAX_LIMIT);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0") || 0, 0);

    let query = serviceClient
      .from("accounting_entries")
      .select("*", { count: "exact" });

    // Filtrage par rôle — obligatoire car on utilise le service client qui
    // bypass RLS. L'enforcement d'accès passe donc par ce filtre explicite.
    //
    // Two paths:
    //   - New double-entry path: caller passes `entity_id`. We validate the
    //     user owns that legal entity (or is admin) and filter on entity_id.
    //     Engine-created entries have owner_id = NULL, so filtering on
    //     owner_id here would hide every auto-posted entry.
    //   - Legacy flat path: no entity_id → keep the historical owner_id
    //     filter so old entries created via the flat insert still scope.
    if (entityId) {
      if (profile.role !== "admin") {
        const { data: entity } = await serviceClient
          .from("legal_entities")
          .select("id")
          .eq("id", entityId)
          .eq("owner_profile_id", profile.id)
          .maybeSingle();
        if (!entity) {
          throw new ApiError(403, "Accès refusé à cette entité");
        }
      }
      query = query.eq("entity_id", entityId);
    } else if (profile.role !== "admin") {
      query = query.eq("owner_id", profile.id);
    }

    // Filtres
    if (journalCode) query = query.eq("journal_code", journalCode);
    if (compteNum) query = query.ilike("compte_num", `${compteNum}%`);
    if (ownerId && !entityId) query = query.eq("owner_id", ownerId);
    if (propertyId) query = query.eq("property_id", propertyId);
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    if (search) {
      // Match both the new `label` column and the legacy `piece_ref` so the
      // user's query finds rows no matter which schema version produced them.
      const escaped = search.replace(/[%,]/g, (m) => `\\${m}`);
      query = query.or(`label.ilike.%${escaped}%,piece_ref.ilike.%${escaped}%`);
    }
    if (startDate) query = query.gte("entry_date", startDate);
    if (endDate) query = query.lte("entry_date", endDate);
    if (statusParam === "draft") query = query.eq("is_validated", false);
    else if (statusParam === "validated") query = query.eq("is_validated", true);
    if (sourceParam) query = query.eq("source", sourceParam);

    query = query
      .order("entry_date", { ascending: false })
      .order("entry_number", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: entries, error, count } = await query;

    if (error) {
      console.error("[Entries API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des écritures");
    }

    // Engine-driven entries store debit/credit=0 at the header and the real
    // amounts in accounting_entry_lines, while legacy rows keep amounts inline.
    // Batch-fetch lines for the page and aggregate so each row carries a
    // total_debit_cents / total_credit_cents the client can read uniformly
    // (see EntryRow.getEntryDebitCents).
    const entryRows = (entries ?? []) as Array<{
      id: string;
      debit?: number | null;
      credit?: number | null;
      total_debit_cents?: number;
      total_credit_cents?: number;
    }>;
    const entryIds = entryRows.map((e) => e.id);
    const lineSums = new Map<string, { debit: number; credit: number }>();
    if (entryIds.length > 0) {
      const { data: lines, error: linesError } = await serviceClient
        .from("accounting_entry_lines")
        .select("entry_id, debit_cents, credit_cents")
        .in("entry_id", entryIds);
      if (linesError) {
        console.error("[Entries API] Erreur lignes:", linesError);
      } else {
        for (const line of (lines ?? []) as Array<{
          entry_id: string;
          debit_cents: number | null;
          credit_cents: number | null;
        }>) {
          const sums = lineSums.get(line.entry_id) ?? { debit: 0, credit: 0 };
          sums.debit += line.debit_cents ?? 0;
          sums.credit += line.credit_cents ?? 0;
          lineSums.set(line.entry_id, sums);
        }
      }
    }

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    for (const row of entryRows) {
      const sums = lineSums.get(row.id);
      const debitCents = sums
        ? sums.debit
        : Math.round(((row.debit as number) ?? 0) * 100);
      const creditCents = sums
        ? sums.credit
        : Math.round(((row.credit as number) ?? 0) * 100);
      row.total_debit_cents = debitCents;
      row.total_credit_cents = creditCents;
      totalDebitCents += debitCents;
      totalCreditCents += creditCents;
    }

    return NextResponse.json({
      success: true,
      data: entryRows,
      meta: {
        total: count || 0,
        limit,
        offset,
        totals: {
          debit: totalDebitCents / 100,
          credit: totalCreditCents / 100,
          balance: (totalDebitCents - totalCreditCents) / 100,
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

    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      throw new ApiError(403, "Non autorisé");
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

      if (profile.role !== "admin") {
        const { data: entity } = await supabase
          .from("legal_entities")
          .select("id")
          .eq("id", data.entity_id)
          .eq("owner_profile_id", profile.id)
          .maybeSingle();
        if (!entity) {
          throw new ApiError(403, "Accès refusé à cette entité");
        }
      }

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

    // For non-admins, force owner_id = self so they cannot post to someone else.
    const ownerId = profile.role === "admin" ? data.owner_id : profile.id;

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
        owner_id: ownerId,
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
