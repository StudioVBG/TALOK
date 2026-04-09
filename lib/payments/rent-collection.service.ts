/**
 * Service Stripe Connect Express — Collecte de loyers
 *
 * Circuit B du modèle Talok :
 *   Locataire paie → Stripe → application_fee pour Talok + on_behalf_of proprio
 *
 * RÈGLES :
 * - SEPA uniquement pour les loyers (jamais CB)
 * - Commission depuis PLAN_LIMITS (jamais hardcoder)
 * - Vérifier charges_enabled avant de créer un PaymentIntent
 * - Métadonnées obligatoires dans chaque PaymentIntent
 */

import { stripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase/service-client";
import { calculatePaymentFees } from "@/lib/subscriptions/payment-fees";
import type { PlanSlug } from "@/lib/subscriptions/plans";

// ============================================
// TYPES
// ============================================

export interface CreateRentPaymentParams {
  invoiceId: string;
  leaseId: string;
  tenantId: string;
  ownerId: string;
  /** Total amount in cents */
  amountCents: number;
  /** Stripe customer ID for the tenant */
  stripeCustomerId: string;
  /** SEPA payment method ID */
  stripePaymentMethodId: string;
  /** Owner's plan slug for commission calculation */
  ownerPlanSlug: PlanSlug;
}

export interface RentPaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  rentPaymentId?: string;
  commissionCents?: number;
  ownerAmountCents?: number;
  error?: string;
}

export interface ConnectAccountInfo {
  stripeAccountId: string;
  chargesEnabled: boolean;
  ownerId: string;
}

// ============================================
// CONNECT ACCOUNT HELPERS
// ============================================

/**
 * Retrieve the owner's Stripe Connect account for an invoice.
 * Returns null if the owner has no active Connect account.
 */
export async function getOwnerConnectAccount(
  ownerId: string
): Promise<ConnectAccountInfo | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id, charges_enabled, owner_id")
    .eq("owner_id", ownerId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    stripe_account_id: string;
    charges_enabled: boolean;
    owner_id: string;
  };

  return {
    stripeAccountId: row.stripe_account_id,
    chargesEnabled: row.charges_enabled,
    ownerId: row.owner_id,
  };
}

/**
 * Calculate the application fee (Talok commission) for a rent payment.
 * Uses SEPA fee structure from PLAN_LIMITS.
 */
export function calculateRentCommission(
  amountCents: number,
  planSlug: PlanSlug
): { commissionCents: number; ownerAmountCents: number; commissionRate: number } {
  const fees = calculatePaymentFees(amountCents, "sepa", planSlug);

  return {
    commissionCents: fees.feeAmount,
    ownerAmountCents: amountCents - fees.feeAmount,
    commissionRate: fees.feeAmount / amountCents,
  };
}

// ============================================
// MAIN: Create Rent PaymentIntent via Connect
// ============================================

/**
 * Create a Stripe PaymentIntent for rent collection via Connect Express.
 *
 * Flow:
 * 1. Verify owner has active Connect account with charges_enabled
 * 2. Calculate commission (application_fee_amount)
 * 3. Create PaymentIntent with on_behalf_of + SEPA
 * 4. Insert rent_payments record
 */
export async function createRentPaymentIntent(
  params: CreateRentPaymentParams
): Promise<RentPaymentResult> {
  const supabase = getServiceClient();

  // 1. Get owner's Connect account
  const connectAccount = await getOwnerConnectAccount(params.ownerId);

  if (!connectAccount) {
    return {
      success: false,
      error: "Le propriétaire n'a pas de compte de paiement configuré",
    };
  }

  if (!connectAccount.chargesEnabled) {
    return {
      success: false,
      error: "Le compte de paiement du propriétaire n'est pas encore vérifié",
    };
  }

  // 2. Calculate commission
  const { commissionCents, ownerAmountCents, commissionRate } =
    calculateRentCommission(params.amountCents, params.ownerPlanSlug);

  // 3. Create PaymentIntent via Stripe Connect
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: params.amountCents,
      currency: "eur",
      payment_method_types: ["sepa_debit"],
      customer: params.stripeCustomerId,
      payment_method: params.stripePaymentMethodId,
      application_fee_amount: commissionCents,
      on_behalf_of: connectAccount.stripeAccountId,
      transfer_data: {
        destination: connectAccount.stripeAccountId,
      },
      metadata: {
        type: "rent",
        invoiceId: params.invoiceId,
        invoice_id: params.invoiceId,
        leaseId: params.leaseId,
        lease_id: params.leaseId,
        tenantId: params.tenantId,
        tenant_id: params.tenantId,
        ownerId: params.ownerId,
        owner_id: params.ownerId,
        commissionCents: String(commissionCents),
        ownerAmountCents: String(ownerAmountCents),
      },
      description: `Loyer - Facture ${params.invoiceId.slice(0, 8)}`,
      confirm: true,
      off_session: true,
    });
  } catch (err) {
    console.error("[RentCollection] Stripe PaymentIntent creation failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur Stripe",
    };
  }

  // 4. Insert rent_payments record
  const { data: rentPayment, error: insertError } = await supabase
    .from("rent_payments")
    .insert({
      invoice_id: params.invoiceId,
      lease_id: params.leaseId,
      amount_cents: params.amountCents,
      commission_amount_cents: commissionCents,
      commission_rate: commissionRate,
      owner_amount_cents: ownerAmountCents,
      stripe_payment_intent_id: paymentIntent.id,
      payment_method: "sepa_debit",
      status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
      succeeded_at:
        paymentIntent.status === "succeeded"
          ? new Date().toISOString()
          : null,
    } as any)
    .select("id")
    .single();

  if (insertError) {
    console.error("[RentCollection] Failed to insert rent_payment:", insertError);
    // Don't cancel the PI — Stripe will handle it via webhook
  }

  return {
    success: true,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret ?? undefined,
    rentPaymentId: (rentPayment as { id: string } | null)?.id,
    commissionCents,
    ownerAmountCents,
  };
}

/**
 * Handle a succeeded rent payment (called from webhook).
 * Updates rent_payments and triggers receipt generation.
 */
export async function handleRentPaymentSucceeded(
  stripePaymentIntentId: string,
  chargeId?: string,
  transferId?: string
): Promise<void> {
  const supabase = getServiceClient();

  await supabase
    .from("rent_payments")
    .update({
      status: "succeeded",
      succeeded_at: new Date().toISOString(),
      stripe_charge_id: chargeId || null,
      stripe_transfer_id: transferId || null,
    } as any)
    .eq("stripe_payment_intent_id", stripePaymentIntentId);
}

/**
 * Handle a failed rent payment (called from webhook).
 */
export async function handleRentPaymentFailed(
  stripePaymentIntentId: string,
  failureReason?: string
): Promise<void> {
  const supabase = getServiceClient();

  await supabase
    .from("rent_payments")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: failureReason || null,
    } as any)
    .eq("stripe_payment_intent_id", stripePaymentIntentId);
}
