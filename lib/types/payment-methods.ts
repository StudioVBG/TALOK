/**
 * Types SOTA 2026 pour la gestion des moyens de paiement locataire
 */

export type PaymentMethodType = 'card' | 'sepa_debit' | 'apple_pay' | 'google_pay' | 'link';
export type PaymentMethodStatus = 'active' | 'expired' | 'revoked' | 'failed';
export type SepaMandateStatus = 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired' | 'failed';
export type ScheduleMethodType = 'sepa' | 'card' | 'pay_by_bank';

export interface TenantPaymentMethod {
  id: string;
  tenant_profile_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  type: PaymentMethodType;
  is_default: boolean;
  label: string | null;

  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;

  sepa_last4: string | null;
  sepa_bank_code: string | null;
  sepa_country: string | null;
  sepa_mandate_id: string | null;

  status: PaymentMethodStatus;
  last_used_at: string | null;
  failure_count: number;
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;
}

export interface SepaMandate {
  id: string;
  mandate_reference: string;
  tenant_profile_id: string;
  owner_profile_id: string;
  lease_id: string;
  debtor_name: string;
  debtor_iban: string;
  creditor_name: string;
  creditor_iban: string;
  creditor_bic: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_mandate_id: string | null;
  amount: number;
  signature_date: string;
  signed_at: string | null;
  signature_method: 'electronic' | 'paper' | 'api';
  first_collection_date: string | null;
  status: SepaMandateStatus;
  last_prenotification_sent_at: string | null;
  next_collection_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentSchedule {
  id: string;
  lease_id: string;
  mandate_id: string | null;
  payment_method_id: string | null;
  payment_method_type: ScheduleMethodType;
  collection_day: number;
  rent_amount: number;
  charges_amount: number;
  is_active: boolean;
  start_date: string;
  end_date: string | null;
  retry_count: number;
  max_retries: number;
  last_attempt_at: string | null;
  last_failure_reason: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethodAuditEntry {
  id: string;
  tenant_profile_id: string;
  payment_method_id: string | null;
  action: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AddPaymentMethodPayload {
  stripe_payment_method_id: string;
  type?: PaymentMethodType;
  is_default?: boolean;
  label?: string;
}

export interface PaymentMethodDisplay {
  id: string;
  type: PaymentMethodType;
  is_default: boolean;
  label: string;
  displayName: string;
  icon: 'visa' | 'mastercard' | 'amex' | 'sepa' | 'apple_pay' | 'google_pay' | 'card';
  last4: string;
  expiresAt: string | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  status: PaymentMethodStatus;
}

export function toPaymentMethodDisplay(pm: TenantPaymentMethod): PaymentMethodDisplay {
  const isCard = pm.type === 'card' || pm.type === 'apple_pay' || pm.type === 'google_pay';
  const isSepa = pm.type === 'sepa_debit';

  const now = new Date();
  const expMonth = pm.card_exp_month ?? 0;
  const expYear = pm.card_exp_year ?? 0;
  const expDate = isCard && expYear > 0
    ? new Date(expYear, expMonth, 0)
    : null;
  const isExpired = expDate ? expDate < now : false;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isExpiringSoon = expDate ? expDate < thirtyDaysFromNow && !isExpired : false;

  const brandMap: Record<string, PaymentMethodDisplay['icon']> = {
    visa: 'visa',
    mastercard: 'mastercard',
    amex: 'amex',
  };

  const icon: PaymentMethodDisplay['icon'] = isSepa
    ? 'sepa'
    : pm.type === 'apple_pay'
      ? 'apple_pay'
      : pm.type === 'google_pay'
        ? 'google_pay'
        : brandMap[pm.card_brand?.toLowerCase() ?? ''] ?? 'card';

  const displayName = isSepa
    ? `SEPA •••• ${pm.sepa_last4 ?? '????'}`
    : `${(pm.card_brand ?? 'Carte').charAt(0).toUpperCase() + (pm.card_brand ?? 'carte').slice(1)} •••• ${pm.card_last4 ?? '????'}`;

  const expiresAt = isCard && expMonth && expYear
    ? `${String(expMonth).padStart(2, '0')}/${expYear}`
    : null;

  return {
    id: pm.id,
    type: pm.type,
    is_default: pm.is_default,
    label: pm.label || displayName,
    displayName,
    icon,
    last4: isSepa ? (pm.sepa_last4 ?? '') : (pm.card_last4 ?? ''),
    expiresAt,
    isExpiringSoon,
    isExpired,
    status: isExpired ? 'expired' : pm.status,
  };
}
