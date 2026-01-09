/**
 * Service de tracking des signatures
 * Gère le comptage et la vérification des quotas de signatures mensuels
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { SIGNATURE_PRICES, SIGNATURE_QUOTAS } from './pricing-config';
import type { PlanSlug } from './plans';

// ============================================
// TYPES
// ============================================

export interface SignatureUsage {
  subscription_id: string | null;
  signatures_used: number;
  signatures_limit: number;
  signatures_remaining: number;
  usage_percentage: number;
  period_month: string;
  last_signature_at: string | null;
  can_sign: boolean;
}

export interface SignatureQuotaCheck {
  canSign: boolean;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  pricePerExtra: number; // Prix en centimes si dépassement
  isUnlimited: boolean;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Obtient l'usage des signatures pour un owner
 */
export async function getSignatureUsageByOwner(ownerId: string): Promise<SignatureUsage> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc('get_signature_usage_by_owner', { p_owner_id: ownerId })
    .single();

  if (error) {
    console.error('[SignatureTracking] Error getting usage:', error);
    // Retourner des valeurs par défaut
    return {
      subscription_id: null,
      signatures_used: 0,
      signatures_limit: 0,
      signatures_remaining: 0,
      usage_percentage: 0,
      period_month: new Date().toISOString().slice(0, 7),
      last_signature_at: null,
      can_sign: false,
    };
  }

  return data as SignatureUsage;
}

/**
 * Obtient l'usage des signatures pour une subscription
 */
export async function getSignatureUsageBySubscription(subscriptionId: string): Promise<SignatureUsage> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .rpc('get_signature_usage', { p_subscription_id: subscriptionId })
    .single();

  if (error) {
    console.error('[SignatureTracking] Error getting usage by subscription:', error);
    return {
      subscription_id: subscriptionId,
      signatures_used: 0,
      signatures_limit: 0,
      signatures_remaining: 0,
      usage_percentage: 0,
      period_month: new Date().toISOString().slice(0, 7),
      last_signature_at: null,
      can_sign: false,
    };
  }

  return {
    subscription_id: subscriptionId,
    ...data,
    can_sign: data.signatures_limit === -1 || data.signatures_used < data.signatures_limit,
  } as SignatureUsage;
}

/**
 * Vérifie si une signature peut être effectuée (incluse dans le quota)
 */
export async function canUseSignature(ownerId: string): Promise<boolean> {
  const usage = await getSignatureUsageByOwner(ownerId);
  return usage.can_sign;
}

/**
 * Vérifie le quota et retourne les détails
 */
export async function checkSignatureQuota(ownerId: string, planSlug?: PlanSlug): Promise<SignatureQuotaCheck> {
  const usage = await getSignatureUsageByOwner(ownerId);

  // Déterminer le plan pour le prix des signatures extra
  const effectivePlan = planSlug || 'gratuit';
  const priceKey = effectivePlan as keyof typeof SIGNATURE_PRICES;
  const pricePerExtra = SIGNATURE_PRICES[priceKey] || SIGNATURE_PRICES.gratuit;

  return {
    canSign: usage.can_sign,
    used: usage.signatures_used,
    limit: usage.signatures_limit,
    remaining: usage.signatures_remaining,
    percentage: usage.usage_percentage,
    pricePerExtra,
    isUnlimited: usage.signatures_limit === -1,
  };
}

/**
 * Incrémente l'usage des signatures (après une signature réussie)
 */
