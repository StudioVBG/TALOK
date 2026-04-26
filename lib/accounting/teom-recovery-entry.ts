/**
 * Bridge refacturation TEOM au locataire → moteur double-entrée.
 *
 * La taxe foncière TEOM (taxe d'enlèvement des ordures ménagères) est
 * payée par le propriétaire à la commune mais récupérable sur le
 * locataire (décret 87-713 art. R.131-3). En pratique, elle est intégrée
 * à la régularisation annuelle des charges via le compte 614100.
 *
 * Quand on souhaite isoler comptablement la TEOM (split entre charge
 * payée 635200 et produit récupéré 708000), ce bridge pose une écriture
 * `auto:teom_recovered` séparée :
 *
 *   D 635200 (Charge TEOM)        / 0
 *   0                              / C 708000 (Produit refacturation)
 *
 * Mémo OD : aucun mouvement bancaire (le cash est déjà enregistré par
 * la régularisation des charges). C'est un reclassement analytique pour
 * la déclaration 2044 où la TEOM apparaît en ligne dédiée.
 *
 * Idempotent via `reference` + source LIKE 'auto:teom_recovered%'. Le
 * caller fournit `reference` (ex. `lease_charge_regularization.id` ou
 * `tax_notice.id` selon le déclencheur).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import {
  getEntityAccountingConfig,
  markEntryInformational,
  shouldMarkInformational,
} from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export type TeomRecoverySkipReason =
  | "already_exists"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "actor_unresolved"
  | "error";

export interface TeomRecoveryEntryResult {
  created: boolean;
  skippedReason?: TeomRecoverySkipReason;
  entryId?: string;
  error?: string;
}

export interface TeomRecoveryParams {
  entityId: string;
  /** Référence métier (regularization id, tax notice id…). */
  reference: string;
  amountCents: number;
  date: string;
  label?: string;
  userId?: string;
}

async function findExistingEntry(
  supabase: SupabaseClient,
  reference: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("accounting_entries")
    .select("id")
    .eq("reference", reference)
    .like("source", "auto:teom_recovered%")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Pose l'écriture de reclassement TEOM. Idempotent via `reference`.
 */
export async function ensureTeomRecoveryEntry(
  supabase: SupabaseClient,
  params: TeomRecoveryParams,
): Promise<TeomRecoveryEntryResult> {
  try {
    if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const existingId = await findExistingEntry(supabase, params.reference);
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    const config = await getEntityAccountingConfig(supabase, params.entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    const exercise = await getOrCreateCurrentExercise(supabase, params.entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    const actorUserId =
      params.userId ??
      (await resolveSystemActorForEntity(supabase, params.entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    const entry = await createAutoEntry(supabase, "teom_recovered", {
      entityId: params.entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: params.amountCents,
      label: params.label || "Refacturation TEOM au locataire",
      date: params.date,
      reference: params.reference,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureTeomRecoveryEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
