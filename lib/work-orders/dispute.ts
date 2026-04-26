/**
 * Service de gestion des litiges sur les paiements work orders.
 *
 * Flux :
 *   1. Owner conteste un paiement en escrow_status='held' (ou 'released' si
 *      vraiment problème post-libération, dans la limite de la fenêtre de
 *      remboursement Stripe).
 *   2. work_order_payments.escrow_status passe à 'disputed' → cron de
 *      libération auto bloqué.
 *   3. Admin Talok examine + tranche :
 *        - Libère vers le prestataire (resolved_release)
 *        - Rembourse vers le proprio (resolved_refund) → Stripe Refund
 *        - Mix (resolved_partial)
 *   4. Le owner peut retirer sa contestation (withdrawn) à tout moment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export type DisputeReason =
  | "work_not_done"
  | "work_incomplete"
  | "quality_issue"
  | "wrong_amount"
  | "unauthorized"
  | "other";

export interface RaiseDisputeInput {
  workOrderPaymentId: string;
  raisedByProfileId: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls?: string[];
}

export class DisputeError extends Error {
  constructor(
    public readonly code:
      | "PAYMENT_NOT_FOUND"
      | "INVALID_STATE"
      | "ALREADY_DISPUTED"
      | "STRIPE_ERROR"
      | "NOT_FOUND",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DisputeError";
  }
}

/**
 * Crée un litige et bloque la libération automatique du paiement.
 */
export async function raiseDispute(
  supabase: SupabaseClient,
  input: RaiseDisputeInput,
): Promise<{ disputeId: string }> {
  const { workOrderPaymentId, raisedByProfileId, reason, description, evidenceUrls = [] } = input;

  // 1. Charger le paiement
  const { data: payment } = await supabase
    .from("work_order_payments")
    .select("id, work_order_id, escrow_status, status")
    .eq("id", workOrderPaymentId)
    .maybeSingle();

  if (!payment) {
    throw new DisputeError(
      "PAYMENT_NOT_FOUND",
      `Paiement ${workOrderPaymentId} introuvable`,
    );
  }

  const p = payment as {
    id: string;
    work_order_id: string;
    escrow_status: string;
    status: string;
  };

  if (p.escrow_status === "disputed") {
    throw new DisputeError(
      "ALREADY_DISPUTED",
      "Ce paiement est déjà en litige",
    );
  }

  if (!["held", "released"].includes(p.escrow_status)) {
    throw new DisputeError(
      "INVALID_STATE",
      `Impossible de contester un paiement en escrow_status='${p.escrow_status}'`,
    );
  }

  // 2. Créer la ligne dispute
  const { data: dispute, error: dErr } = await supabase
    .from("work_order_disputes")
    .insert({
      work_order_payment_id: workOrderPaymentId,
      work_order_id: p.work_order_id,
      raised_by_profile_id: raisedByProfileId,
      reason,
      description,
      evidence_urls: evidenceUrls,
      status: "open",
    })
    .select("id")
    .single();

  if (dErr || !dispute) {
    throw new DisputeError(
      "STRIPE_ERROR",
      `Erreur création dispute: ${dErr?.message ?? "unknown"}`,
      dErr,
    );
  }

  // 3. Bloquer le paiement (escrow_status='disputed') si encore en escrow.
  //    Si déjà 'released', on garde le status pour audit mais le dispute
  //    nécessitera un Refund Stripe (admin tranche).
  if (p.escrow_status === "held") {
    await supabase
      .from("work_order_payments")
      .update({ escrow_status: "disputed" })
      .eq("id", workOrderPaymentId)
      .eq("escrow_status", "held");
  }

  return { disputeId: (dispute as { id: string }).id };
}

/**
 * L'owner retire sa contestation. Si le paiement était bloqué en
 * 'disputed', il revient à 'held' et reprend son cycle normal.
 */
export async function withdrawDispute(
  supabase: SupabaseClient,
  disputeId: string,
  profileId: string,
): Promise<void> {
  const { data: dispute } = await supabase
    .from("work_order_disputes")
    .select("id, work_order_payment_id, status, raised_by_profile_id")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) {
    throw new DisputeError("NOT_FOUND", `Litige ${disputeId} introuvable`);
  }

  const d = dispute as {
    id: string;
    work_order_payment_id: string;
    status: string;
    raised_by_profile_id: string;
  };

  if (d.raised_by_profile_id !== profileId) {
    throw new DisputeError(
      "INVALID_STATE",
      "Seul le contestataire peut retirer la contestation",
    );
  }

  if (d.status !== "open") {
    throw new DisputeError(
      "INVALID_STATE",
      `Litige déjà résolu (status=${d.status})`,
    );
  }

  await supabase
    .from("work_order_disputes")
    .update({
      status: "withdrawn",
      resolved_at: new Date().toISOString(),
      resolved_by_profile_id: profileId,
    })
    .eq("id", disputeId);

  // Débloquer le paiement si encore en disputed
  await supabase
    .from("work_order_payments")
    .update({ escrow_status: "held" })
    .eq("id", d.work_order_payment_id)
    .eq("escrow_status", "disputed");
}

/**
 * Admin résout un litige par remboursement (full ou partiel).
 * Crée un Stripe Refund sur la charge associée au paiement.
 */
