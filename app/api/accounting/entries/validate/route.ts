/**
 * API Route: Validate Accounting Entries
 * POST /api/accounting/entries/validate - Valide des écritures comptables
 *
 * Uses the double-entry engine validateEntry for entries that belong
 * to the new schema (have entity_id). Falls back to legacy validation otherwise.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from '@/lib/accounting/feature-gates';
import { validateEntry } from '@/lib/accounting/engine';

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

    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      throw new ApiError(403, "Non autorisé");
    }

    // Feature gate: check subscription plan
    const featureGate = await requireAccountingAccess(profile.id, 'entries');
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = ValidateSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entry_ids, validation_date } = validation.data;
    const validDate = validation_date || new Date().toISOString().split("T")[0];

    // Fetch all entries to determine which mode to use
    const { data: entries, error: fetchError } = await supabase
      .from("accounting_entries")
      .select("id, ecriture_num, entry_number, valid_date, is_validated, journal_code, debit, credit, entity_id, owner_id")
      .in("id", entry_ids);

    if (fetchError) {
      throw new ApiError(500, "Erreur lors de la vérification des écritures");
    }

    if (!entries || entries.length !== entry_ids.length) {
      throw new ApiError(400, "Certaines écritures n'existent pas");
    }

    // Ownership scoping for non-admin. Engine-posted entries have owner_id=NULL
    // and scope via entity_id → legal_entities.owner_profile_id, while legacy
    // flat entries scope via owner_id directly.
    if (profile.role !== "admin") {
      const entityIds = Array.from(
        new Set(entries.map(e => e.entity_id).filter(Boolean) as string[]),
      );
      let ownedEntityIds = new Set<string>();
      if (entityIds.length > 0) {
        const { data: owned } = await supabase
          .from("legal_entities")
          .select("id")
          .in("id", entityIds)
          .eq("owner_profile_id", profile.id);
        ownedEntityIds = new Set((owned ?? []).map(e => e.id as string));
      }
      const unauthorized = entries.filter(e => {
        if (e.entity_id) return !ownedEntityIds.has(e.entity_id as string);
        return e.owner_id !== profile.id;
      });
      if (unauthorized.length > 0) {
        throw new ApiError(403, "Accès refusé à certaines écritures");
      }
    }

    // Separate entries into double-entry (have entity_id) and legacy
    const doubleEntryIds = entries.filter(e => e.entity_id).map(e => e.id as string);
    const legacyEntries = entries.filter(e => !e.entity_id);

    // ---------- Validate double-entry entries via engine ----------
    const engineErrors: string[] = [];
    for (const entryId of doubleEntryIds) {
      try {
        await validateEntry(supabase, entryId, user.id);
      } catch (err) {
        engineErrors.push(`${entryId}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    if (engineErrors.length > 0) {
      throw new ApiError(400, `Erreurs de validation engine: ${engineErrors.join('; ')}`);
    }

    // ---------- Validate legacy flat entries ----------
    let legacyValidatedCount = 0;
    if (legacyEntries.length > 0) {
      const alreadyValidated = legacyEntries.filter(e => e.valid_date);
      if (alreadyValidated.length > 0) {
        throw new ApiError(400, `${alreadyValidated.length} écriture(s) déjà validée(s)`);
      }

      // Vérifier l'équilibre par journal
      const byJournal = legacyEntries.reduce((acc, e) => {
        const journalCode = e.journal_code as string;
        if (!acc[journalCode]) {
          acc[journalCode] = { debit: 0, credit: 0 };
        }
        acc[journalCode].debit += (e.debit as number) || 0;
        acc[journalCode].credit += (e.credit as number) || 0;
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

      const legacyIds = legacyEntries.map(e => e.id as string);

      const { error: updateError, count } = await supabase
        .from("accounting_entries")
        .update({ valid_date: validDate })
        .in("id", legacyIds)
        .is("valid_date", null);

      if (updateError) {
        console.error("[Entries API] Erreur validation:", updateError);
        throw new ApiError(500, "Erreur lors de la validation");
      }

      legacyValidatedCount = count || 0;
    }

    const totalValidated = doubleEntryIds.length + legacyValidatedCount;

    return NextResponse.json({
      success: true,
      message: `${totalValidated} écriture(s) validée(s)`,
      data: {
        validated_count: totalValidated,
        engine_validated: doubleEntryIds.length,
        legacy_validated: legacyValidatedCount,
        validation_date: validDate,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
