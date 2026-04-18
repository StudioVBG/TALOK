export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { createEntry, validateEntry } from "@/lib/accounting/engine";
import {
  planSettlementEntry,
  SettlementEntryValidationError,
} from "@/lib/charges/apply-engine";
import type { SettlementMethod } from "@/lib/charges/types";
import { handleApiError } from "@/lib/helpers/api-error";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/charges/regularization/[id]/apply
 *
 * Settle a regularization : generate the accounting entry, persist the
 * settlement_method + installment_count + settled_at, emit an outbox
 * event. Stripe scenario (creating the invoice + PaymentIntent) is
 * handled in a follow-up commit — currently returns 501 for method='stripe'.
 *
 * Payload :
 *   {
 *     settlement_method: 'stripe' | 'next_rent' | 'installments_12' | 'deduction' | 'waived',
 *     installment_count?: number,   // required if 'installments_12' (2..12)
 *     notes?: string
 *   }
 */

interface ApplyPayload {
  settlement_method?: string;
  installment_count?: number;
  notes?: string;
}

const ALLOWED_METHODS: readonly SettlementMethod[] = [
  "stripe",
  "next_rent",
  "installments_12",
  "deduction",
  "waived",
] as const;

function isSettlementMethod(v: unknown): v is SettlementMethod {
  return typeof v === "string" &&
    (ALLOWED_METHODS as readonly string[]).includes(v);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Auth + profile owner
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile as { role?: string }).role !== "owner") {
      return NextResponse.json(
        { error: "Réservé aux propriétaires" },
        { status: 403 },
      );
    }
    const ownerProfileId = (profile as { id: string }).id;

    // 2. Parse payload
    let payload: ApplyPayload;
    try {
      payload = (await _request.json()) as ApplyPayload;
    } catch {
      return NextResponse.json(
        { error: "Payload JSON invalide" },
        { status: 400 },
      );
    }

    if (!isSettlementMethod(payload.settlement_method)) {
      return NextResponse.json(
        {
          error:
            `settlement_method doit être ${ALLOWED_METHODS.join(" | ")}`,
        },
        { status: 400 },
      );
    }
    const settlementMethod = payload.settlement_method;
    const installmentCount =
      settlementMethod === "installments_12"
        ? (payload.installment_count ?? 12)
        : 1;

    // Stripe scenario requires invoice + PaymentIntent — deferred to next commit.
    if (settlementMethod === "stripe") {
      return NextResponse.json(
        { error: "settlement_method='stripe' pas encore implémenté (Sprint 0.d commit 3)" },
        { status: 501 },
      );
    }

    // 3. Fetch regularization
    const { data: regRow, error: regFetchError } = await supabase
      .from("lease_charge_regularizations")
      .select(
        "id, lease_id, property_id, fiscal_year, total_provisions_cents, total_actual_cents, balance_cents, status, settled_at",
      )
      .eq("id", id)
      .single();

    if (regFetchError || !regRow) {
      return NextResponse.json(
        { error: "Régularisation introuvable" },
        { status: 404 },
      );
    }

    type RegRow = {
      id: string;
      lease_id: string;
      property_id: string;
      fiscal_year: number;
      total_provisions_cents: number;
      total_actual_cents: number;
      balance_cents: number;
      status: string;
      settled_at: string | null;
    };
    const reg = regRow as unknown as RegRow;

    // 4. Transition validation : only sent/acknowledged/contested → settled
    const ALLOWED_FROM = ["sent", "acknowledged", "contested"] as const;
    if (!(ALLOWED_FROM as readonly string[]).includes(reg.status)) {
      return NextResponse.json(
        {
          error: `Transition vers 'settled' interdite depuis status='${reg.status}' (autorisé depuis ${ALLOWED_FROM.join("/")})`,
        },
        { status: 409 },
      );
    }
    if (reg.settled_at) {
      return NextResponse.json(
        { error: "Régularisation déjà settled" },
        { status: 409 },
      );
    }

    // 5. Plan entry (pure)
    let plan;
    try {
      plan = planSettlementEntry({
        regularizationId: reg.id,
        settlementMethod,
        installmentCount,
        totalProvisionsCents: reg.total_provisions_cents,
        totalActualCents: reg.total_actual_cents,
        balanceCents: reg.balance_cents,
        fiscalYear: reg.fiscal_year,
        leaseLabel: `bail ${reg.lease_id.slice(0, 8)}`,
      });
    } catch (e) {
      if (e instanceof SettlementEntryValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // 6. Resolve entity_id via property
    const { data: propertyRow, error: propertyError } = await supabase
      .from("properties")
      .select("legal_entity_id")
      .eq("id", reg.property_id)
      .single();

    if (propertyError || !propertyRow) {
      return NextResponse.json(
        { error: "Bien introuvable" },
        { status: 404 },
      );
    }
    const entityId = (propertyRow as { legal_entity_id: string | null })
      .legal_entity_id;
    if (!entityId) {
      return NextResponse.json(
        {
          error:
            "Le bien n'est pas rattaché à une entité juridique — ajoutez-lui une legal_entity avant settle",
        },
        { status: 400 },
      );
    }

    // 7. Resolve open exercise covering today
    const settleDate = new Date().toISOString().slice(0, 10);
    const { data: exerciseRow, error: exerciseError } = await supabase
      .from("accounting_exercises")
      .select("id")
      .eq("entity_id", entityId)
      .eq("status", "open")
      .lte("start_date", settleDate)
      .gte("end_date", settleDate)
      .limit(1)
      .maybeSingle();

    if (exerciseError) throw exerciseError;
    if (!exerciseRow) {
      return NextResponse.json(
        {
          error: `Aucun exercice comptable ouvert ne couvre la date ${settleDate} pour cette entité`,
        },
        { status: 422 },
      );
    }
    const exerciseId = (exerciseRow as { id: string }).id;

    // 8. Create entry + validate (sum D = sum C enforced by trg_entry_balance)
    const entry = await createEntry(supabase, {
      entityId,
      exerciseId,
      journalCode: "OD",
      entryDate: settleDate,
      label: plan.label,
      source: plan.source,
      reference: plan.reference,
      userId: user.id,
      lines: plan.lines,
    });

    await validateEntry(supabase, entry.id, user.id);

    // 9. Update regularization record
    const { error: updateError } = await supabase
      .from("lease_charge_regularizations")
      .update({
        status: "settled",
        settlement_method: settlementMethod,
        installment_count: installmentCount,
        settled_at: new Date().toISOString(),
        notes: payload.notes ?? null,
      } as never)
      .eq("id", id);

    if (updateError) {
      // Entry already created — surface the inconsistency explicitly.
      return NextResponse.json(
        {
          error:
            "Écriture comptable créée mais l'update de la régul a échoué — état incohérent, contre-passer l'écriture manuellement",
          accounting_entry_id: entry.id,
          detail: updateError.message,
        },
        { status: 500 },
      );
    }

    // 10. Emit outbox (non-blocking)
    try {
      await supabase.from("outbox").insert({
        event_type: "ChargeRegularization.Settled",
        payload: {
          regularization_id: id,
          lease_id: reg.lease_id,
          fiscal_year: reg.fiscal_year,
          settlement_method: settlementMethod,
          installment_count: installmentCount,
          balance_cents: reg.balance_cents,
          accounting_entry_id: entry.id,
          settled_by: ownerProfileId,
        },
      } as never);
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      regularization_id: id,
      accounting_entry_id: entry.id,
      entry_number: entry.entryNumber,
      settlement_method: settlementMethod,
      installment_count: installmentCount,
      requires_installment_schedule: plan.requiresInstallmentSchedule,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