export async function refundDisputedPayment(
  supabase: SupabaseClient,
  disputeId: string,
  options: {
    refundAmountCents?: number; // si absent, full refund
    resolvedByProfileId: string;
    notes?: string;
  },
): Promise<{ stripeRefundId: string; refundAmountCents: number }> {
  const { refundAmountCents, resolvedByProfileId, notes } = options;

  // 1. Charger dispute + payment
  const { data: row } = await (supabase as any)
    .from("work_order_disputes")
    .select(
      "id, work_order_payment_id, status, work_order_payments!inner(id, gross_amount, stripe_charge_id, stripe_payment_intent_id)",
    )
    .eq("id", disputeId)
    .maybeSingle();

  if (!row) throw new DisputeError("NOT_FOUND", `Litige ${disputeId} introuvable`);
  const r = row as {
    id: string;
    work_order_payment_id: string;
    status: string;
    work_order_payments: {
      id: string;
      gross_amount: number | string;
      stripe_charge_id: string | null;
      stripe_payment_intent_id: string | null;
    };
  };

  if (r.status !== "open") {
    throw new DisputeError(
      "INVALID_STATE",
      `Litige déjà résolu (status=${r.status})`,
    );
  }

  const grossCents = Math.round(Number(r.work_order_payments.gross_amount) * 100);
  const amountCents = refundAmountCents ?? grossCents;
  if (amountCents <= 0 || amountCents > grossCents) {
    throw new DisputeError(
      "INVALID_STATE",
      `Montant de remboursement invalide (${amountCents} cents pour gross=${grossCents})`,
    );
  }

  // 2. Créer le Refund Stripe (priorité charge_id, fallback payment_intent)
  const refundParams: any = {
    amount: amountCents,
    metadata: {
      type: "work_order_dispute_refund",
      dispute_id: r.id,
      payment_id: r.work_order_payment_id,
    },
    reason: "requested_by_customer",
  };
  if (r.work_order_payments.stripe_charge_id) {
    refundParams.charge = r.work_order_payments.stripe_charge_id;
  } else if (r.work_order_payments.stripe_payment_intent_id) {
    refundParams.payment_intent = r.work_order_payments.stripe_payment_intent_id;
  } else {
    throw new DisputeError(
      "INVALID_STATE",
      "Aucune charge ni PaymentIntent Stripe associé — refund impossible",
    );
  }

  let refund;
  try {
    refund = await stripe.refunds.create(refundParams, {
      idempotencyKey: `wo-dispute-refund-${r.id}`,
    });
  } catch (err) {
    throw new DisputeError(
      "STRIPE_ERROR",
      err instanceof Error ? err.message : "Erreur Stripe",
      err,
    );
  }

  // 3. Mettre à jour la dispute
  const isPartial = amountCents < grossCents;
  await supabase
    .from("work_order_disputes")
    .update({
      status: isPartial ? "resolved_partial" : "resolved_refund",
      resolved_at: new Date().toISOString(),
      resolved_by_profile_id: resolvedByProfileId,
      resolution_notes: notes ?? null,
      stripe_refund_id: refund.id,
      refund_amount: amountCents / 100,
    })
    .eq("id", r.id);

  // 4. Mettre à jour le paiement
  await supabase
    .from("work_order_payments")
    .update({
      escrow_status: isPartial ? "released" : "refunded",
      status: isPartial ? "succeeded" : "refunded",
    })
    .eq("id", r.work_order_payment_id);

  return { stripeRefundId: refund.id, refundAmountCents: amountCents };
}

/**
 * Admin tranche en faveur du prestataire : libération normale via le service
 * release-escrow, et clôture du litige.
 */
export async function releaseDisputedPayment(
  supabase: SupabaseClient,
  disputeId: string,
  resolvedByProfileId: string,
  notes?: string,
): Promise<{ paymentId: string }> {
  const { data: dispute } = await supabase
    .from("work_order_disputes")
    .select("id, work_order_payment_id, status")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) throw new DisputeError("NOT_FOUND", `Litige ${disputeId} introuvable`);
  const d = dispute as {
    id: string;
    work_order_payment_id: string;
    status: string;
  };

  if (d.status !== "open") {
    throw new DisputeError(
      "INVALID_STATE",
      `Litige déjà résolu (status=${d.status})`,
    );
  }

  // 1. Débloquer le paiement (disputed -> held) avant la libération
  await supabase
    .from("work_order_payments")
    .update({ escrow_status: "held" })
    .eq("id", d.work_order_payment_id)
    .eq("escrow_status", "disputed");

  // 2. Libérer
  const { releaseEscrowToProvider } = await import("./release-escrow");
  await releaseEscrowToProvider(supabase, {
    paymentId: d.work_order_payment_id,
    reason: "manual_admin_release",
    releasedByProfileId: resolvedByProfileId,
  });

  // 3. Clôturer la dispute
  await supabase
    .from("work_order_disputes")
    .update({
      status: "resolved_release",
      resolved_at: new Date().toISOString(),
      resolved_by_profile_id: resolvedByProfileId,
      resolution_notes: notes ?? null,
    })
    .eq("id", d.id);

  return { paymentId: d.work_order_payment_id };
}
