/**
 * Embedded Finance Service
 * SOTA 2026 - BNPL, Instant Payouts, Financing
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import type {
  FinancingOffer,
  FinancingApplication,
  InstantPayout,
} from './types';

// ============================================
// FINANCING CONFIGURATION
// ============================================

export const FINANCING_CONFIG = {
  // Rent Advance (for owners)
  rentAdvance: {
    minMonths: 1,
    maxMonths: 6,
    apr: 5.9, // 5.9% APR
    eligibilityMinMonths: 6, // 6 months of rental history
    eligibilityMinRentCollected: 3000, // €3,000 minimum collected
  },

  // Deposit Splitting (for tenants)
  depositSplit: {
    installments: 3,
    apr: 0, // 0% APR for deposit
    maxAmount: 5000,
  },

  // Work Loan (for owners)
  workLoan: {
    minAmount: 1000,
    maxAmount: 50000,
    apr: 6.9,
    termMonths: [12, 24, 36, 48],
  },

  // BNPL for Rent (for tenants)
  bnpl: {
    installments: 4, // Pay in 4
    apr: 0,
    maxAmount: 2000,
    eligibilityMinPayments: 3,
  },

  // Instant Payouts
  instantPayout: {
    fee: 1.5, // 1.5% fee
    minAmount: 50,
    maxAmount: 50000,
    availableMethods: ['bank_account', 'debit_card'] as const,
  },
};

// ============================================
// ELIGIBILITY CHECKS
// ============================================

/**
 * Check owner eligibility for rent advance
 */