export async function incrementSignatureUsage(
  ownerId: string,
  quantity: number = 1,
  metadata?: {
    document_type?: string;
    document_id?: string;
    signers_count?: number;
  }
): Promise<{ success: boolean; error?: string; wasInQuota: boolean }> {
  const supabase = createServiceRoleClient();

  // D'abord, récupérer la subscription_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', ownerId)
    .single();

  if (!profile) {
    return { success: false, error: 'Profil non trouvé', wasInQuota: false };
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('owner_id', profile.id)
    .single();

  if (!subscription) {
    return { success: false, error: 'Abonnement non trouvé', wasInQuota: false };
  }

  // Vérifier si c'était dans le quota avant d'incrémenter
  const usageBefore = await getSignatureUsageBySubscription(subscription.id);
  const wasInQuota = usageBefore.can_sign;

  // Incrémenter via la fonction SQL
  const { data, error } = await supabase
    .rpc('increment_signature_usage', {
      p_subscription_id: subscription.id,
      p_quantity: quantity,
      p_metadata: metadata || {},
    });

  if (error) {
    console.error('[SignatureTracking] Error incrementing usage:', error);
    return { success: false, error: error.message, wasInQuota };
  }

  return { success: data === true, wasInQuota, error: data === false ? 'Quota dépassé' : undefined };
}

/**
 * Enregistre une signature manuellement (sans vérification de quota)
 * À utiliser pour les signatures payantes hors quota
 */
export async function recordSignatureUsage(
  subscriptionId: string,
  quantity: number = 1,
  metadata?: Record<string, unknown>
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { error } = await supabase
    .from('subscription_usage')
    .insert({
      subscription_id: subscriptionId,
      usage_type: 'signature',
      quantity,
      period_month: currentMonth,
      metadata: metadata || {},
    });

  if (error) {
    console.error('[SignatureTracking] Error recording usage:', error);
    return false;
  }

  return true;
}

/**
 * Obtient l'historique des signatures sur plusieurs mois
 */
export async function getSignatureHistory(
  ownerId: string,
  months: number = 6
): Promise<Array<{ month: string; count: number }>> {
  const supabase = createServiceRoleClient();

  // Récupérer la subscription_id
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('owner_id', ownerId)
    .single();

  if (!subscription) {
    return [];
  }

  // Générer les N derniers mois
  const monthsList: string[] = [];
  const now = new Date();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthsList.push(d.toISOString().slice(0, 7));
  }

  // Récupérer l'usage
  const { data, error } = await supabase
    .from('subscription_usage')
    .select('period_month, quantity')
    .eq('subscription_id', subscription.id)
    .eq('usage_type', 'signature')
    .in('period_month', monthsList);

  if (error) {
    console.error('[SignatureTracking] Error getting history:', error);
    return monthsList.map(month => ({ month, count: 0 }));
  }

  // Agréger par mois
  const usageByMonth = (data || []).reduce((acc, item) => {
    acc[item.period_month] = (acc[item.period_month] || 0) + item.quantity;
    return acc;
  }, {} as Record<string, number>);

  return monthsList.map(month => ({
    month,
    count: usageByMonth[month] || 0,
  }));
}

/**
 * Calcule le coût des signatures hors quota
 */
export function calculateExtraSignatureCost(
  signaturesNeeded: number,
  signaturesRemaining: number,
  planSlug: PlanSlug
): { inQuota: number; extra: number; cost: number } {
  const inQuota = Math.min(signaturesNeeded, Math.max(0, signaturesRemaining));
  const extra = Math.max(0, signaturesNeeded - inQuota);

  const priceKey = planSlug as keyof typeof SIGNATURE_PRICES;
  const pricePerSignature = SIGNATURE_PRICES[priceKey] || SIGNATURE_PRICES.gratuit;

  return {
    inQuota,
    extra,
    cost: extra * pricePerSignature, // En centimes
  };
}

/**
 * Obtient les quotas de signatures pour un plan donné
 */
export function getSignatureQuotaForPlan(planSlug: PlanSlug): {
  monthlyQuota: number;
  pricePerSignature: number;
  isUnlimited: boolean;
} {
  const quotaKey = planSlug as keyof typeof SIGNATURE_QUOTAS;
  const priceKey = planSlug as keyof typeof SIGNATURE_PRICES;

  const monthlyQuota = SIGNATURE_QUOTAS[quotaKey] ?? 0;
  const pricePerSignature = SIGNATURE_PRICES[priceKey] ?? SIGNATURE_PRICES.gratuit;

  return {
    monthlyQuota,
    pricePerSignature,
    isUnlimited: monthlyQuota === -1,
  };
}

// Export default
export default {
  getSignatureUsageByOwner,
  getSignatureUsageBySubscription,
  canUseSignature,
  checkSignatureQuota,
  incrementSignatureUsage,
  recordSignatureUsage,
  getSignatureHistory,
  calculateExtraSignatureCost,
  getSignatureQuotaForPlan,
};
