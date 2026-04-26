/**
 * security-deposit-sync.service — Rattache un dépôt de garantie à un bail
 * dès qu'une facture initiale est encaissée (Stripe, chèque, virement,
 * espèces…).
 *
 * Le trigger SQL `trg_create_security_deposit` ne se déclenche qu'à
 * l'activation du bail (`leases.statut = 'active'`). Or le dépôt peut être
 * encaissé AVANT que le bail soit formellement activé (pré-remplissage
 * Stripe, encaissement en espèces au moment de la remise des clés, etc.).
 * Dans ce cas, la trace existait uniquement sur `invoices.metadata` et le
 * suivi "Dépôts de garantie" restait vide.
 *
 * Ce helper comble le gap en créant / mettant à jour la ligne
 * `security_deposits` à partir de la facture initiale soldée. Idempotent :
 * UNIQUE(lease_id) + ON CONFLICT DO UPDATE limité aux statuts non
 * terminaux.
 */

type SupabaseLike = {
  from: (table: string) => any;
};

export type SecurityDepositPaymentMethod =
  | "sepa_debit"
  | "card"
  | "bank_transfer"
  | "check"
  | "cash"
  | "other";

interface SyncParams {
  invoiceId: string;
  paidAt: string;
  paymentMethod?: SecurityDepositPaymentMethod | null;
}

interface SyncResult {
  created: boolean;
  updated: boolean;
  depositId: string | null;
  skipped?: "not-initial" | "no-deposit" | "no-tenant" | "no-lease";
}

function normalizePaymentMethod(
  raw: string | null | undefined
): SecurityDepositPaymentMethod | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.includes("sepa") || v.includes("prelev")) return "sepa_debit";
  if (v === "cb" || v === "card" || v.includes("carte")) return "card";
  if (v.includes("virement") || v.includes("transfer")) return "bank_transfer";
  if (v.includes("cheque") || v === "check") return "check";
  if (v.includes("espece") || v === "cash") return "cash";
  return "other";
}

async function resolveTenantId(
  supabase: SupabaseLike,
  invoice: { tenant_id?: string | null; lease_id?: string | null }
): Promise<string | null> {
  if (invoice.tenant_id) return invoice.tenant_id;
  if (!invoice.lease_id) return null;

  const { data } = await supabase
    .from("lease_signers")
    .select("profile_id, role")
    .eq("lease_id", invoice.lease_id)
    .eq("role", "locataire_principal")
    .limit(1)
    .maybeSingle();

  return (data as { profile_id?: string | null } | null)?.profile_id ?? null;
}

export async function ensureSecurityDepositForInvoice(
  supabase: SupabaseLike,
  { invoiceId, paidAt, paymentMethod }: SyncParams
): Promise<SyncResult> {
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id, lease_id, tenant_id, metadata, type, statut")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoice = invoiceRow as
    | {
        id: string;
        lease_id: string | null;
        tenant_id: string | null;
        metadata: Record<string, unknown> | null;
        type: string | null;
        statut: string | null;
      }
    | null;

  if (!invoice) {
    return { created: false, updated: false, depositId: null, skipped: "not-initial" };
  }

  if (!invoice.lease_id) {
    return { created: false, updated: false, depositId: null, skipped: "no-lease" };
  }

  const metadata = invoice.metadata ?? {};
  const metaType = typeof metadata.type === "string" ? metadata.type : null;
  const isInitial = metaType === "initial_invoice" || invoice.type === "initial_invoice";
  if (!isInitial) {
    return { created: false, updated: false, depositId: null, skipped: "not-initial" };
  }

  const includesDeposit =
    metadata.includes_deposit === true || metadata.includes_deposit === "true";
  const depositAmountEuros = Number(metadata.deposit_amount ?? 0);
  if (!includesDeposit || !Number.isFinite(depositAmountEuros) || depositAmountEuros <= 0) {
    return { created: false, updated: false, depositId: null, skipped: "no-deposit" };
  }

  const tenantId = await resolveTenantId(supabase, invoice);
  if (!tenantId) {
    return { created: false, updated: false, depositId: null, skipped: "no-tenant" };
  }

  const amountCents = Math.round(depositAmountEuros * 100);
  const method = normalizePaymentMethod(paymentMethod ?? null);

  const { data: existing } = await supabase
    .from("security_deposits")
    .select("id, status, amount_cents, paid_at, payment_method")
    .eq("lease_id", invoice.lease_id)
    .maybeSingle();

  const existingRow = existing as
    | {
        id: string;
        status: string;
        amount_cents: number;
        paid_at: string | null;
        payment_method: string | null;
      }
    | null;

  if (!existingRow) {
    const { data: inserted, error } = await supabase
      .from("security_deposits")
      .insert({
        lease_id: invoice.lease_id,
        tenant_id: tenantId,
        amount_cents: amountCents,
        paid_at: paidAt,
        payment_method: method,
        status: "received",
        metadata: { source: "invoice_payment", invoice_id: invoice.id },
      })
      .select("id")
      .maybeSingle();

    if (error) {
      throw new Error(`security_deposits insert failed: ${error.message}`);
    }

    return {
      created: true,
      updated: false,
      depositId: (inserted as { id?: string } | null)?.id ?? null,
    };
  }

  // Ne jamais écraser un dépôt déjà restitué / partiellement restitué /
  // en litige. Pour un dépôt en 'pending' (créé par le trigger à
  // l'activation du bail) ou déjà 'received', on sécurise les champs
  // manquants sans réécrire ceux qui portent de la valeur métier.
  if (["returned", "partially_returned", "disputed"].includes(existingRow.status)) {
    return { created: false, updated: false, depositId: existingRow.id };
  }

  const patch: Record<string, unknown> = {};
  if (existingRow.status === "pending") patch.status = "received";
  if (!existingRow.paid_at) patch.paid_at = paidAt;
  if (!existingRow.payment_method && method) patch.payment_method = method;
  if (!existingRow.amount_cents || existingRow.amount_cents <= 0) {
    patch.amount_cents = amountCents;
  }

  if (Object.keys(patch).length === 0) {
    return { created: false, updated: false, depositId: existingRow.id };
  }

  const { error: updateError } = await supabase
    .from("security_deposits")
    .update(patch)
    .eq("id", existingRow.id);

  if (updateError) {
    throw new Error(`security_deposits update failed: ${updateError.message}`);
  }

  return { created: false, updated: true, depositId: existingRow.id };
}