export async function checkRentAdvanceEligibility(userId: string): Promise<{
  eligible: boolean;
  maxAmount: number;
  reason?: string;
}> {
  const supabase = createServiceRoleClient();

  // Get owner's rental history
  const { data: payments } = await supabase
    .from('payments')
    .select('montant, date_paiement')
    .eq('owner_id', userId)
    .eq('statut', 'succeeded')
    .gte('date_paiement', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
    .order('date_paiement', { ascending: false });

  if (!payments || payments.length === 0) {
    return {
      eligible: false,
      maxAmount: 0,
      reason: 'Aucun historique de paiement',
    };
  }

  const totalCollected = payments.reduce((sum, p) => sum + (p.montant || 0), 0);
  const monthsOfHistory = Math.ceil(
    (Date.now() - new Date(payments[payments.length - 1].date_paiement).getTime()) /
    (30 * 24 * 60 * 60 * 1000)
  );

  if (monthsOfHistory < FINANCING_CONFIG.rentAdvance.eligibilityMinMonths) {
    return {
      eligible: false,
      maxAmount: 0,
      reason: `Minimum ${FINANCING_CONFIG.rentAdvance.eligibilityMinMonths} mois d'historique requis`,
    };
  }

  if (totalCollected < FINANCING_CONFIG.rentAdvance.eligibilityMinRentCollected) {
    return {
      eligible: false,
      maxAmount: 0,
      reason: `Minimum ${FINANCING_CONFIG.rentAdvance.eligibilityMinRentCollected}€ de loyers collectés requis`,
    };
  }

  // Calculate average monthly rent
  const avgMonthlyRent = totalCollected / monthsOfHistory;

  // Max advance = 6 months of average rent
  const maxAmount = Math.round(avgMonthlyRent * FINANCING_CONFIG.rentAdvance.maxMonths);

  return {
    eligible: true,
    maxAmount,
  };
}

/**
 * Check tenant eligibility for deposit splitting
 */
export async function checkDepositSplitEligibility(
  tenantId: string,
  depositAmount: number
): Promise<{
  eligible: boolean;
  installmentAmount: number;
  reason?: string;
}> {
  if (depositAmount > FINANCING_CONFIG.depositSplit.maxAmount) {
    return {
      eligible: false,
      installmentAmount: 0,
      reason: `Montant maximum: ${FINANCING_CONFIG.depositSplit.maxAmount}€`,
    };
  }

  const installmentAmount = Math.ceil(
    depositAmount / FINANCING_CONFIG.depositSplit.installments
  );

  return {
    eligible: true,
    installmentAmount,
  };
}

/**
 * Check tenant eligibility for BNPL
 */
export async function checkBNPLEligibility(tenantId: string): Promise<{
  eligible: boolean;
  maxAmount: number;
  reason?: string;
}> {
  const supabase = createServiceRoleClient();

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('id, statut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'succeeded');

  const successfulPayments = payments?.length || 0;

  if (successfulPayments < FINANCING_CONFIG.bnpl.eligibilityMinPayments) {
    return {
      eligible: false,
      maxAmount: 0,
      reason: `Minimum ${FINANCING_CONFIG.bnpl.eligibilityMinPayments} paiements réussis requis`,
    };
  }

  return {
    eligible: true,
    maxAmount: FINANCING_CONFIG.bnpl.maxAmount,
  };
}

// ============================================
// FINANCING OFFERS
// ============================================

/**
 * Create a financing offer for a user
 */
export async function createFinancingOffer(
  userId: string,
  userType: 'owner' | 'tenant',
  offerType: FinancingOffer['offer_type'],
  amountMin: number,
  amountMax: number,
  termMonths: number
): Promise<FinancingOffer> {
  const supabase = createServiceRoleClient();

  // Calculate APR based on offer type
  let apr = 0;
  switch (offerType) {
    case 'rent_advance':
      apr = FINANCING_CONFIG.rentAdvance.apr;
      break;
    case 'work_loan':
      apr = FINANCING_CONFIG.workLoan.apr;
      break;
    case 'deposit_split':
    case 'bnpl':
      apr = 0;
      break;
  }

  // Calculate monthly payment for max amount
  const monthlyPayment = calculateMonthlyPayment(amountMax, apr, termMonths);

  // Offer expires in 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
    .from('financing_offers')
    .insert({
      user_id: userId,
      user_type: userType,
      offer_type: offerType,
      status: 'available',
      amount_min: amountMin,
      amount_max: amountMax,
      apr,
      term_months: termMonths,
      monthly_payment: monthlyPayment,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as FinancingOffer;
}

/**
 * Get available financing offers for a user
 */
export async function getFinancingOffers(
  userId: string
): Promise<FinancingOffer[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('financing_offers')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'available')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as FinancingOffer[];
}

/**
 * Apply for a financing offer
 */
export async function applyForFinancing(
  offerId: string,
  userId: string,
  requestedAmount: number
): Promise<FinancingApplication> {
  const supabase = createServiceRoleClient();

  // Get offer
  const { data: offer } = await supabase
    .from('financing_offers')
    .select('*')
    .eq('id', offerId)
    .eq('user_id', userId)
    .eq('status', 'available')
    .single();

  if (!offer) {
    throw new Error('Offre non trouvée ou expirée');
  }

  if (requestedAmount < offer.amount_min || requestedAmount > offer.amount_max) {
    throw new Error(`Montant doit être entre ${offer.amount_min}€ et ${offer.amount_max}€`);
  }

  // Create application
  const { data: application, error } = await supabase
    .from('financing_applications')
    .insert({
      offer_id: offerId,
      user_id: userId,
      requested_amount: requestedAmount,
      term_months: offer.term_months,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Update offer status
  await supabase
    .from('financing_offers')
    .update({ status: 'applied' })
    .eq('id', offerId);

  // In production, this would trigger underwriting process
  // For now, auto-approve if within limits
  if (requestedAmount <= offer.amount_max) {
    await approveApplication(application.id, requestedAmount);
  }

  // Refresh application
  const { data: updated } = await supabase
    .from('financing_applications')
    .select('*')
    .eq('id', application.id)
    .single();

  return updated as FinancingApplication;
}

/**
 * Approve a financing application
 */
async function approveApplication(
  applicationId: string,
  approvedAmount: number
): Promise<void> {
  const supabase = createServiceRoleClient();

  await supabase
    .from('financing_applications')
    .update({
      status: 'approved',
      approved_amount: approvedAmount,
      decision_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  // Update offer to active
  const { data: app } = await supabase
    .from('financing_applications')
    .select('offer_id')
    .eq('id', applicationId)
    .single();

  if (app) {
    await supabase
      .from('financing_offers')
      .update({ status: 'active' })
      .eq('id', app.offer_id);
  }
}

// ============================================
// INSTANT PAYOUTS
// ============================================

/**
 * Check instant payout eligibility
 */
export async function checkInstantPayoutEligibility(userId: string): Promise<{
  eligible: boolean;
  availableBalance: number;
  fee: number;
  reason?: string;
}> {
  const supabase = createServiceRoleClient();

  // Get pending payouts (payments received but not yet paid out)
  const { data: pendingPayments } = await supabase
    .from('payments')
    .select('montant')
    .eq('owner_id', userId)
    .eq('statut', 'succeeded')
    .eq('payout_status', 'pending');

  const availableBalance = (pendingPayments || []).reduce(
    (sum, p) => sum + (p.montant || 0),
    0
  );

  if (availableBalance < FINANCING_CONFIG.instantPayout.minAmount) {
    return {
      eligible: false,
      availableBalance,
      fee: 0,
      reason: `Solde minimum requis: ${FINANCING_CONFIG.instantPayout.minAmount}€`,
    };
  }

  const fee = Math.round(availableBalance * FINANCING_CONFIG.instantPayout.fee) / 100;

  return {
    eligible: true,
    availableBalance,
    fee,
  };
}

/**
 * Request instant payout
 */
export async function requestInstantPayout(
  userId: string,
  amount: number,
  destination: 'bank_account' | 'debit_card'
): Promise<InstantPayout> {
  const supabase = createServiceRoleClient();

  // Validate eligibility
  const eligibility = await checkInstantPayoutEligibility(userId);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reason || 'Non éligible');
  }

  if (amount > eligibility.availableBalance) {
    throw new Error(`Montant maximum disponible: ${eligibility.availableBalance}€`);
  }

  // Calculate fee
  const fee = Math.round(amount * FINANCING_CONFIG.instantPayout.fee) / 100;
  const netAmount = amount - fee;

  // Get user's Stripe account/payment method
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_account_id')
    .eq('user_id', userId)
    .single();

  // Create payout record
  const { data: payout, error } = await supabase
    .from('instant_payouts')
    .insert({
      user_id: userId,
      amount,
      fee,
      net_amount: netAmount,
      status: 'pending',
      destination,
      arrival_date: new Date().toISOString(), // Instant!
    })
    .select()
    .single();

  if (error) throw error;

  // Process payout via Stripe
  try {
    if (profile?.stripe_account_id) {
      // Connected account payout
      const stripePayout = await stripe.payouts.create(
        {
          amount: Math.round(netAmount * 100), // Convert to cents
          currency: 'eur',
          method: 'instant',
        },
        {
          stripeAccount: profile.stripe_account_id,
        }
      );

      await supabase
        .from('instant_payouts')
        .update({
          status: 'processing',
          stripe_payout_id: stripePayout.id,
        })
        .eq('id', payout.id);
    } else {
      // For non-connected accounts, simulate success
      await supabase
        .from('instant_payouts')
        .update({ status: 'completed' })
        .eq('id', payout.id);
    }
  } catch (stripeError) {
    console.error('[EmbeddedFinance] Stripe payout error:', stripeError);
    await supabase
      .from('instant_payouts')
      .update({ status: 'failed' })
      .eq('id', payout.id);
  }

  // Refresh payout
  const { data: updated } = await supabase
    .from('instant_payouts')
    .select('*')
    .eq('id', payout.id)
    .single();

  return updated as InstantPayout;
}

/**
 * Get payout history
 */
export async function getPayoutHistory(
  userId: string,
  limit: number = 20
): Promise<InstantPayout[]> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('instant_payouts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as InstantPayout[];
}

// ============================================
// DEPOSIT SPLITTING (BNPL FOR DEPOSITS)
// ============================================

/**
 * Create deposit split payment plan
 */
export async function createDepositSplit(
  tenantId: string,
  leaseId: string,
  depositAmount: number
): Promise<{
  success: boolean;
  installments: Array<{ number: number; amount: number; dueDate: string }>;
  error?: string;
}> {
  const eligibility = await checkDepositSplitEligibility(tenantId, depositAmount);

  if (!eligibility.eligible) {
    return {
      success: false,
      installments: [],
      error: eligibility.reason,
    };
  }

  const installments: Array<{ number: number; amount: number; dueDate: string }> = [];
  const today = new Date();

  for (let i = 1; i <= FINANCING_CONFIG.depositSplit.installments; i++) {
    const dueDate = new Date(today);
    dueDate.setMonth(dueDate.getMonth() + i - 1);

    installments.push({
      number: i,
      amount: eligibility.installmentAmount,
      dueDate: dueDate.toISOString().split('T')[0],
    });
  }

  const supabase = createServiceRoleClient();

  // Create financing offer
  await createFinancingOffer(
    tenantId,
    'tenant',
    'deposit_split',
    depositAmount,
    depositAmount,
    FINANCING_CONFIG.depositSplit.installments
  );

  // Create scheduled payments (invoices)
  for (const installment of installments) {
    await supabase.from('invoices').insert({
      lease_id: leaseId,
      tenant_id: tenantId,
      type: 'deposit_installment',
      montant_total: installment.amount,
      statut: 'pending',
      due_date: installment.dueDate,
      description: `Dépôt de garantie - Échéance ${installment.number}/${FINANCING_CONFIG.depositSplit.installments}`,
    });
  }

  return {
    success: true,
    installments,
  };
}

// ============================================
// BNPL FOR RENT
// ============================================

/**
 * Create BNPL payment plan for rent
 */
export async function createRentBNPL(
  tenantId: string,
  invoiceId: string,
  rentAmount: number
): Promise<{
  success: boolean;
  installments: Array<{ number: number; amount: number; dueDate: string }>;
  error?: string;
}> {
  const eligibility = await checkBNPLEligibility(tenantId);

  if (!eligibility.eligible) {
    return {
      success: false,
      installments: [],
      error: eligibility.reason,
    };
  }

  if (rentAmount > eligibility.maxAmount) {
    return {
      success: false,
      installments: [],
      error: `Montant maximum: ${eligibility.maxAmount}€`,
    };
  }

  const installmentAmount = Math.ceil(rentAmount / FINANCING_CONFIG.bnpl.installments);
  const installments: Array<{ number: number; amount: number; dueDate: string }> = [];
  const today = new Date();

  for (let i = 1; i <= FINANCING_CONFIG.bnpl.installments; i++) {
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + (i - 1) * 14); // Every 2 weeks

    installments.push({
      number: i,
      amount: i === FINANCING_CONFIG.bnpl.installments
        ? rentAmount - (installmentAmount * (FINANCING_CONFIG.bnpl.installments - 1)) // Handle rounding
        : installmentAmount,
      dueDate: dueDate.toISOString().split('T')[0],
    });
  }

  const supabase = createServiceRoleClient();

  // Mark original invoice as using BNPL
  await supabase
    .from('invoices')
    .update({
      payment_method: 'bnpl',
      bnpl_installments: FINANCING_CONFIG.bnpl.installments,
    })
    .eq('id', invoiceId);

  return {
    success: true,
    installments,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate monthly payment for a loan
 */
function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (annualRate === 0) {
    return Math.ceil(principal / termMonths);
  }

  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);

  return Math.ceil(payment);
}

/**
 * Get total cost of financing
 */
export function calculateTotalCost(
  principal: number,
  annualRate: number,
  termMonths: number
): {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
} {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const totalPayment = monthlyPayment * termMonths;
  const totalInterest = totalPayment - principal;

  return {
    monthlyPayment,
    totalPayment,
    totalInterest,
  };
}

// ============================================
// AUTO-GENERATE OFFERS
// ============================================

/**
 * Generate financing offers for eligible users
 * Should be run periodically (e.g., weekly)
 */
export async function generateFinancingOffers(): Promise<{
  rentAdvanceOffers: number;
  workLoanOffers: number;
}> {
  const supabase = createServiceRoleClient();
  let rentAdvanceOffers = 0;
  let workLoanOffers = 0;

  // Get all owners
  const { data: owners } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'owner');

  for (const owner of owners || []) {
    // Check rent advance eligibility
    const rentAdvance = await checkRentAdvanceEligibility(owner.user_id);

    if (rentAdvance.eligible) {
      // Check if offer already exists
      const { data: existing } = await supabase
        .from('financing_offers')
        .select('id')
        .eq('user_id', owner.user_id)
        .eq('offer_type', 'rent_advance')
        .eq('status', 'available')
        .single();

      if (!existing) {
        await createFinancingOffer(
          owner.user_id,
          'owner',
          'rent_advance',
          1000, // Min €1,000
          rentAdvance.maxAmount,
          FINANCING_CONFIG.rentAdvance.maxMonths
        );
        rentAdvanceOffers++;
      }
    }

    // Create work loan offer for all owners with properties
    const { count: propertyCount } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', owner.user_id);

    if (propertyCount && propertyCount > 0) {
      const { data: existingLoan } = await supabase
        .from('financing_offers')
        .select('id')
        .eq('user_id', owner.user_id)
        .eq('offer_type', 'work_loan')
        .eq('status', 'available')
        .single();

      if (!existingLoan) {
        await createFinancingOffer(
          owner.user_id,
          'owner',
          'work_loan',
          FINANCING_CONFIG.workLoan.minAmount,
          FINANCING_CONFIG.workLoan.maxAmount,
          24 // Default 24 months
        );
        workLoanOffers++;
      }
    }
  }

  return { rentAdvanceOffers, workLoanOffers };
}
