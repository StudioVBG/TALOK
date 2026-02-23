/**
 * SOTA 2026 : SEPA Auto-Collect Edge Function
 *
 * CRON : Exécutée quotidiennement pour :
 * 1. Collecter les prélèvements SEPA à échéance
 * 2. Smart Retry des prélèvements échoués (J+3, J+7, J+14)
 * 3. Mettre à jour les statuts et notifier
 *
 * Schedule: 0 6 * * * (tous les jours à 6h UTC)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" as any });

const RETRY_DELAYS_DAYS = [3, 7, 14];
const MAX_RETRIES = 3;

interface PaymentSchedule {
  id: string;
  lease_id: string;
  mandate_id: string | null;
  payment_method_id: string | null;
  payment_method_type: string;
  collection_day: number;
  rent_amount: number;
  charges_amount: number;
  retry_count: number;
  max_retries: number;
  last_failure_reason: string | null;
  next_retry_at: string | null;
}

interface SepaMandate {
  id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  lease_id: string;
  tenant_profile_id: string;
  owner_profile_id: string;
  amount: number;
  status: string;
}

Deno.serve(async (req: Request) => {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentDateStr = today.toISOString().split("T")[0];

    console.log(`[SEPA Auto-Collect] Running for ${currentDateStr}, day ${dayOfMonth}`);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalRetried = 0;

    // ─── Phase 1: New collections for today ───
    const { data: schedules, error: schedError } = await supabase
      .from("payment_schedules")
      .select("*")
      .eq("is_active", true)
      .eq("collection_day", dayOfMonth)
      .eq("payment_method_type", "sepa")
      .is("next_retry_at", null);

    if (schedError) {
      console.error("[SEPA] Error fetching schedules:", schedError);
      throw schedError;
    }

    console.log(`[SEPA] Found ${schedules?.length ?? 0} scheduled collections for day ${dayOfMonth}`);

    for (const schedule of schedules ?? []) {
      const result = await processCollection(schedule, currentDateStr, false);
      totalProcessed++;
      if (result.success) totalSuccess++;
      else totalFailed++;
    }

    // ─── Phase 2: Smart Retry of failed collections ───
    const { data: retrySchedules } = await supabase
      .from("payment_schedules")
      .select("*")
      .eq("is_active", true)
      .lte("next_retry_at", new Date().toISOString())
      .gt("retry_count", 0)
      .lt("retry_count", MAX_RETRIES);

    console.log(`[SEPA] Found ${retrySchedules?.length ?? 0} retries pending`);

    for (const schedule of retrySchedules ?? []) {
      const result = await processCollection(schedule, currentDateStr, true);
      totalRetried++;
      if (result.success) totalSuccess++;
      else totalFailed++;
    }

    // ─── Phase 3: Update mandate next_collection_date ───
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const updatedMandates = await supabase
      .from("sepa_mandates")
      .update({ next_collection_date: nextMonth.toISOString().split("T")[0] })
      .eq("status", "active")
      .lte("next_collection_date", currentDateStr);

    const summary = {
      date: currentDateStr,
      totalProcessed,
      totalSuccess,
      totalFailed,
      totalRetried,
    };

    console.log("[SEPA Auto-Collect] Complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SEPA Auto-Collect] Fatal error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function processCollection(
  schedule: PaymentSchedule,
  dateStr: string,
  isRetry: boolean
): Promise<{ success: boolean; error?: string }> {
  const amount = schedule.rent_amount + schedule.charges_amount;
  const amountCents = Math.round(amount * 100);

  console.log(`[SEPA] Processing ${isRetry ? "RETRY" : "NEW"} collection: lease=${schedule.lease_id}, amount=${amount}€`);

  try {
    // Get the mandate
    if (!schedule.mandate_id) {
      throw new Error("No mandate linked to schedule");
    }

    const { data: mandate } = await supabase
      .from("sepa_mandates")
      .select("*")
      .eq("id", schedule.mandate_id)
      .eq("status", "active")
      .single();

    if (!mandate) {
      throw new Error("Mandate not found or not active");
    }

    const typedMandate = mandate as SepaMandate;

    // Check if invoice exists for this period
    const periode = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    let { data: invoice } = await supabase
      .from("invoices")
      .select("id, statut")
      .eq("lease_id", schedule.lease_id)
      .eq("periode", periode)
      .maybeSingle();

    // Skip if already paid
    if (invoice?.statut === "paid") {
      console.log(`[SEPA] Invoice for ${periode} already paid, skipping`);
      return { success: true };
    }

    // Create invoice if none exists
    if (!invoice) {
      const { data: lease } = await supabase
        .from("leases")
        .select("property_id, properties(owner_id)")
        .eq("id", schedule.lease_id)
        .single();

      if (!lease) throw new Error("Lease not found");

      const { data: newInvoice, error: invError } = await supabase
        .from("invoices")
        .insert({
          lease_id: schedule.lease_id,
          owner_id: (lease.properties as any)?.owner_id,
          tenant_id: typedMandate.tenant_profile_id,
          periode,
          montant_total: amount,
          montant_loyer: schedule.rent_amount,
          montant_charges: schedule.charges_amount,
          statut: "sent",
          type: "loyer",
        })
        .select("id, statut")
        .single();

      if (invError) throw new Error(`Invoice creation failed: ${invError.message}`);
      invoice = newInvoice;
    }

    // Create Stripe PaymentIntent with SEPA off_session
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      customer: typedMandate.stripe_customer_id,
      payment_method: typedMandate.stripe_payment_method_id,
      payment_method_types: ["sepa_debit"],
      confirm: true,
      off_session: true,
      description: `Loyer ${periode} - Prélèvement SEPA automatique`,
      metadata: {
        invoice_id: invoice!.id,
        lease_id: schedule.lease_id,
        mandate_id: typedMandate.id,
        schedule_id: schedule.id,
        type: "sepa_auto_collect",
      },
    });

    // Record payment
    await supabase.from("payments").insert({
      invoice_id: invoice!.id,
      montant: amount,
      moyen: "prelevement",
      provider_ref: paymentIntent.id,
      date_paiement: dateStr,
      statut: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
    });

    if (paymentIntent.status === "succeeded") {
      await supabase
        .from("invoices")
        .update({ statut: "paid", date_paiement: dateStr, stripe_payment_intent_id: paymentIntent.id })
        .eq("id", invoice!.id);

      // Reset retry counter on success
      await supabase
        .from("payment_schedules")
        .update({ retry_count: 0, next_retry_at: null, last_attempt_at: new Date().toISOString(), last_failure_reason: null })
        .eq("id", schedule.id);

      // Audit log
      await supabase.from("payment_method_audit_log").insert({
        tenant_profile_id: typedMandate.tenant_profile_id,
        action: "payment_success",
        details: { amount, periode, payment_intent_id: paymentIntent.id, is_retry: isRetry },
      });

      // Notify via outbox
      await supabase.from("outbox").insert({
        event_type: "SepaCollection.Succeeded",
        payload: {
          tenant_id: typedMandate.tenant_profile_id,
          owner_id: typedMandate.owner_profile_id,
          amount,
          periode,
          invoice_id: invoice!.id,
        },
      });

      console.log(`[SEPA] SUCCESS: ${amount}€ collected for lease ${schedule.lease_id}`);
      return { success: true };
    }

    // Payment pending (SEPA typically returns "processing")
    console.log(`[SEPA] Payment status: ${paymentIntent.status} for lease ${schedule.lease_id}`);
    return { success: true };

  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error(`[SEPA] FAILED for lease ${schedule.lease_id}:`, errorMessage);

    // Smart Retry logic
    const newRetryCount = schedule.retry_count + 1;
    const retryDelayDays = RETRY_DELAYS_DAYS[Math.min(newRetryCount - 1, RETRY_DELAYS_DAYS.length - 1)];
    const nextRetry = newRetryCount < MAX_RETRIES
      ? new Date(Date.now() + retryDelayDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    await supabase
      .from("payment_schedules")
      .update({
        retry_count: newRetryCount,
        last_attempt_at: new Date().toISOString(),
        last_failure_reason: errorMessage.slice(0, 500),
        next_retry_at: nextRetry,
      })
      .eq("id", schedule.id);

    // Audit
    if (schedule.mandate_id) {
      const { data: mandate } = await supabase
        .from("sepa_mandates")
        .select("tenant_profile_id")
        .eq("id", schedule.mandate_id)
        .single();

      if (mandate) {
        await supabase.from("payment_method_audit_log").insert({
          tenant_profile_id: mandate.tenant_profile_id,
          action: "payment_failed",
          details: { error: errorMessage, retry_count: newRetryCount, next_retry_at: nextRetry },
        });

        // Notify tenant of failure
        await supabase.from("outbox").insert({
          event_type: "SepaCollection.Failed",
          payload: {
            tenant_id: mandate.tenant_profile_id,
            error: errorMessage,
            retry_count: newRetryCount,
            next_retry_at: nextRetry,
          },
        });
      }
    }

    return { success: false, error: errorMessage };
  }
}
