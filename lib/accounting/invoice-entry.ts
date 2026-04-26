/**
 * Invoice -> accounting entry bridge (mode IS / accrual).
 *
 * For entities in declaration_mode='is_comptable' (BIC/IS regime),
 * French GAAP requires booking the rent at invoice issuance
 * (D 411xxx / C 706000) — not only at cash receipt. The matching
 * payment then clears the receivable (D 512xxx / C 411xxx) instead
 * of crediting 706 again.
 *
 * For 'reel' (revenu foncier) and 'micro_foncier' modes, only the cash
 * receipt is recorded via receipt-entry.ts — this helper short-circuits.
 *
 * Idempotency: looks up any prior accounting_entries row keyed to the
 * invoice id with source='auto:rent_invoiced' before creating.
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
  entryId?: string;
  error?: string;
}

interface InvoiceRow {
  id: string;
  montant_total: number | null;
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

    // 5. Amount
    const amountCents = Math.round(Number(row.montant_total ?? 0) * 100);
    if (amountCents <= 0) {
      return { created: false, skippedReason: "amount_non_positive" };
    }

    const entryDate = row.date_echeance ?? new Date().toISOString().split("T")[0];
    const propertyAddress = row.lease?.property?.adresse_complete ?? "";
    const periode = row.periode ?? "";
    const label = `Loyer facture${periode ? ` ${periode}` : ""}${
      propertyAddress ? ` - ${propertyAddress}` : ""
    }`.trim();

    const actorUserId =
      options.userId ?? (await resolveSystemActorForEntity(supabase, entityId));
    if (!actorUserId) {
      return { created: false, skippedReason: "actor_unresolved" };
    }

    // Axes analytiques propagés sur les 2 lignes de l'écriture (411 +
    // 706000) — la substitution sous-compte auxiliaire 411T00001 sur la
    // ligne 411 est faite par engine.createEntry → auxiliary-resolver.
    const tenantId = row.tenant_id ?? row.lease?.tenant_id ?? undefined;
    const propertyId = row.lease?.property?.id ?? undefined;
    const leaseId = row.lease?.id ?? undefined;

    const entry = await createAutoEntry(supabase, "rent_invoiced", {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents,
      label,
      date: entryDate,
      reference: invoiceId,
      propertyId,
      leaseId,
      thirdPartyType: tenantId ? "tenant" : undefined,
      thirdPartyId: tenantId,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    return { created: true, entryId: entry.id };
  } catch (err) {
    console.error("[ensureInvoiceIssuedEntry] failed:", err);
    return {
      created: false,
      skippedReason: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
