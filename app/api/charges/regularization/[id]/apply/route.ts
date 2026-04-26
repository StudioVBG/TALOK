export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { createEntry, validateEntry } from "@/lib/accounting/engine";
import {
  planSettlementEntry,
  SettlementEntryValidationError,
} from "@/lib/charges/apply-engine";
import {
  createRegularizationStripePayment,
  StripeRegularizationError,
} from "@/lib/charges/apply-stripe";
import type { SettlementMethod } from "@/lib/charges/types";
import { handleApiError } from "@/lib/helpers/api-error";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * POST /api/charges/regularization/[id]/apply
 *
 * Settle a regularization : generate the accounting entry, persist the
 * settlement_method + installment_count + settled_at, emit an outbox
 * event. If settlement_method='stripe', also creates an invoice +
 * PaymentIntent and returns the client_secret for the frontend.
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

    // 8b. Stripe-only side-effect : create invoice + PaymentIntent.
    // Run AFTER the accounting entry is booked : if Stripe fails, the entry
    // is contre-passable mais au moins la régul n'est pas marquée settled.
    let stripeResult: {
      invoiceId: string;
      paymentIntentId: string;
      clientSecret: string | null;
    } | null = null;
    if (settlementMethod === "stripe") {
      try {
        stripeResult = await createRegularizationStripePayment({
          serviceClient: createServiceRoleClient(),
          regularizationId: reg.id,
          leaseId: reg.lease_id,
          propertyId: reg.property_id,
          fiscalYear: reg.fiscal_year,
          balanceCents: reg.balance_cents,
        });
      } catch (e) {
        if (e instanceof StripeRegularizationError) {
          // Accounting entry is booked but no Stripe payment. Return 502 +
          // accounting_entry_id for manual contre-passation or retry.
          return NextResponse.json(
            {
              error: e.message,
              accounting_entry_id: entry.id,
              hint:
                "L'écriture comptable a été créée mais Stripe a échoué. Contre-passer l'écriture ou réessayer via un autre settlement_method.",
            },
            { status: 502 },
          );
        }
        throw e;
      }
    }

    // 9. Update regularization record (incl. regularization_invoice_id si Stripe)
    const updatePayload: Record<string, unknown> = {
      status: "settled",
      settlement_method: settlementMethod,
      installment_count: installmentCount,
      settled_at: new Date().toISOString(),
      notes: payload.notes ?? null,
    };
    if (stripeResult) {
      updatePayload.regularization_invoice_id = stripeResult.invoiceId;
    }
    const { error: updateError } = await supabase
      .from("lease_charge_regularizations")
      .update(updatePayload as never)
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

    // 9b. Pose l'écriture de reclassement TEOM (D 635200 / C 708000) si un
    // avis de taxe foncière existe pour cette propriété + année et que le
    // TEOM net y est renseigné. Non bloquant : on ne bloque pas le settle
    // si l'écriture échoue. Idempotent via reference = tax_notice.id.
    try {
      const { data: taxNotice } = await supabase
        .from("tax_notices")
        .select("id, teom_net, reom_applicable")
        .eq("property_id", reg.property_id)
        .eq("year", reg.fiscal_year)
        .maybeSingle();
      const notice = taxNotice as
        | { id: string; teom_net: number | null; reom_applicable: boolean }
        | null;
      if (notice && !notice.reom_applicable && (notice.teom_net ?? 0) > 0) {
        const { ensureTeomRecoveryEntry } = await import(
          "@/lib/accounting/teom-recovery-entry"
        );
        await ensureTeomRecoveryEntry(supabase, {
          entityId,
          reference: notice.id,
          amountCents: notice.teom_net ?? 0,
          date: settleDate,
          label: `TEOM ${reg.fiscal_year} refacturée locataire`,
          userId: user.id,
        });
      }
    } catch (teomError) {
      console.error(
        "[apply] Reclassement TEOM (non bloquant):",
        teomError,
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
      ...(stripeResult && {
        stripe: {
          invoice_id: stripeResult.invoiceId,
          payment_intent_id: stripeResult.paymentIntentId,
          client_secret: stripeResult.clientSecret,
        },
      }),
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
