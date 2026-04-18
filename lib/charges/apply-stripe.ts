/**
 * Sprint 0.d — Stripe helper pour la route POST /apply lorsqu'on règle
 * une régul via Stripe.
 *
 * Crée l'invoice + le PaymentIntent, renvoie le clientSecret pour
 * que la frontend puisse confirmer la carte. Utilise le service role
 * client parce que la route /apply tourne sous un user owner et
 * l'invoice touche le tenant_id (cross-user).
 *
 * À NE PAS appeler pour les autres scénarios (next_rent, installments_12,
 * deduction, waived) — aucune invoice n'est créée.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { createPaymentIntent } from "@/lib/services/stripe.service";

export class StripeRegularizationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StripeRegularizationError";
  }
}

export interface CreateStripePaymentParams {
  /** Supabase client SERVICE ROLE (pas user-scoped). */
  serviceClient: SupabaseClient;
  regularizationId: string;
  leaseId: string;
  propertyId: string;
  fiscalYear: number;
  /** Balance à facturer en centimes — doit être > 0. */
  balanceCents: number;
}

export interface CreateStripePaymentResult {
  invoiceId: string;
  paymentIntentId: string;
  clientSecret: string | null;
}

export async function createRegularizationStripePayment(
  params: CreateStripePaymentParams,
): Promise<CreateStripePaymentResult> {
  const {
    serviceClient,
    regularizationId,
    leaseId,
    propertyId,
    fiscalYear,
    balanceCents,
  } = params;

  if (balanceCents <= 0) {
    throw new StripeRegularizationError(
      "balanceCents doit être > 0 pour une régul Stripe (stripe = complément dû)",
    );
  }

  // Resolve tenant_id via lease_signers
  const { data: signerRow, error: signerError } = await serviceClient
    .from("lease_signers")
    .select("profile_id")
    .eq("lease_id", leaseId)
    .eq("role", "locataire_principal")
    .limit(1)
    .maybeSingle();

  if (signerError) {
    throw new StripeRegularizationError(
      "Erreur lecture lease_signers",
      signerError,
    );
  }
  const tenantId = (signerRow as { profile_id: string } | null)?.profile_id;
  if (!tenantId) {
    throw new StripeRegularizationError(
      "Aucun locataire principal trouvé pour ce bail — impossible de créer l'invoice",
    );
  }

  // Resolve owner_id via properties
  const { data: propRow, error: propError } = await serviceClient
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .single();

  if (propError || !propRow) {
    throw new StripeRegularizationError(
      "Bien introuvable lors de la résolution owner_id",
      propError,
    );
  }
  const ownerId = (propRow as { owner_id: string }).owner_id;

  // Create invoice (draft) — periode synthétique unique par régul fiscal_year
  // Note : UNIQUE(lease_id, periode) garantit pas de doublon puisque
  // chaque régul a un fiscal_year unique par bail (UNIQUE(lease_id, fiscal_year)).
  const periode = `${fiscalYear}-REG`;
  const montantTotal = balanceCents / 100;

  const { data: invoiceRow, error: invoiceError } = await serviceClient
    .from("invoices")
    .insert({
      lease_id: leaseId,
      owner_id: ownerId,
      tenant_id: tenantId,
      periode,
      montant_total: montantTotal,
      montant_loyer: 0,
      montant_charges: montantTotal,
      statut: "draft",
    })
    .select("id")
    .single();

  if (invoiceError || !invoiceRow) {
    throw new StripeRegularizationError(
      "Impossible de créer la facture régul",
      invoiceError,
    );
  }
  const invoiceId = (invoiceRow as { id: string }).id;

  // Create PaymentIntent
  const pi = await createPaymentIntent({
    amount: balanceCents,
    currency: "eur",
    description: `Régularisation charges ${fiscalYear}`,
    metadata: {
      type: "charge_regularization",
      regularization_id: regularizationId,
      invoice_id: invoiceId,
      lease_id: leaseId,
      periode,
    },
  });

  if (!pi.success || !pi.paymentIntentId) {
    // Rollback invoice to avoid orphan draft
    await serviceClient.from("invoices").delete().eq("id", invoiceId);
    throw new StripeRegularizationError(
      pi.error ?? "Échec création PaymentIntent Stripe",
    );
  }

  // Link PaymentIntent to invoice
  const { error: updateError } = await serviceClient
    .from("invoices")
    .update({ stripe_payment_intent_id: pi.paymentIntentId })
    .eq("id", invoiceId);

  if (updateError) {
    // PaymentIntent is live in Stripe but not linked. Log but don't rollback —
    // the tenant can still pay; link can be fixed by webhook via metadata.
    // eslint-disable-next-line no-console
    console.error(
      "[apply-stripe] PaymentIntent créé mais link invoice failed",
      { invoiceId, paymentIntentId: pi.paymentIntentId, updateError },
    );
  }

  return {
    invoiceId,
    paymentIntentId: pi.paymentIntentId,
    clientSecret: pi.clientSecret ?? null,
  };
}
