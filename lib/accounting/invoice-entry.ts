/**
 * Invoice -> accounting entry bridge (mode IS / accrual).
 *
 * For entities in declaration_mode='is_comptable' (BIC/IS regime),
 * French GAAP requires booking the rent at invoice issuance
 * (D 411xxx / C 706000) — not only at cash receipt. The matching
 * payment then clears the receivable (D 512xxx / C 411xxx) instead
 * of crediting 706 again.
 *
 * If the invoice carries provisions (montant_charges > 0), they are
 * split off into a separate `provision_called` entry
 * (D 411xxx / C 419100) so the chart of accounts distinguishes rent
 * income from charge provisions held on behalf of the tenant. Both
 * entries are posted in the same call and are jointly gated on the
 * existence of the rent_invoiced one (idempotency anchor).
 *
 * For 'reel' (revenu foncier) and 'micro_foncier' modes, only the cash
 * receipt is recorded via receipt-entry.ts — this helper short-circuits.
 *
 * Idempotency: looks up any prior accounting_entries row keyed to the
 * invoice id with source='auto:rent_invoiced' before creating. If the
 * rent_invoiced entry already exists we skip BOTH (the call is a no-op).
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

export interface EnsureInvoiceIssuedEntryResult {
  created: boolean;
  skippedReason?:
    | "already_exists"
    | "invoice_not_found"
    | "entity_not_resolved"
    | "accounting_disabled"
    | "mode_not_accrual"
    | "exercise_not_available"
    | "amount_non_positive"
    | "actor_unresolved"
    | "error";
  /** ID de l'écriture rent_invoiced (D 411 / C 706). */
  entryId?: string;
  /**
   * ID de l'écriture provision_called (D 411 / C 419100), si la facture
   * portait des provisions (montant_charges > 0). Absent sinon.
   */
  provisionEntryId?: string;
  error?: string;
}

interface InvoiceRow {
  id: string;
  montant_total: number | null;
  montant_loyer: number | null;
  montant_charges: number | null;
  date_echeance: string | null;
  periode: string | null;
  issuer_entity_id: string | null;
  tenant_id: string | null;
  lease: {
    id: string;
    signatory_entity_id: string | null;
    tenant_id: string | null;
    property: {
      id: string;
      legal_entity_id: string | null;
      adresse_complete: string | null;
    } | null;
  } | null;
}

