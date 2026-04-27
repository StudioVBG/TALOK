/**
 * Mandant payment → accounting entry bridge.
 *
 * Quand un loyer est encaissé pour une property sous mandat agence
 * (Loi Hoguet), pose les écritures comptables côté AGENCE :
 *
 *   D 545 (Banque mandant) / C 467 (compte courant mandant)
 *      → tag auto:agency_loyer_mandant — Section 1 du CRG
 *
 *   D 467 (compte courant mandant) / C 706100 (Honoraires de gestion)
 *      → tag auto:agency_commission — Section 3 du CRG
 *      Montant = amountCents × management_fee_rate / 100, ou
 *                management_fee_fixed_cents si type=fixed.
 *
 * NOTE — la 3e écriture du flux mandant (`agency_reversement`,
 * D 467 / C 545) est posée séparément quand l'agence reverse le net
 * au propriétaire, pas à chaque paiement de loyer. Le solde
 * `agency_mandant_accounts.balance_cents` représente cette dette en
 * attente de reversement.
 *
 * Idempotence : 2 écritures distinctes, références dérivées
 *   `agency:loyer:<paymentId>`         pour agency_loyer_mandant
 *   `agency:commission:<paymentId>`    pour agency_commission
 *
 * Si la property n'est pas sous mandat actif, le helper short-circuite
 * proprement (skippedReason='no_mandate') — appelable inconditionnellement
 * depuis tout point d'encaissement (webhook Stripe, mark-as-paid manuel).
 *
 * Le helper N'EMPÊCHE PAS le helper receipt-entry de poser
 * `rent_received` côté owner — les deux entrées sont sur des entités
 * comptables distinctes (agency vs owner), donc il n'y a pas de
 * conflit balance. Le réalignement comptable du flux owner sous
 * mandat (ne reconnaître le revenu qu'au reversement effectif) est
 * un sujet produit séparé non couvert ici.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import { getEntityAccountingConfig } from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export interface EnsureMandantPaymentEntriesResult {
  created: boolean;
  /** Reason `created` is false. */
  skippedReason?:
    | "already_exists"
    | "payment_not_found"
    | "no_active_mandate"
    | "agency_entity_not_resolved"
    | "agency_accounting_disabled"
    | "exercise_not_available"
    | "actor_unresolved"
    | "amount_non_positive"
    | "error";
  loyerEntryId?: string;
  commissionEntryId?: string;
  error?: string;
}

interface PaymentRow {
  id: string;
  montant: number | null;
  date_paiement: string | null;
  invoice: {
    id: string;
    periode: string | null;
    tenant_id: string | null;
    lease: {
      id: string;
      tenant_id: string | null;
      property: {
        id: string;
        adresse_complete: string | null;
      } | null;
    } | null;
  } | null;
}

interface MandateRow {
  id: string;
  agency_entity_id: string;
  owner_profile_id: string;
  mandate_number: string;
  management_fee_type: "percentage" | "fixed";
  management_fee_rate: number | null;
  management_fee_fixed_cents: number | null;
  property_ids: string[] | null;
}

/**
 * Calcule la commission en cents selon le type de mandat.
 * - percentage : amountCents × rate / 100, arrondi au cent
 * - fixed      : management_fee_fixed_cents (plafonné au montant si supérieur)
 *
 * Renvoie 0 si le mandat n'a pas de tarification configurée — l'écriture
 * commission est alors skippée silencieusement.
 */
function computeCommissionCents(
  mandate: MandateRow,
  amountCents: number,
): number {
  if (mandate.management_fee_type === "fixed") {
    const fixed = mandate.management_fee_fixed_cents ?? 0;
    return Math.min(Math.max(0, fixed), amountCents);
  }
  const rate = Number(mandate.management_fee_rate ?? 0);
  if (rate <= 0) return 0;
  return Math.min(Math.round((amountCents * rate) / 100), amountCents);
}

