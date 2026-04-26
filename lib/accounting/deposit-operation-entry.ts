/**
 * Bridge `deposit_operations` → moteur double-entrée.
 *
 * Contexte : la route `app/api/accounting/deposits` trace les opérations
 * sur dépôts de garantie dans `deposit_operations` (pour l'historique
 * métier visible côté UI). Depuis le retrait du flux mono-ligne legacy
 * (cf. AccountingIntegrationService), aucune écriture comptable n'était
 * plus posée pour ces opérations. Cette fonction comble ce trou en
 * appelant le moteur double-entrée pour chaque opération.
 *
 * Mapping :
 *   encaissement → auto:deposit_received  (D 512300 / C 165000)
 *   restitution  → auto:deposit_returned  (D 165000 / C 512300)
 *   retenue      → auto:deposit_returned  (D 165000 / C 791000 + C 512300 ligne zéro)
 *
 * Idempotent via `reference = deposit_operations.id` + source LIKE 'auto:deposit_%'.
 *
 * Pourquoi pas réutiliser `ensureDepositReceivedEntry` / `ensureDepositRefundedEntry` ?
 * Parce que ces helpers lisent `deposit_movements` / `deposit_refunds` (autre
 * système métier), pas `deposit_operations`. Mêmes écritures finales, source
 * de vérité différente côté lecture.
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

export type DepositOperationSkipReason =
  | "already_exists"
  | "source_not_found"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "unknown_operation_type"
  | "actor_unresolved"
  | "error";

export interface DepositOperationEntryResult {
  created: boolean;
  skippedReason?: DepositOperationSkipReason;
  entryId?: string;
  error?: string;
}

interface DepositOperationRow {
  id: string;
  lease_id: string;
  operation_type: "encaissement" | "restitution" | "retenue";
  amount: number | null;
  operation_date: string | null;
  description: string | null;
  created_at: string;
}

interface LeaseEntityRow {
  id: string;
  property: {
    legal_entity_id: string | null;
    adresse_complete: string | null;
  } | null;
}

async function resolveEntityForLease(
  supabase: SupabaseClient,
  leaseId: string,
): Promise<{ entityId: string | null; propertyAddress: string | null }> {
  const { data } = await supabase
    .from("leases")
    .select(
      `
        id,
        property:properties!inner(
          legal_entity_id,
          adresse_complete
        )
      `,
    )
    .eq("id", leaseId)
    .maybeSingle();

  const row = data as unknown as LeaseEntityRow | null;
  return {
    entityId: row?.property?.legal_entity_id ?? null,
    propertyAddress: row?.property?.adresse_complete ?? null,
  };
}

async function findExistingEntry(
  supabase: SupabaseClient,
  reference: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("accounting_entries")
    .select("id")
    .eq("reference", reference)
    .like("source", "auto:deposit_%")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Pose l'écriture comptable double-entrée correspondant à une opération
 * `deposit_operations`. Idempotent : ne crée rien si une écriture liée
 * à cet operationId existe déjà.
 */
export async function ensureDepositOperationEntry(
  supabase: SupabaseClient,
  operationId: string,
  options: { userId?: string } = {},
): Promise<DepositOperationEntryResult> {
  try {
    const existingId = await findExistingEntry(supabase, operationId);
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    const { data: opData } = await supabase
      .from("deposit_operations")
      .select("id, lease_id, operation_type, amount, operation_date, description, created_at")
      .eq("id", operationId)
      .maybeSingle();

    const op = opData as unknown as DepositOperationRow | null;
    if (!op) {
      return { created: false, skippedReason: "source_not_found" };
    }

    if (
      op.operation_type !== "encaissement" &&
      op.operation_type !== "restitution" &&
      op.operation_type !== "retenue"
    ) {
      return { created: false, skippedReason: "unknown_operation_type" };
    }

    const { entityId, propertyAddress } = await resolveEntityForLease(
      supabase,
      op.lease_id,
    );
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    const amountCents = Math.round(Number(op.amount ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    const entryDate =
      op.operation_date ?? op.created_at.split("T")[0] ??
      new Date().toISOString().split("T")[0];

    const propertySuffix = propertyAddress ? ` - ${propertyAddress}` : "";

    let entryId: string;

    if (op.operation_type === "encaissement") {
      const label = `Dépôt de garantie reçu${propertySuffix}`;
      const entry = await createAutoEntry(supabase, "deposit_received", {
        entityId,
        exerciseId: exercise.id,
        userId: actorUserId,
        amountCents,
        label,
        date: entryDate,
        reference: operationId,
      });
      entryId = entry.id;
    } else {
      // restitution OU retenue : tous deux mappent sur deposit_returned.
      // restitution : refund = amount, retained = 0
      // retenue     : refund = 0, retained = amount → engine builder accepte
      //               (génère D 165000 / C 791000 + C 512300=0)
      const isRetenue = op.operation_type === "retenue";
      const label = isRetenue
        ? `Retenue dépôt de garantie${propertySuffix}`
        : `Restitution dépôt de garantie${propertySuffix}`;
      const refundCents = isRetenue ? 0 : amountCents;
      const retainedCents = isRetenue ? amountCents : 0;

      // Le builder engine attend amountCents > 0 ; pour la retenue intégrale
      // on swap (primary=retained, secondary=0) — même heuristique que
      // ensureDepositRefundedEntry.
      const primaryCents = refundCents > 0 ? refundCents : retainedCents;
      const secondaryCents = refundCents > 0 ? retainedCents : 0;

      const entry = await createAutoEntry(supabase, "deposit_returned", {
        entityId,
        exerciseId: exercise.id,
        userId: actorUserId,
        amountCents: primaryCents,
        secondaryAmountCents: secondaryCents,
        label,
        date: entryDate,
        reference: operationId,
      });
      entryId = entry.id;
    }

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entryId);
    }

    return { created: true, entryId };
  } catch (err) {
    console.error("[ensureDepositOperationEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
