/**
 * Bridge virement interne → moteur double-entrée.
 *
 * Un virement interne déplace de l'argent entre deux comptes bancaires
 * de la même entité (ex. compte courant SCI → compte fonds travaux). Pour
 * conserver la partie double, on passe systématiquement par le compte de
 * transfert 581000 :
 *
 *   Écriture 1 (départ) : D 581000 / C 512xxx-source
 *   Écriture 2 (arrivée) : D 512yyy-dest / C 581000
 *
 * Les deux écritures se compensent sur 581000 → solde nul à la clôture.
 *
 * Idempotent via `reference = transfer.id` + source LIKE 'auto:internal_transfer%'.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry, createEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import {
  getEntityAccountingConfig,
  markEntryInformational,
  shouldMarkInformational,
} from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export type InternalTransferSkipReason =
  | "already_exists"
  | "entity_not_resolved"
  | "accounting_disabled"
  | "exercise_not_available"
  | "amount_invalid"
  | "actor_unresolved"
  | "same_account"
  | "error";

export interface InternalTransferEntryResult {
  created: boolean;
  skippedReason?: InternalTransferSkipReason;
  /** First entry (départ via 581000). */
  outgoingEntryId?: string;
  /** Second entry (arrivée depuis 581000). */
  incomingEntryId?: string;
  error?: string;
}

export interface InternalTransferParams {
  entityId: string;
  /** Transfer reference (e.g. UUID ou string métier — utilisé pour l'idempotence). */
  reference: string;
  /** Compte source (ex. '512100'). */
  fromAccountNumber: string;
  /** Compte destination (ex. '512200'). */
  toAccountNumber: string;
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
    .like("source", "auto:internal_transfer%")
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Pose les 2 écritures équilibrées d'un virement interne entre deux
 * comptes bancaires de la même entité. Idempotent via `reference`.
 */
export async function ensureInternalTransferEntry(
  supabase: SupabaseClient,
  params: InternalTransferParams,
): Promise<InternalTransferEntryResult> {
  try {
    if (!params.fromAccountNumber || !params.toAccountNumber) {
      return { created: false, skippedReason: "amount_invalid" };
    }
    if (params.fromAccountNumber === params.toAccountNumber) {
      return { created: false, skippedReason: "same_account" };
    }
    if (!Number.isFinite(params.amountCents) || params.amountCents <= 0) {
      return { created: false, skippedReason: "amount_invalid" };
    }

    const existingId = await findExistingEntry(supabase, params.reference);
    if (existingId) {
      return {
        created: false,
        skippedReason: "already_exists",
        outgoingEntryId: existingId,
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

    const labelBase = params.label || "Virement interne";

    // Étape 1 : départ — D 581000 / C compte source.
    // On utilise createAutoEntry pour la 1re branche (le builder
    // 'internal_transfer' produit exactement ces lignes), puis createEntry
    // direct pour la 2e car le builder n'expose pas l'asymétrie.
    const outgoing = await createAutoEntry(supabase, "internal_transfer", {
      entityId: params.entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: params.amountCents,
      bankAccount: params.fromAccountNumber,
      label: `${labelBase} (départ ${params.fromAccountNumber})`,
      date: params.date,
      reference: params.reference,
    });

    // Étape 2 : arrivée — D compte destination / C 581000.
    const incoming = await createEntry(supabase, {
      entityId: params.entityId,
      exerciseId: exercise.id,
      journalCode: "OD",
      entryDate: params.date,
      label: `${labelBase} (arrivée ${params.toAccountNumber})`,
      source: "auto:internal_transfer",
      reference: params.reference,
      userId: actorUserId,
      lines: [
        {
          accountNumber: params.toAccountNumber,
          debitCents: params.amountCents,
          creditCents: 0,
        },
        {
          accountNumber: "581000",
          debitCents: 0,
          creditCents: params.amountCents,
        },
      ],
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, outgoing.id);
      await markEntryInformational(supabase, incoming.id);
    }

    return {
      created: true,
      outgoingEntryId: outgoing.id,
      incomingEntryId: incoming.id,
    };
  } catch (err) {
    console.error("[ensureInternalTransferEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