/**
 * Pose les écritures comptables mandant pour un paiement.
 * Idempotent + safe à appeler depuis tout point d'encaissement.
 */
export async function ensureMandantPaymentEntries(
  supabase: SupabaseClient,
  paymentId: string,
  options: { userId?: string; amountCentsOverride?: number } = {},
): Promise<EnsureMandantPaymentEntriesResult> {
  try {
    // 1. Idempotence — skip si le tag loyer existe déjà.
    const loyerRef = `agency:loyer:${paymentId}`;
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id")
      .eq("reference", loyerRef)
      .eq("source", "auto:agency_loyer_mandant")
      .limit(1)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      return {
        created: false,
        skippedReason: "already_exists",
        loyerEntryId: (existing as { id: string }).id,
      };
    }

    // 2. Charge le paiement avec property pour résoudre le mandat.
    const { data: payment } = await supabase
      .from("payments")
      .select(
        `
          id,
          montant,
          date_paiement,
          invoice:invoices!inner(
            id,
            periode,
            tenant_id,
            lease:leases!inner(
              id,
              tenant_id,
              property:properties!inner(
                id,
                adresse_complete
              )
            )
          )
        `,
      )
      .eq("id", paymentId)
      .maybeSingle();

    const paymentRow = payment as unknown as PaymentRow | null;
    if (!paymentRow) {
      return { created: false, skippedReason: "payment_not_found" };
    }

    const propertyId = paymentRow.invoice?.lease?.property?.id ?? null;
    if (!propertyId) {
      return { created: false, skippedReason: "no_active_mandate" };
    }

    // 3. Cherche un mandat actif qui couvre cette property. Le filtre
    //    `property_ids cs '{<id>}'` évalue côté SQL "contains" sur l'array.
    const { data: mandates } = await (supabase as any)
      .from("agency_mandates")
      .select(
        "id, agency_entity_id, owner_profile_id, mandate_number, management_fee_type, management_fee_rate, management_fee_fixed_cents, property_ids",
      )
      .eq("status", "active")
      .contains("property_ids", [propertyId])
      .limit(1);

    const mandate = (mandates?.[0] as MandateRow | undefined) ?? null;
    if (!mandate) {
      return { created: false, skippedReason: "no_active_mandate" };
    }

    const agencyEntityId = mandate.agency_entity_id;
    if (!agencyEntityId) {
      return { created: false, skippedReason: "agency_entity_not_resolved" };
    }

    // 4. Gating compta côté agence (pas côté owner). Si l'agence n'a
    //    pas activé sa comptabilité, on skip — pas d'écritures dans le
    //    vide.
    const config = await getEntityAccountingConfig(supabase, agencyEntityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "agency_accounting_disabled" };
    }

    // 5. Exercice agence
    const exercise = await getOrCreateCurrentExercise(supabase, agencyEntityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // 6. Montant : webhook Stripe peut passer une override en cents directs
    //    (cas où payments.montant n'a pas encore été MAJ). Sinon montant
    //    en euros (NUMERIC), ×100.
    const amountCents =
      options.amountCentsOverride ??
      Math.round(Number(paymentRow.montant ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_non_positive" };
    }

    const entryDate =
      paymentRow.date_paiement ?? new Date().toISOString().split("T")[0];
    const propertyAddress =
      paymentRow.invoice?.lease?.property?.adresse_complete ?? "";
    const periode = paymentRow.invoice?.periode ?? "";
    const baseLabel = periode ? ` ${periode}` : "";
    const addrSuffix = propertyAddress ? ` - ${propertyAddress}` : "";

    const actorUserId =
      options.userId ??
      (await resolveSystemActorForEntity(supabase, agencyEntityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    // 7. Le tiers (mandant) est l'owner du mandat. L'auxiliary-resolver
    //    substitue 467000 par 467MXXXXX dans createEntry quand
    //    thirdPartyType='mandant' est passé.
    const tenantIdForLabel =
      paymentRow.invoice?.tenant_id ??
      paymentRow.invoice?.lease?.tenant_id ??
      undefined;
    const leaseId = paymentRow.invoice?.lease?.id ?? undefined;

    // 7a. Écriture loyer mandant (D 545 / C 467mandant) — Section 1 CRG
    const loyerLabel =
      `Loyer mandat ${mandate.mandate_number}${baseLabel}${addrSuffix}`.trim();

    const loyerEntry = await createAutoEntry(
      supabase,
      "agency_loyer_mandant",
      {
        entityId: agencyEntityId,
        exerciseId: exercise.id,
        userId: actorUserId,
        amountCents,
        label: loyerLabel,
        date: entryDate,
        reference: loyerRef,
        propertyId,
        leaseId,
        thirdPartyType: "mandant",
        thirdPartyId: mandate.owner_profile_id,
      },
    );

    // 7b. Écriture commission (D 467mandant / C 706100) — Section 3 CRG.
    //     Skippée si la grille de tarification ne donne rien (rate=0 et
    //     fixed=0) — le mandat n'a alors pas de commission.
    const commissionCents = computeCommissionCents(mandate, amountCents);
    let commissionEntryId: string | undefined;

    if (commissionCents > 0) {
      const commissionRef = `agency:commission:${paymentId}`;
      // Idempotence séparée pour la commission, au cas où on aurait
      // créé loyer_mandant sans commission lors d'un run précédent.
      const { data: existingCom } = await supabase
        .from("accounting_entries")
        .select("id")
        .eq("reference", commissionRef)
        .eq("source", "auto:agency_commission")
        .limit(1)
        .maybeSingle();

      if (existingCom && (existingCom as { id: string }).id) {
        commissionEntryId = (existingCom as { id: string }).id;
      } else {
        const commissionLabel =
          `Commission ${mandate.mandate_number}${baseLabel}` +
          (mandate.management_fee_type === "percentage"
            ? ` (${mandate.management_fee_rate ?? 0}%)`
            : "");
        const commissionEntry = await createAutoEntry(
          supabase,
          "agency_commission",
          {
            entityId: agencyEntityId,
            exerciseId: exercise.id,
            userId: actorUserId,
            amountCents: commissionCents,
            label: commissionLabel,
            date: entryDate,
            reference: commissionRef,
            propertyId,
            leaseId,
            thirdPartyType: "mandant",
            thirdPartyId: mandate.owner_profile_id,
          },
        );
        commissionEntryId = commissionEntry.id;
      }
    }

    // 8. Mise à jour du solde du compte mandant (suivi Hoguet du net dû
    //    à l'owner). Non-bloquant : si l'update échoue les écritures
    //    sont déjà posées et restent la source de vérité.
    try {
      const netCents = amountCents - commissionCents;
      // upsert via une lecture-modif-écriture explicite plutôt qu'un
      // RPC pour rester self-contained ici.
      const { data: account } = await (supabase as any)
        .from("agency_mandant_accounts")
        .select("id, balance_cents")
        .eq("mandate_id", mandate.id)
        .maybeSingle();
      if (account) {
        await (supabase as any)
          .from("agency_mandant_accounts")
          .update({
            balance_cents: (account.balance_cents ?? 0) + netCents,
          })
          .eq("id", account.id);
      } else {
        await (supabase as any).from("agency_mandant_accounts").insert({
          mandate_id: mandate.id,
          balance_cents: netCents,
        });
      }
    } catch (balErr) {
      console.warn(
        "[mandant-payment-entry] balance update failed (non-blocking):",
        balErr,
      );
    }

    void tenantIdForLabel; // référencé pour suppression future warning

    return {
      created: true,
      loyerEntryId: loyerEntry.id,
      commissionEntryId,
    };
  } catch (err) {
    console.error("[ensureMandantPaymentEntries] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
