/**
 * Mandant reversement → accounting entry bridge.
 *
 * Pose l'écriture comptable du reversement net au propriétaire mandant
 * sur les livres de l'AGENCE :
 *
 *   D 467 (compte courant mandant) / C 545 (Banque mandant)
 *      → tag auto:agency_reversement — Section 2 du CRG
 *
 * Met à jour `agency_mandant_accounts.balance_cents` (décrément) et
 * `last_reversement_at` pour le suivi de trésorerie Hoguet.
 *
 * Le reversement est INDÉPENDANT du paiement de loyer : il se déclenche
 * quand l'agence vire effectivement le net au propriétaire (typiquement
 * mensuel ou trimestriel après émission du CRG).
 *
 * Trois points d'appel possibles :
 *   - manuel via UI agence (POST /api/agency/mandates/[id]/reversement)
 *   - cron mensuel batch (cron-monthly-reversements, à câbler plus tard)
 *   - rapprochement bancaire (lorsqu'une transaction sortante de 545 est
 *     identifiée comme reversement vers un mandant)
 *
 * Idempotence : la référence DOIT être fournie par le caller (typiquement
 * `${mandateId}:${date}:${amountCents}` pour le manuel ou `bank_tx:${id}`
 * pour le rapprochement). Sans référence stable, deux clics rapides
 * créeraient deux écritures identiques.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import { getEntityAccountingConfig } from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export interface EnsureMandantReversementEntryResult {
  created: boolean;
  skippedReason?:
    | "already_exists"
    | "mandate_not_found"
    | "agency_accounting_disabled"
    | "exercise_not_available"
    | "actor_unresolved"
    | "amount_non_positive"
    | "insufficient_balance"
    | "error";
  entryId?: string;
  newBalanceCents?: number;
  error?: string;
}

interface MandateRow {
  id: string;
  agency_entity_id: string;
  owner_profile_id: string;
  mandate_number: string;
}

interface AccountRow {
  id: string;
  balance_cents: number | null;
}

export interface EnsureMandantReversementEntryOptions {
  /** Date du reversement (YYYY-MM-DD). Défaut : aujourd'hui. */
  date?: string;
  /** Libellé override. Défaut généré : "Reversement mandat <num>". */
  label?: string;
  /** Référence d'idempotence — OBLIGATOIRE pour éviter les doublons. */
  idempotencyKey: string;
  /**
   * Si true (par défaut), bloque le reversement quand la balance
   * mandant est insuffisante. Mettre à false pour permettre une
   * balance négative (avance agence — rare).
   */
  enforceSufficientBalance?: boolean;
  /** Acteur ayant déclenché. Défaut : système. */
  userId?: string;
}

export async function ensureMandantReversementEntry(
  supabase: SupabaseClient,
  mandateId: string,
  amountCents: number,
  options: EnsureMandantReversementEntryOptions,
): Promise<EnsureMandantReversementEntryResult> {
  try {
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_non_positive" };
    }

    // 1. Idempotence — la même référence ne crée pas deux écritures.
    const reference = `agency:reversement:${options.idempotencyKey}`;
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id")
      .eq("reference", reference)
      .eq("source", "auto:agency_reversement")
      .limit(1)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: (existing as { id: string }).id,
      };
    }

    // 2. Charge le mandat + son compte mandant.
    const { data: mandate } = await (supabase as any)
      .from("agency_mandates")
      .select("id, agency_entity_id, owner_profile_id, mandate_number")
      .eq("id", mandateId)
      .maybeSingle();

    const mandateRow = mandate as MandateRow | null;
    if (!mandateRow) {
      return { created: false, skippedReason: "mandate_not_found" };
    }

    const agencyEntityId = mandateRow.agency_entity_id;

    // 3. Gating compta côté agence.
    const config = await getEntityAccountingConfig(supabase, agencyEntityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "agency_accounting_disabled" };
    }

    // 4. Vérification balance mandant si demandée.
    const { data: account } = await (supabase as any)
      .from("agency_mandant_accounts")
      .select("id, balance_cents")
      .eq("mandate_id", mandateId)
      .maybeSingle();

    const accountRow = account as AccountRow | null;
    const currentBalanceCents = accountRow?.balance_cents ?? 0;
    const enforceBalance = options.enforceSufficientBalance ?? true;

    if (enforceBalance && currentBalanceCents < amountCents) {
      return {
        created: false,
        skippedReason: "insufficient_balance",
        error: `Balance mandant ${currentBalanceCents} < reversement ${amountCents}`,
      };
    }

    // 5. Exercice agence
    const exercise = await getOrCreateCurrentExercise(supabase, agencyEntityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // 6. Acteur
    const actorUserId =
      options.userId ??
      (await resolveSystemActorForEntity(supabase, agencyEntityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    // 7. Pose l'écriture D 467 / C 545.
    const entryDate = options.date ?? new Date().toISOString().split("T")[0];
    const label =
      options.label ?? `Reversement mandat ${mandateRow.mandate_number}`;

    const entry = await createAutoEntry(supabase, "agency_reversement", {
      entityId: agencyEntityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents,
      label,
      date: entryDate,
      reference,
      thirdPartyType: "mandant",
      thirdPartyId: mandateRow.owner_profile_id,
    });

    // 8. MAJ du solde + last_reversement_at. Non-bloquant : si l'update
    //    échoue, l'écriture est posée et reste source de vérité.
    let newBalanceCents = currentBalanceCents - amountCents;
    try {
      if (accountRow) {
        await (supabase as any)
          .from("agency_mandant_accounts")
          .update({
            balance_cents: newBalanceCents,
            last_reversement_at: new Date().toISOString(),
          })
          .eq("id", accountRow.id);
      } else {
        await (supabase as any).from("agency_mandant_accounts").insert({
          mandate_id: mandateId,
          balance_cents: newBalanceCents,
          last_reversement_at: new Date().toISOString(),
        });
      }
    } catch (balErr) {
      console.warn(
        "[mandant-reversement-entry] balance update failed (non-blocking):",
        balErr,
      );
      // Le solde n'est pas atomique avec l'écriture, mais l'écriture
      // est la source de vérité. On laisse passer.
      newBalanceCents = currentBalanceCents;
    }

    return {
      created: true,
      entryId: entry.id,
      newBalanceCents,
    };
  } catch (err) {
    console.error("[ensureMandantReversementEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
