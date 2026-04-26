/**
 * Service de libération escrow pour les paiements de work orders.
 *
 * Mode ESCROW (Separate charges and transfers) :
 *   1. Le proprio a payé via Checkout Session — la charge est sur le compte
 *      plateforme Talok (work_order_payments.escrow_status='held').
 *   2. À un moment contrôlé (démarrage des travaux pour l'acompte, validation
 *      ou délai 7j pour le solde), on appelle releaseEscrowToProvider() qui :
 *        - crée un Stripe Transfer vers le compte Connect du prestataire
 *        - le montant transféré = net_amount (déjà calculé = gross - fees)
 *        - les fees Stripe + plateforme restent sur le compte Talok
 *      Cette commission Talok sera consolidée mensuellement par un cron
 *      (Sprint à venir) qui crée une facture au prestataire.
 *
 * Concurrency / idempotence :
 *   - Un Transfer Stripe est idempotent via idempotencyKey (work_order_payment_id)
 *   - Le UPDATE RLS sur work_order_payments avec WHERE escrow_status='held'
 *     empêche une double libération
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export type ReleaseReason =
  | "deposit_release_on_start" // libération acompte au démarrage des travaux
  | "balance_release_on_validation" // libération solde validation explicite proprio
  | "balance_release_on_deadline" // libération solde après délai 7j
  | "manual_admin_release"; // libération manuelle par admin

export interface ReleaseEscrowOptions {
  paymentId: string;
  reason: ReleaseReason;
  /** Profil qui déclenche la libération (NULL si cron auto). */
  releasedByProfileId?: string | null;
}

export interface ReleaseEscrowResult {
  paymentId: string;
  transferId: string;
  netAmountCents: number;
  destinationAccount: string;
}

export class EscrowReleaseError extends Error {
  constructor(
    public readonly code:
      | "PAYMENT_NOT_FOUND"
      | "NOT_HELD"
      | "NO_CONNECT_ACCOUNT"
      | "NO_CHARGE_ID"
      | "STRIPE_ERROR"
      | "ZERO_AMOUNT",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EscrowReleaseError";
  }
}

/**
 * Libère un paiement escrow vers le compte Connect du prestataire.
 * Idempotent côté Stripe via idempotencyKey = paymentId.
 */
export async function releaseEscrowToProvider(
  supabase: SupabaseClient,
  options: ReleaseEscrowOptions,
): Promise<ReleaseEscrowResult> {
  const { paymentId, reason, releasedByProfileId = null } = options;

  // 1. Charger le paiement + work order + provider
  const { data: payment, error: pErr } = await supabase
    .from("work_order_payments")
    .select(
      "id, work_order_id, payee_profile_id, net_amount, gross_amount, escrow_status, stripe_charge_id, stripe_transfer_id, stripe_payment_intent_id",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (pErr || !payment) {
    throw new EscrowReleaseError(
      "PAYMENT_NOT_FOUND",
      `Paiement ${paymentId} introuvable`,
      pErr,
    );
  }

  const p = payment as {
    id: string;
    work_order_id: string;
    payee_profile_id: string;
    net_amount: number | string;
    gross_amount: number | string;
    escrow_status: string;
    stripe_charge_id: string | null;
    stripe_transfer_id: string | null;
    stripe_payment_intent_id: string | null;
  };

  // 2. Garde-fou : déjà libéré ?
  if (p.stripe_transfer_id) {
    return {
      paymentId: p.id,
      transferId: p.stripe_transfer_id,
      netAmountCents: Math.round(Number(p.net_amount) * 100),
      destinationAccount: "<already-released>",
    };
  }

  if (p.escrow_status !== "held") {
    throw new EscrowReleaseError(
      "NOT_HELD",
      `Paiement ${paymentId} en escrow_status='${p.escrow_status}', attendu 'held'`,
    );
  }

  if (!p.stripe_charge_id) {
    throw new EscrowReleaseError(
      "NO_CHARGE_ID",
      `Paiement ${paymentId} sans stripe_charge_id — impossible de transférer`,
    );
  }

  // 3. Compte Connect du prestataire
  const { data: connect } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled")
    .eq("profile_id", p.payee_profile_id)
    .is("entity_id", null)
    .maybeSingle();

  const c = connect as {
    stripe_account_id: string | null;
    charges_enabled: boolean | null;
    payouts_enabled: boolean | null;
  } | null;

  if (!c?.stripe_account_id) {
    throw new EscrowReleaseError(
      "NO_CONNECT_ACCOUNT",
      `Prestataire ${p.payee_profile_id} sans compte Stripe Connect`,
    );
  }
  if (!c.payouts_enabled) {
    throw new EscrowReleaseError(
      "NO_CONNECT_ACCOUNT",
      `Compte Connect du prestataire ${p.payee_profile_id} : payouts désactivés`,
    );
  }

  // 4. Montant net en centimes (gross - tous les frais)
  const netAmountCents = Math.round(Number(p.net_amount) * 100);
  if (netAmountCents <= 0) {
    throw new EscrowReleaseError(
      "ZERO_AMOUNT",
      `net_amount=${p.net_amount} pour le paiement ${paymentId}`,
    );
  }

  // 5. Créer le Transfer Stripe (idempotent par paymentId)
  let transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: netAmountCents,
        currency: "eur",
        destination: c.stripe_account_id,
        // source_transaction lie ce transfer à la charge originale, ce qui
        // permet à Stripe de débloquer le transfer même si la balance Talok
        // est insuffisante (les fonds viennent directement de la charge).
        source_transaction: p.stripe_charge_id,
        metadata: {
          type: "work_order_escrow_release",
          work_order_id: p.work_order_id,
          payment_id: p.id,
          release_reason: reason,
        },
        description: `WO ${p.work_order_id} — escrow release (${reason})`,
      },
      {
        idempotencyKey: `wo-escrow-release-${p.id}`,
      },
    );
  } catch (err: unknown) {
    throw new EscrowReleaseError(
      "STRIPE_ERROR",
      err instanceof Error ? err.message : "Erreur Stripe inconnue",
      err,
    );
  }

  // 6. Update work_order_payments — l'index partiel WHERE escrow_status='held'
  // garantit qu'on ne peut pas marquer 'released' deux fois.
  const nowIso = new Date().toISOString();
  await supabase
    .from("work_order_payments")
    .update({
      escrow_status: "released",
      escrow_released_at: nowIso,
      escrow_release_reason: reason,
      stripe_transfer_id: transfer.id,
      released_by_profile_id: releasedByProfileId,
      paid_at: nowIso,
    })
    .eq("id", p.id)
    .eq("escrow_status", "held");

  return {
    paymentId: p.id,
    transferId: transfer.id,
    netAmountCents,
    destinationAccount: c.stripe_account_id,
  };
}

/**
 * Trouve les paiements à libérer pour un work_order donné.
 * @param paymentType - Filtrer par type ('deposit' / 'balance' / 'full')
 */
export async function findHeldPayments(
  supabase: SupabaseClient,
  workOrderId: string,
  paymentType?: "deposit" | "balance" | "full",
): Promise<Array<{ id: string; payment_type: string }>> {
  let query = (supabase as any)
    .from("work_order_payments")
    .select("id, payment_type")
    .eq("work_order_id", workOrderId)
    .eq("escrow_status", "held")
    .eq("status", "succeeded");

  if (paymentType) {
    query = query.eq("payment_type", paymentType);
  }

  const { data } = await query;
  return (data || []) as Array<{ id: string; payment_type: string }>;
}
