import { calculatePaymentFees, type PaymentMethod } from "@/lib/subscriptions/payment-fees";
import { connectService } from "@/lib/stripe/connect.service";
import type { PlanSlug } from "@/lib/subscriptions/plans";

type SupabaseLike = {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
    insert: (values: Record<string, unknown>) => any;
  };
};

type ReconcileOwnerTransferParams = {
  paymentId: string;
  invoiceId: string;
  paymentIntentId?: string | null;
  sourceTransactionId?: string | null;
  amountCents: number;
  paymentMethod: string;
};

export function normalizeStripePaymentMethod(method?: string | null): PaymentMethod {
  if (method === "sepa_debit" || method === "sepa") {
    return "sepa";
  }

  if (method === "bank_transfer" || method === "virement") {
    return "virement";
  }

  return "cb";
}

export async function reconcileOwnerTransfer(
  supabase: SupabaseLike,
  params: ReconcileOwnerTransferParams
): Promise<{ created: boolean; skippedReason?: string; transferId?: string | null }> {
  const { data: existingTransfer } = await supabase
    .from("stripe_transfers")
    .select("id")
    .eq("payment_id", params.paymentId)
    .maybeSingle();

  if ((existingTransfer as { id?: string } | null)?.id) {
    return { created: false, skippedReason: "already_exists", transferId: existingTransfer.id };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("owner_id")
    .eq("id", params.invoiceId)
    .maybeSingle();

  const ownerId = (invoice as { owner_id?: string } | null)?.owner_id;
  if (!ownerId) {
    return { created: false, skippedReason: "missing_owner" };
  }

  const { data: connectAccount } = await supabase
    .from("stripe_connect_accounts")
    .select("id, stripe_account_id, charges_enabled, payouts_enabled")
    .eq("profile_id", ownerId)
    .maybeSingle();

  const readyAccount = connectAccount as
    | {
        id?: string;
        stripe_account_id?: string;
        charges_enabled?: boolean;
        payouts_enabled?: boolean;
      }
    | null;

  if (
    !readyAccount?.id ||
    !readyAccount.stripe_account_id ||
    !readyAccount.charges_enabled ||
    !readyAccount.payouts_enabled
  ) {
    return { created: false, skippedReason: "connect_not_ready" };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan_slug")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const ownerPlan = ((subscription as { plan_slug?: PlanSlug } | null)?.plan_slug ||
    "gratuit") as PlanSlug;
  const normalizedMethod = normalizeStripePaymentMethod(params.paymentMethod);
  const fees = calculatePaymentFees(params.amountCents, normalizedMethod, ownerPlan);

  if (fees.netAmount <= 0) {
    return { created: false, skippedReason: "net_amount_not_positive" };
  }

  const transfer = await connectService.createTransfer({
    amount: fees.netAmount,
    destinationAccountId: readyAccount.stripe_account_id,
    currency: "eur",
    description: `Reversement loyer ${params.invoiceId}`,
    sourceTransaction: params.sourceTransactionId || undefined,
    transferGroup: `invoice_${params.invoiceId}`,
    idempotencyKey: `owner-transfer:${params.paymentId}`,
    metadata: {
      invoice_id: params.invoiceId,
      payment_id: params.paymentId,
      owner_id: ownerId,
      payment_method: normalizedMethod,
      gross_amount_cents: String(params.amountCents),
      platform_fee_cents: String(fees.feeAmount),
      stripe_fee_cents: String(fees.stripeCost),
      owner_plan: ownerPlan,
    },
  });

  await supabase.from("stripe_transfers").insert({
    connect_account_id: readyAccount.id,
    payment_id: params.paymentId,
    invoice_id: params.invoiceId,
    stripe_transfer_id: transfer.id,
    stripe_payment_intent_id: params.paymentIntentId || null,
    stripe_source_transaction_id: params.sourceTransactionId || null,
    amount: params.amountCents,
    currency: "eur",
    platform_fee: fees.feeAmount,
    stripe_fee: fees.stripeCost,
    net_amount: fees.netAmount,
    status: "paid",
    description: `Reversement loyer ${params.invoiceId}`,
    metadata: {
      payment_method: normalizedMethod,
      owner_plan: ownerPlan,
      platform_margin: fees.platformMargin,
    },
    completed_at: new Date().toISOString(),
  });

  return { created: true, transferId: transfer.id };
}
