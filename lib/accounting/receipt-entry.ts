/**
 * Receipt → accounting entry bridge.
 *
 * When a rent payment is confirmed *outside* the Stripe webhook (manual
 * "mark as paid", off-Stripe confirm, manual receipt generation, etc.),
 * the receipt PDF gets created by `ensureReceiptDocument` but the
 * corresponding double-entry was never posted. This module provides a
 * single idempotent helper that both the non-Stripe code paths and
 * future triggers can call safely.
 *
 * Idempotency: the helper looks up any prior `accounting_entries` row
 * with `reference = payment_id AND source LIKE 'auto:rent_received%'`
 * and bails out if one already exists — so the Stripe webhook's inline
 * `createAutoEntry` call and this helper can never produce a double
 * booking for the same payment.
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

export interface EnsureReceiptAccountingEntryResult {
  created: boolean;
  /** Reason `created` is false. Always set when created=false. */
  skippedReason?:
    | "already_exists"
    | "payment_not_found"
    | "entity_not_resolved"
    | "accounting_disabled"
    | "exercise_not_available"
    | "error";
  entryId?: string;
  error?: string;
}

interface PaymentRow {
  id: string;
  montant: number | null;
  date_paiement: string | null;
  invoice: {
    id: string;
    periode: string | null;
    montant_loyer: number | null;
    montant_charges: number | null;
    tenant_id: string | null;
    lease: {
      id: string;
      tenant_id: string | null;
      property: {
        id: string;
        legal_entity_id: string | null;
        adresse_complete: string | null;
      } | null;
    } | null;
  } | null;
}

/**
 * Ensure an accounting entry exists for `rent_received` on the given
 * payment. Safe to call multiple times and from any code path.
 */