export async function ensureInvoiceIssuedEntry(
  supabase: SupabaseClient,
  invoiceId: string,
  options: { userId?: string } = {},
): Promise<EnsureInvoiceIssuedEntryResult> {
  try {
    // 1. Idempotency
    const { data: existing } = await supabase
      .from("accounting_entries")
      .select("id")
      .eq("reference", invoiceId)
      .eq("source", "auto:rent_invoiced")
      .limit(1)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      return {
        created: false,
        skippedReason: "already_exists",
        entryId: (existing as { id: string }).id,
      };
    }

    // 2. Fetch invoice + lease + property entity resolution chain
    const { data: invoice } = await supabase
      .from("invoices")
      .select(
        `
          id,
          montant_total,
          montant_loyer,
          montant_charges,
          date_echeance,
          periode,
          issuer_entity_id,
          tenant_id,
          lease:leases!inner(
            id,
            signatory_entity_id,
            tenant_id,
            property:properties!inner(
              id,
              legal_entity_id,
              adresse_complete
            )
          )
        `,
      )
      .eq("id", invoiceId)
      .maybeSingle();

    const row = invoice as unknown as InvoiceRow | null;
    if (!row) {
      return { created: false, skippedReason: "invoice_not_found" };
    }

    const entityId =
      row.issuer_entity_id ??
      row.lease?.signatory_entity_id ??
      row.lease?.property?.legal_entity_id ??
      null;

    if (!entityId) {
      return { created: false, skippedReason: "entity_not_resolved" };
    }

    // 3. Per-entity config gate
    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      return { created: false, skippedReason: "accounting_disabled" };
    }

    // Only post the receivable for accrual mode (BIC/IS).
    if (config.declarationMode !== "is_comptable") {
      return { created: false, skippedReason: "mode_not_accrual" };
    }

    // 4. Current exercise
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      return { created: false, skippedReason: "exercise_not_available" };
    }

    // 5. Split du montant en loyer / provisions.
    // On ne fait confiance au split que s'il est cohérent avec montant_total
    // à 1 centime près. Sinon on retombe sur l'ancien comportement (tout
    // sur rent_invoiced) pour ne pas inventer des montants.
    const totalCents = Math.round(Number(row.montant_total ?? 0) * 100);
    if (totalCents <= 0) {
      return { created: false, skippedReason: "amount_non_positive" };
    }

    const declaredRentCents = Math.round(Number(row.montant_loyer ?? 0) * 100);
    const declaredProvisionCents = Math.round(
      Number(row.montant_charges ?? 0) * 100,
    );
    const declaredSumCents = declaredRentCents + declaredProvisionCents;

    let rentCents = totalCents;
    let provisionCents = 0;
    if (
      declaredProvisionCents > 0 &&
      declaredRentCents > 0 &&
      Math.abs(declaredSumCents - totalCents) <= 1
    ) {
      rentCents = declaredRentCents;
      provisionCents = declaredProvisionCents;
    }

    const entryDate = row.date_echeance ?? new Date().toISOString().split("T")[0];
    const propertyAddress = row.lease?.property?.adresse_complete ?? "";
    const periode = row.periode ?? "";
    const baseLabel = periode ? ` ${periode}` : "";
    const addrSuffix = propertyAddress ? ` - ${propertyAddress}` : "";

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    // Axes analytiques propagés sur les 2 lignes des écritures (411 +
    // 706000 / 419100) — la substitution sous-compte auxiliaire 411T00001
    // sur la ligne 411 est faite par engine.createEntry → auxiliary-resolver.
    const tenantId = row.tenant_id ?? row.lease?.tenant_id ?? undefined;
    const propertyId = row.lease?.property?.id ?? undefined;
    const leaseId = row.lease?.id ?? undefined;

    // Écriture loyer (D 411 / C 706000)
    const rentEntry = await createAutoEntry(supabase, "rent_invoiced", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: rentCents,
      label: `Loyer facture${baseLabel}${addrSuffix}`.trim(),
      date: entryDate,
      reference: invoiceId,
      propertyId,
      leaseId,
      thirdPartyType: tenantId ? "tenant" : undefined,
      thirdPartyId: tenantId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, rentEntry.id);
    }

    // Écriture provisions (D 411 / C 419100) — uniquement si la facture
    // portait des charges provisionnées. Référence dérivée pour permettre
    // une idempotence séparée si jamais l'entrée loyer existe déjà mais
    // pas celle des provisions (cas edge d'un backfill partiel).
    let provisionEntryId: string | undefined;
    if (provisionCents > 0) {
      const provisionEntry = await createAutoEntry(
        supabase,
        "provision_called",
        {
          entityId,
          exerciseId: exercise.id,
          userId: actorUserId,
          amountCents: provisionCents,
          label: `Provisions charges${baseLabel}${addrSuffix}`.trim(),
          date: entryDate,
          reference: `${invoiceId}:provision`,
          propertyId,
          leaseId,
          thirdPartyType: tenantId ? "tenant" : undefined,
          thirdPartyId: tenantId,
        },
      );

      if (shouldMarkInformational(config)) {
        await markEntryInformational(supabase, provisionEntry.id);
      }
      provisionEntryId = provisionEntry.id;
    }

    return {
      created: true,
      entryId: rentEntry.id,
      provisionEntryId,
    };
  } catch (err) {
    console.error("[ensureInvoiceIssuedEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
