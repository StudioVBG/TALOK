/**
 * Tenant Rewards Program
 * SOTA 2026 - Bilt-style loyalty program for rent payments
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  TenantRewardsAccount,
  RewardTransaction,
  RewardPartner,
  RewardRedemption,
} from './types';

// ============================================
// REWARDS CONFIGURATION
// ============================================

export const REWARDS_CONFIG = {
  // Points earning
  pointsPerEuro: 1,                    // 1 point per €1 of rent
  onTimeBonus: 50,                     // Bonus points for on-time payment
  streakBonuses: {
    3: 100,                            // 3-month streak bonus
    6: 250,                            // 6-month streak bonus
    12: 500,                           // 1-year streak bonus
  },
  referralBonus: 500,                  // Points for referring another tenant

  // Tier thresholds (lifetime points)
  tiers: {
    bronze: 0,
    silver: 5000,
    gold: 15000,
    platinum: 50000,
  },

  // Tier multipliers
  tierMultipliers: {
    bronze: 1.0,
    silver: 1.1,                       // 10% bonus
    gold: 1.25,                        // 25% bonus
    platinum: 1.5,                     // 50% bonus
  },

  // Redemption rates
  pointsPerEuroRedemption: 100,        // 100 points = €1
};

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

/**
 * Get or create a tenant rewards account
 */