export async function ensureReceiptAccountingEntry(
  supabase: SupabaseClient,
  paymentId: string,
  options: { userId?: string } = {},
): Promise<EnsureReceiptAccountingEntryResult> {
  try {
    // ─── 1. Idempotency guard ───────────────────────────────────────
    // Look for any prior auto-entry already keyed to this payment id.
    // We match on `reference` + source prefix because the Stripe webhook
    // writes source = "auto:rent_received" and the non-Stripe path will
    // do the same through createAutoEntry.
    // Match either source — rent_received (cash basis) OR
    // rent_payment_clearing (IS accrual). Both are payment-time entries
    // keyed on the same payment.id, only one fires per payment.
    const { data: existing } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (k: string, v: string) => {
            or: (filter: string) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{ data: { id: string } | null }>;
              };
            };
          };
        };
      };
    })
      .from("accounting_entries")
      .select("id")
      .eq("reference", paymentId)
      .or("source.like.auto:rent_received%,source.like.auto:rent_payment_clearing%")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return { created: false, skippedReason: "already_exists", entryId: existing.id };
    }

    // ─── 2. Fetch the payment with the minimum join needed to resolve
    //       the owning entity and amount. ────────────────────────────
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
            montant_loyer,
            montant_charges,
            tenant_id,
            lease:leases!inner(
              id,
              tenant_id,
              property:properties!inner(
                id,
                legal_entity_id,
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

    const entityId = paymentRow.invoice?.lease?.property?.legal_entity_id ?? null;
    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    // ─── 2b. Per-entity accounting toggle ──────────────────────────
    // Skip if the owner has not activated automatic accounting for this
    // entity (avoids polluting the journal during initial setup).
    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    // ─── 3. Current exercise for that entity ───────────────────────
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // ─── 4. Post the double-entry via the canonical helper ─────────
    // The amount on `payments.montant` is stored in euros (NUMERIC) so
    // we multiply by 100 to get cents, matching the Stripe path that
    // sends cents directly.
    const amountCents = Math.round(Number(paymentRow.montant ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "error", error: "amount_non_positive" };
    }

    const entryDate =
      paymentRow.date_paiement ?? new Date().toISOString().split("T")[0];

    const propertyAddress =
      paymentRow.invoice?.lease?.property?.adresse_complete ?? "";
    const periode = paymentRow.invoice?.periode ?? "";

    // Mode de déclaration → événement comptable.
    //   - is_comptable (BIC/IS) : la créance 411 a été posée à l'émission
    //     de la facture par invoice-entry.ts (rent_invoiced). Au paiement,
    //     on solde la créance : D 512 / C 411 (rent_payment_clearing).
    //     Les provisions sont aussi soldées via 411 par cette même écriture.
    //   - reel / micro_foncier : pas d'écriture à l'émission, comptabilité
    //     cash. Au paiement, on split le montant : la portion loyer va sur
    //     706 (rent_received), la portion provisions sur 419100
    //     (provision_received) pour traçabilité de la régul annuelle.
    const isAccrual = config.declarationMode === "is_comptable";

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "error", error: "actor_unresolved" };
    }

    // Axes analytiques propagés sur toutes les écritures (P&L par bien,
    // grand livre par locataire). Optionnels — n'altèrent pas la balance.
    const propertyId = paymentRow.invoice?.lease?.property?.id ?? undefined;
    const leaseId = paymentRow.invoice?.lease?.id ?? undefined;
    const tenantId =
      paymentRow.invoice?.tenant_id ??
      paymentRow.invoice?.lease?.tenant_id ??
      undefined;

    if (isAccrual) {
      const label = `Règlement loyer${periode ? ` ${periode}` : ""}${
        propertyAddress ? ` - ${propertyAddress}` : ""
      }`.trim();
      const entry = await createAutoEntry(supabase, "rent_payment_clearing", {
        entityId,
        exerciseId: exercise.id,
        userId: actorUserId,
        amountCents,
        label,
        date: entryDate,
        reference: paymentId,
        propertyId,
        leaseId,
        thirdPartyType: tenantId ? "tenant" : undefined,
        thirdPartyId: tenantId,
      });
      if (shouldMarkInformational(config)) {
        await markEntryInformational(supabase, entry.id);
      }
      return { created: true, entryId: entry.id };
    }

    // Mode cash basis : split loyer / provisions si l'invoice détaille les
    // deux. Si pas de provisions, l'ancien comportement mono-entry est
    // conservé (rent_received pour le total).
    const provisionEuros = Number(paymentRow.invoice?.montant_charges ?? 0);
    const rentEuros = Number(paymentRow.invoice?.montant_loyer ?? 0);
    const totalDeclared = provisionEuros + rentEuros;

    let provisionCents = 0;
    let rentCents = amountCents;

    // Calcule le ratio loyer/provisions seulement si la facture est cohérente
    // avec le payment (totaux qui matchent). Sinon on tombe back sur
    // 100% loyer pour éviter d'inventer des montants.
    if (
      provisionEuros > 0 &&
      totalDeclared > 0 &&
      Math.abs(totalDeclared - Number(paymentRow.montant ?? 0)) < 0.01
    ) {
      provisionCents = Math.round(provisionEuros * 100);
      rentCents = amountCents - provisionCents;
    }

    const baseLabel = periode ? ` ${periode}` : "";
    const addrSuffix = propertyAddress ? ` - ${propertyAddress}` : "";

    // Écriture loyer (706000)
    const rentEntry = await createAutoEntry(supabase, "rent_received", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: rentCents,
      label: `Loyer${baseLabel}${addrSuffix}`.trim(),
      date: entryDate,
      reference: paymentId,
      propertyId,
      leaseId,
      thirdPartyType: tenantId ? "tenant" : undefined,
      thirdPartyId: tenantId,
    });
    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, rentEntry.id);
    }

    // Écriture provisions (419100) — seulement si > 0
    if (provisionCents > 0) {
      const provisionEntry = await createAutoEntry(
        supabase,
        "provision_received",
        {
          entityId,
          exerciseId: exercise.id,
          userId: actorUserId,
          amountCents: provisionCents,
          label: `Provisions charges${baseLabel}${addrSuffix}`.trim(),
          date: entryDate,
          // Référence dérivée pour idempotence séparée de l'écriture loyer.
          reference: `${paymentId}:provision`,
          propertyId,
          leaseId,
          thirdPartyType: tenantId ? "tenant" : undefined,
          thirdPartyId: tenantId,
        },
      );
      if (shouldMarkInformational(config)) {
        await markEntryInformational(supabase, provisionEntry.id);
      }
    }

    return { created: true, entryId: rentEntry.id };
  } catch (err) {
    console.error("[ensureReceiptAccountingEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
