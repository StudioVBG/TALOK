import type { ConnectAccount as StripeConnectAccount } from "@/lib/stripe/connect.service";

export interface StoredConnectAccount {
  id: string;
  stripe_account_id: string;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  requirements_currently_due?: string[] | null;
  requirements_eventually_due?: string[] | null;
  requirements_past_due?: string[] | null;
  requirements_disabled_reason?: string | null;
  bank_account_last4?: string | null;
  bank_account_bank_name?: string | null;
  created_at?: string | null;
  onboarding_completed_at?: string | null;
}

export interface ConnectAccountPayload {
  id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  is_ready: boolean;
  onboarding_incomplete: boolean;
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    disabled_reason: string | null;
  };
  missing_requirements: string[];
  bank_account: { last4: string; bank_name?: string } | null;
  created_at: string | null;
  onboarding_completed_at: string | null;
  _cached?: boolean;
}

export interface ConnectAccountResponse {
  has_account: boolean;
  not_configured?: boolean;
  account: ConnectAccountPayload | null;
}

function normalizeRequirements(source?: StripeConnectAccount["requirements"] | null) {
  return {
    currently_due: source?.currently_due ?? [],
    eventually_due: source?.eventually_due ?? [],
    past_due: source?.past_due ?? [],
    disabled_reason: source?.disabled_reason ?? null,
  };
}

export function getConnectMissingRequirements(
  requirements?: StripeConnectAccount["requirements"] | null
): string[] {
  const normalized = normalizeRequirements(requirements);
  return Array.from(new Set([
    ...normalized.currently_due,
    ...normalized.past_due,
  ]));
}

export function buildConnectAccountResponse(
  stored: StoredConnectAccount,
  stripeAccount?: StripeConnectAccount | null,
  options?: { cached?: boolean }
): ConnectAccountResponse {
  const requirements = normalizeRequirements(
    stripeAccount
      ? stripeAccount.requirements
      : {
          currently_due: stored.requirements_currently_due ?? [],
          eventually_due: stored.requirements_eventually_due ?? [],
          past_due: stored.requirements_past_due ?? [],
          disabled_reason: stored.requirements_disabled_reason ?? null,
        }
  );

  const chargesEnabled = Boolean(
    stripeAccount ? stripeAccount.charges_enabled : stored.charges_enabled
  );
  const payoutsEnabled = Boolean(
    stripeAccount ? stripeAccount.payouts_enabled : stored.payouts_enabled
  );
  const detailsSubmitted = Boolean(
    stripeAccount ? stripeAccount.details_submitted : stored.details_submitted
  );
  const missingRequirements = getConnectMissingRequirements(requirements);
  const isReady =
    chargesEnabled &&
    payoutsEnabled &&
    detailsSubmitted &&
    missingRequirements.length === 0;

  return {
    has_account: true,
    account: {
      id: stored.id,
      stripe_account_id: stored.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
      details_submitted: detailsSubmitted,
      is_ready: isReady,
      onboarding_incomplete: !isReady,
      requirements,
      missing_requirements: missingRequirements,
      bank_account: stripeAccount?.external_accounts?.data[0]
        ? {
            last4: stripeAccount.external_accounts.data[0].last4,
            bank_name: stripeAccount.external_accounts.data[0].bank_name,
          }
        : stored.bank_account_last4
          ? {
              last4: stored.bank_account_last4,
              bank_name: stored.bank_account_bank_name ?? undefined,
            }
          : null,
      created_at: stored.created_at ?? null,
      onboarding_completed_at: stored.onboarding_completed_at ?? null,
      ...(options?.cached ? { _cached: true } : {}),
    },
  };
}