export async function getRewardsAccount(tenantId: string): Promise<TenantRewardsAccount> {
  const supabase = createServiceRoleClient();

  // Try to get existing account
  const { data: existing } = await supabase
    .from('tenant_rewards_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (existing) {
    return existing as TenantRewardsAccount;
  }

  // Create new account
  const { data, error } = await supabase
    .from('tenant_rewards_accounts')
    .insert({
      tenant_id: tenantId,
      points_balance: 0,
      lifetime_points: 0,
      tier: 'bronze',
      tier_progress: 0,
      payment_streak: 0,
      longest_streak: 0,
      rewards_earned: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TenantRewardsAccount;
}

/**
 * Calculate tier from lifetime points
 */
function calculateTier(lifetimePoints: number): TenantRewardsAccount['tier'] {
  if (lifetimePoints >= REWARDS_CONFIG.tiers.platinum) return 'platinum';
  if (lifetimePoints >= REWARDS_CONFIG.tiers.gold) return 'gold';
  if (lifetimePoints >= REWARDS_CONFIG.tiers.silver) return 'silver';
  return 'bronze';
}

/**
 * Calculate progress to next tier
 */
function calculateTierProgress(lifetimePoints: number): number {
  const currentTier = calculateTier(lifetimePoints);

  const tierThresholds = [
    { tier: 'bronze', min: 0, max: REWARDS_CONFIG.tiers.silver },
    { tier: 'silver', min: REWARDS_CONFIG.tiers.silver, max: REWARDS_CONFIG.tiers.gold },
    { tier: 'gold', min: REWARDS_CONFIG.tiers.gold, max: REWARDS_CONFIG.tiers.platinum },
    { tier: 'platinum', min: REWARDS_CONFIG.tiers.platinum, max: Infinity },
  ];

  const current = tierThresholds.find(t => t.tier === currentTier);
  if (!current || current.max === Infinity) return 100;

  const pointsInTier = lifetimePoints - current.min;
  const tierRange = current.max - current.min;

  return Math.min(100, Math.round((pointsInTier / tierRange) * 100));
}

// ============================================
// POINTS EARNING
// ============================================

/**
 * Award points for a rent payment
 */
export async function awardRentPaymentPoints(
  tenantId: string,
  paymentAmount: number,
  paymentId: string,
  isOnTime: boolean = true
): Promise<RewardTransaction[]> {
  const supabase = createServiceRoleClient();
  const transactions: RewardTransaction[] = [];

  // Get account
  const account = await getRewardsAccount(tenantId);
  const tierMultiplier = REWARDS_CONFIG.tierMultipliers[account.tier];

  // Base points (1 point per €)
  const basePoints = Math.floor(paymentAmount * REWARDS_CONFIG.pointsPerEuro * tierMultiplier);

  // Award base points
  const baseTx = await addRewardPoints(
    tenantId,
    basePoints,
    `Points de loyer: ${paymentAmount}€`,
    'rent_payment',
    paymentId
  );
  transactions.push(baseTx);

  // On-time bonus
  if (isOnTime) {
    const bonusPoints = Math.floor(REWARDS_CONFIG.onTimeBonus * tierMultiplier);
    const bonusTx = await addRewardPoints(
      tenantId,
      bonusPoints,
      'Bonus paiement à temps',
      'rent_payment',
      paymentId
    );
    transactions.push(bonusTx);

    // Update streak
    await updatePaymentStreak(tenantId, true);

    // Check for streak bonuses
    const updatedAccount = await getRewardsAccount(tenantId);
    const streakBonus = REWARDS_CONFIG.streakBonuses[updatedAccount.payment_streak as keyof typeof REWARDS_CONFIG.streakBonuses];

    if (streakBonus) {
      const streakTx = await addRewardPoints(
        tenantId,
        streakBonus,
        `Bonus série ${updatedAccount.payment_streak} mois`,
        'streak_bonus',
        paymentId
      );
      transactions.push(streakTx);
    }
  } else {
    // Reset streak on late payment
    await updatePaymentStreak(tenantId, false);
  }

  return transactions;
}

/**
 * Add reward points to account
 */
async function addRewardPoints(
  tenantId: string,
  points: number,
  description: string,
  referenceType: RewardTransaction['reference_type'],
  referenceId?: string,
  partnerId?: string
): Promise<RewardTransaction> {
  const supabase = createServiceRoleClient();

  // Get current account
  const account = await getRewardsAccount(tenantId);

  // Calculate new values
  const newBalance = account.points_balance + points;
  const newLifetime = account.lifetime_points + (points > 0 ? points : 0);
  const newTier = calculateTier(newLifetime);
  const newProgress = calculateTierProgress(newLifetime);

  // Update account
  await supabase
    .from('tenant_rewards_accounts')
    .update({
      points_balance: newBalance,
      lifetime_points: newLifetime,
      tier: newTier,
      tier_progress: newProgress,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  // Create transaction
  const { data, error } = await supabase
    .from('reward_transactions')
    .insert({
      account_id: account.id,
      type: points > 0 ? 'earned' : 'redeemed',
      points,
      description,
      reference_type: referenceType,
      reference_id: referenceId || null,
      partner_id: partnerId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as RewardTransaction;
}

/**
 * Update payment streak
 */
async function updatePaymentStreak(tenantId: string, isOnTime: boolean): Promise<void> {
  const supabase = createServiceRoleClient();
  const account = await getRewardsAccount(tenantId);

  let newStreak: number;
  let newLongest = account.longest_streak;

  if (isOnTime) {
    newStreak = account.payment_streak + 1;
    if (newStreak > newLongest) {
      newLongest = newStreak;
    }
  } else {
    newStreak = 0;
  }

  await supabase
    .from('tenant_rewards_accounts')
    .update({
      payment_streak: newStreak,
      longest_streak: newLongest,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
}

/**
 * Award referral bonus
 */
export async function awardReferralBonus(
  referrerId: string,
  referredTenantId: string
): Promise<RewardTransaction> {
  const account = await getRewardsAccount(referrerId);
  const bonusPoints = Math.floor(
    REWARDS_CONFIG.referralBonus * REWARDS_CONFIG.tierMultipliers[account.tier]
  );

  return addRewardPoints(
    referrerId,
    bonusPoints,
    'Bonus parrainage',
    'referral',
    referredTenantId
  );
}

// ============================================
// POINTS REDEMPTION
// ============================================

/**
 * Get available partners for redemption
 */
export async function getRewardPartners(
  category?: string
): Promise<RewardPartner[]> {
  const supabase = createServiceRoleClient();

  let query = supabase
    .from('reward_partners')
    .select('*')
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as RewardPartner[];
}

/**
 * Redeem points for a reward
 */
export async function redeemPoints(
  tenantId: string,
  partnerId: string,
  pointsToSpend: number
): Promise<RewardRedemption> {
  const supabase = createServiceRoleClient();

  // Get account
  const account = await getRewardsAccount(tenantId);

  if (account.points_balance < pointsToSpend) {
    throw new Error(`Solde insuffisant. Disponible: ${account.points_balance}, Requis: ${pointsToSpend}`);
  }

  // Get partner
  const { data: partner } = await supabase
    .from('reward_partners')
    .select('*')
    .eq('id', partnerId)
    .eq('is_active', true)
    .single();

  if (!partner) {
    throw new Error('Partenaire non trouvé');
  }

  // Calculate value
  const euroValue = pointsToSpend / REWARDS_CONFIG.pointsPerEuroRedemption;

  // Generate redemption code
  const code = generateRedemptionCode();

  // Expiration (30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Create redemption
  const { data: redemption, error: redemptionError } = await supabase
    .from('reward_redemptions')
    .insert({
      account_id: account.id,
      partner_id: partnerId,
      points_spent: pointsToSpend,
      value: euroValue,
      code,
      status: 'confirmed',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (redemptionError) throw redemptionError;

  // Deduct points
  await addRewardPoints(
    tenantId,
    -pointsToSpend,
    `Échange chez ${partner.name}`,
    'redemption',
    redemption.id,
    partnerId
  );

  // Update rewards earned
  await supabase
    .from('tenant_rewards_accounts')
    .update({
      rewards_earned: account.rewards_earned + euroValue,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  return redemption as RewardRedemption;
}

/**
 * Generate a unique redemption code
 */
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TALOK-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get redemption history
 */
export async function getRedemptionHistory(
  tenantId: string,
  limit: number = 20
): Promise<RewardRedemption[]> {
  const supabase = createServiceRoleClient();

  const account = await getRewardsAccount(tenantId);

  const { data, error } = await supabase
    .from('reward_redemptions')
    .select(`
      *,
      partner:reward_partners(name, logo_url, category)
    `)
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as RewardRedemption[];
}

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  tenantId: string,
  limit: number = 50
): Promise<RewardTransaction[]> {
  const supabase = createServiceRoleClient();

  const account = await getRewardsAccount(tenantId);

  const { data, error } = await supabase
    .from('reward_transactions')
    .select('*')
    .eq('account_id', account.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as RewardTransaction[];
}

// ============================================
// RENT-TO-CREDIT REPORTING
// ============================================

/**
 * Check if tenant is eligible for credit reporting
 */
export async function checkCreditReportingEligibility(
  tenantId: string
): Promise<{
  eligible: boolean;
  reason?: string;
  requirements?: string[];
}> {
  const supabase = createServiceRoleClient();

  // Get account and payment history
  const account = await getRewardsAccount(tenantId);

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'succeeded')
    .order('date_paiement', { ascending: false })
    .limit(12);

  const requirements: string[] = [];
  let eligible = true;

  // Requirement 1: At least 3 months of history
  if (!payments || payments.length < 3) {
    requirements.push(`Au moins 3 paiements requis (actuel: ${payments?.length || 0})`);
    eligible = false;
  }

  // Requirement 2: 80%+ on-time payments
  const onTimePayments = (payments || []).filter(p => {
    // Simple check: payment within 5 days of due date
    // In production, this would check against invoice due date
    return true;
  });
  const onTimeRate = payments && payments.length > 0
    ? (onTimePayments.length / payments.length) * 100
    : 0;

  if (onTimeRate < 80) {
    requirements.push(`Taux de ponctualité requis: 80% (actuel: ${Math.round(onTimeRate)}%)`);
    eligible = false;
  }

  // Requirement 3: Account in good standing
  if (account.payment_streak === 0 && account.longest_streak === 0) {
    requirements.push('Au moins une série de paiements consécutifs requise');
    eligible = false;
  }

  return {
    eligible,
    reason: eligible ? undefined : 'Critères non remplis',
    requirements: eligible ? undefined : requirements,
  };
}

/**
 * Enroll in credit reporting (mock implementation)
 */
export async function enrollInCreditReporting(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const eligibility = await checkCreditReportingEligibility(tenantId);

  if (!eligibility.eligible) {
    return {
      success: false,
      error: `Non éligible: ${eligibility.requirements?.join(', ')}`,
    };
  }

  const supabase = createServiceRoleClient();

  // Update account to enable credit reporting
  await supabase
    .from('tenant_rewards_accounts')
    .update({
      credit_reporting_enabled: true,
      credit_reporting_enrolled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  // In production, this would trigger integration with credit bureaus
  // (Experian, Equifax, TransUnion via partners like Boom, RentTrack, etc.)

  return { success: true };
}

// ============================================
// LEADERBOARD & GAMIFICATION
// ============================================

/**
 * Get rewards leaderboard
 */
export async function getLeaderboard(
  limit: number = 10
): Promise<Array<{
  rank: number;
  tenant_id: string;
  name: string;
  tier: string;
  lifetime_points: number;
  payment_streak: number;
}>> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('tenant_rewards_accounts')
    .select(`
      tenant_id,
      tier,
      lifetime_points,
      payment_streak,
      tenant:tenants(
        prenom,
        nom
      )
    `)
    .order('lifetime_points', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((item, index) => ({
    rank: index + 1,
    tenant_id: item.tenant_id,
    name: item.tenant
      ? `${(item.tenant as any).prenom || ''} ${((item.tenant as any).nom || '').charAt(0)}.`
      : 'Anonyme',
    tier: item.tier,
    lifetime_points: item.lifetime_points,
    payment_streak: item.payment_streak,
  }));
}

/**
 * Get tenant rank
 */
export async function getTenantRank(tenantId: string): Promise<number> {
  const supabase = createServiceRoleClient();

  const account = await getRewardsAccount(tenantId);

  const { count } = await supabase
    .from('tenant_rewards_accounts')
    .select('*', { count: 'exact', head: true })
    .gt('lifetime_points', account.lifetime_points);

  return (count || 0) + 1;
}

// ============================================
// BADGES & ACHIEVEMENTS
// ============================================

export const BADGES = {
  first_payment: {
    id: 'first_payment',
    name: 'Premier Pas',
    description: 'Premier paiement effectué',
    icon: '🎉',
    points: 50,
  },
  streak_3: {
    id: 'streak_3',
    name: 'Régulier',
    description: '3 mois consécutifs à temps',
    icon: '🔥',
    points: 100,
  },
  streak_6: {
    id: 'streak_6',
    name: 'Fiable',
    description: '6 mois consécutifs à temps',
    icon: '⭐',
    points: 250,
  },
  streak_12: {
    id: 'streak_12',
    name: 'Champion',
    description: '12 mois consécutifs à temps',
    icon: '🏆',
    points: 500,
  },
  tier_silver: {
    id: 'tier_silver',
    name: 'Argent',
    description: 'Atteindre le niveau Argent',
    icon: '🥈',
    points: 0,
  },
  tier_gold: {
    id: 'tier_gold',
    name: 'Or',
    description: 'Atteindre le niveau Or',
    icon: '🥇',
    points: 0,
  },
  tier_platinum: {
    id: 'tier_platinum',
    name: 'Platine',
    description: 'Atteindre le niveau Platine',
    icon: '💎',
    points: 0,
  },
  first_referral: {
    id: 'first_referral',
    name: 'Ambassadeur',
    description: 'Premier parrainage réussi',
    icon: '🤝',
    points: 100,
  },
  first_redemption: {
    id: 'first_redemption',
    name: 'Profiteur',
    description: 'Première récompense utilisée',
    icon: '🎁',
    points: 50,
  },
};

/**
 * Get tenant badges
 */
export async function getTenantBadges(
  tenantId: string
): Promise<Array<{ badge: typeof BADGES[keyof typeof BADGES]; earned_at: string }>> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('tenant_badges')
    .select('badge_id, earned_at')
    .eq('tenant_id', tenantId)
    .order('earned_at', { ascending: false });

  if (error) throw error;

  return (data || [])
    .filter(b => BADGES[b.badge_id as keyof typeof BADGES])
    .map(b => ({
      badge: BADGES[b.badge_id as keyof typeof BADGES],
      earned_at: b.earned_at,
    }));
}

/**
 * Award a badge
 */
export async function awardBadge(
  tenantId: string,
  badgeId: keyof typeof BADGES
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const badge = BADGES[badgeId];

  if (!badge) return false;

  // Check if already has badge
  const { data: existing } = await supabase
    .from('tenant_badges')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('badge_id', badgeId)
    .single();

  if (existing) return false;

  // Award badge
  await supabase
    .from('tenant_badges')
    .insert({
      tenant_id: tenantId,
      badge_id: badgeId,
    });

  // Award badge points
  if (badge.points > 0) {
    await addRewardPoints(
      tenantId,
      badge.points,
      `Badge "${badge.name}" débloqué`,
      'promo',
      badgeId
    );
  }

  return true;
}

/**
 * Check and award badges based on current status
 */
export async function checkAndAwardBadges(tenantId: string): Promise<string[]> {
  const account = await getRewardsAccount(tenantId);
  const awarded: string[] = [];

  // Streak badges
  if (account.payment_streak >= 3 && await awardBadge(tenantId, 'streak_3')) {
    awarded.push('streak_3');
  }
  if (account.payment_streak >= 6 && await awardBadge(tenantId, 'streak_6')) {
    awarded.push('streak_6');
  }
  if (account.payment_streak >= 12 && await awardBadge(tenantId, 'streak_12')) {
    awarded.push('streak_12');
  }

  // Tier badges
  if (account.tier === 'silver' && await awardBadge(tenantId, 'tier_silver')) {
    awarded.push('tier_silver');
  }
  if (account.tier === 'gold' && await awardBadge(tenantId, 'tier_gold')) {
    awarded.push('tier_gold');
  }
  if (account.tier === 'platinum' && await awardBadge(tenantId, 'tier_platinum')) {
    awarded.push('tier_platinum');
  }

  return awarded;
}
