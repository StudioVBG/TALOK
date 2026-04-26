/**
 * Bridge `lease_indexations` (révision IRL appliquée) → moteur double-entrée.
 *
 * Quand un propriétaire applique une révision IRL via
 * `POST /api/indexations/[id]/apply`, on pose une écriture mémo dans le
 * journal OD pour historiser le changement de loyer dans la comptabilité.
 *
 * Mapping engine `auto:irl_revision` :
 *   D 699000 / C 699000  (mémo, pas d'impact financier)
 *
 * L'écriture est purement informative (les deux lignes ont le même montant
 * pour que la balance soit respectée). Le contenu utile est dans le label
 * (« Révision IRL : 850 → 870 €/mois ») et la `reference` qui pointe sur
 * `lease_indexations.id` pour la traçabilité.
 *
 * Idempotent via `reference = indexation.id` + source LIKE 'auto:irl_revision'.
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

export type IrlRevisionSkipReason =
  | "already_exists"
  | "source_not_found"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "actor_unresolved"
  | "error";

export interface IrlRevisionEntryResult {
  created: boolean;
  skippedReason?: IrlRevisionSkipReason;
  entryId?: string;
  error?: string;
}

interface IndexationRow {
  id: string;
  lease_id: string;
  old_rent: number | null;
  new_rent: number | null;
  effective_date: string | null;
  applied_at: string | null;
  status: string;
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
    .like("source", "auto:irl_revision%")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

/**
 * Pose l'écriture mémo correspondant à une révision IRL appliquée.
 * Idempotent : ne crée rien si une écriture liée à cet indexationId existe.
 */
export async function ensureIrlRevisionEntry(
  supabase: SupabaseClient,
  indexationId: string,
  options: { userId?: string } = {},
): Promise<IrlRevisionEntryResult> {
  try {
    const existingId = await findExistingEntry(supabase, indexationId);
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: existingId,
      };
    }

    const { data: indexationData } = await supabase
      .from("lease_indexations")
      .select("id, lease_id, old_rent, new_rent, effective_date, applied_at, status")
      .eq("id", indexationId)
      .maybeSingle();

    const indexation = indexationData as unknown as IndexationRow | null;
    if (!indexation || indexation.status !== "applied") {
      return { created: false, skippedReason: "source_not_found" };
    }

    const { entityId, propertyAddress } = await resolveEntityForLease(
      supabase,
      indexation.lease_id,
    );
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    // Le moteur attend un montant > 0 sur les deux lignes mémo.
    // On utilise le nouveau loyer comme repère (montant équilibré D=C).
    const newRentCents = Math.round(Number(indexation.new_rent ?? 0) * 100);
    if (newRentCents <= 0) {
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
      indexation.effective_date ??
      (indexation.applied_at ? indexation.applied_at.split("T")[0] : null) ??
      new Date().toISOString().split("T")[0];

    const oldRentCents = Math.round(Number(indexation.old_rent ?? 0) * 100);
    const propertySuffix = propertyAddress ? ` (${propertyAddress})` : "";
    const label = `Révision IRL : ${formatEuros(oldRentCents)} → ${formatEuros(newRentCents)} /mois${propertySuffix}`;

    const entry = await createAutoEntry(supabase, "irl_revision", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: newRentCents,
      label,
      date: entryDate,
      reference: indexationId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureIrlRevisionEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
