/**
 * Service de gestion des abonnements
 * Compatible avec le schéma existant (owner_id dans subscriptions)
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { PLANS, type PlanSlug, getUsagePercentage } from './plans';
import { getSignatureUsageByOwner } from './signature-tracking';
import type {
  SubscriptionWithPlan,
  UsageSummary,
  SubscriptionEvent,
  SubscriptionInvoice,
  PromoCode,
  PromoCodeValidation,
  SubscriptionStats,
  PlanDistribution,
  AdminSubscriptionOverview,
} from './types';

// ============================================
// HELPER: Get owner profile ID from user ID
// ============================================

async function getOwnerProfileId(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) return null;
  return data.id;
}

// ============================================
// SUBSCRIPTION QUERIES
// ============================================

/**
 * Récupère l'abonnement d'un utilisateur (via owner_id)
 */
export async function getUserSubscription(userId: string): Promise<SubscriptionWithPlan | null> {
  const supabase = createServiceRoleClient();
  
  // D'abord récupérer le profile_id
  const profileId = await getOwnerProfileId(userId);
  if (!profileId) return null;

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(
        id,
        name,
        slug,
        price_monthly,
        price_yearly,
        max_properties,
        max_leases,
        max_tenants,
        max_documents_gb,
        features
      )
    `)
    .eq('owner_id', profileId)
    .single();

  if (error || !data) return null;

  // Mapper vers notre format
  return {
    ...data,
    plan_slug: data.plan?.slug || 'gratuit',
    user_id: userId,
  } as SubscriptionWithPlan;
}

/**
 * Récupère l'abonnement par profile_id directement
 */
export async function getSubscriptionByProfileId(profileId: string): Promise<SubscriptionWithPlan | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(
        id,
        name,
        slug,
        price_monthly,
        price_yearly,
        max_properties,
        max_leases,
        max_tenants,
        max_documents_gb,
        features
      )
    `)
    .eq('owner_id', profileId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    plan_slug: data.plan?.slug || 'gratuit',
  } as SubscriptionWithPlan;
}

/**
 * Calcule le résumé d'usage pour un utilisateur
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const subscription = await getUserSubscription(userId);

  // Obtenir le slug du plan depuis la BDD ou utiliser gratuit par défaut
  const planSlug = (subscription?.plan?.slug || 'gratuit') as PlanSlug;
  const plan = PLANS[planSlug];

  // L'usage est stocké directement dans subscriptions
  const used = {
    properties: subscription?.properties_count || 0,
    leases: subscription?.leases_count || 0,
    tenants: subscription?.tenants_count || 0,
    storage: subscription?.documents_size_mb || 0,
  };

  // Utiliser les limites de la BDD si disponibles, sinon fallback sur config
  const limits = subscription?.plan ? {
    max_properties: subscription.plan.max_properties,
    max_leases: subscription.plan.max_leases,
    max_tenants: subscription.plan.max_tenants,
    max_documents_gb: subscription.plan.max_documents_gb,
  } : plan.limits;

  // Récupérer le profile_id pour le tracking signatures
  const profileId = await getOwnerProfileId(userId);

  // Récupérer l'usage réel des signatures
  let signatureUsage = {
    used: 0,
    limit: plan.limits.signatures_monthly_quota,
    percentage: 0,
  };

  if (profileId) {
    try {
      const sigUsage = await getSignatureUsageByOwner(profileId);
      signatureUsage = {
        used: sigUsage.signatures_used,
        limit: sigUsage.signatures_limit,
        percentage: sigUsage.usage_percentage,
      };
    } catch (err) {
      console.error('[SubscriptionService] Error fetching signature usage:', err);
    }
  }

  return {
    properties: {
      used: used.properties,
      limit: limits.max_properties,
      percentage: getUsagePercentage(used.properties, limits.max_properties),
    },
    leases: {
      used: used.leases,
      limit: limits.max_leases,
      percentage: getUsagePercentage(used.leases, limits.max_leases),
    },
    users: {
      used: 1, // TODO: compter les vrais utilisateurs via team_members
      limit: plan.limits.max_users,
      percentage: getUsagePercentage(1, plan.limits.max_users),
    },
    signatures: signatureUsage,
    storage: {
      used: Math.round(used.storage),
      limit: limits.max_documents_gb * 1024, // Convertir en MB
      percentage: getUsagePercentage(used.storage, limits.max_documents_gb * 1024),
      unit: 'Mo',
    },
  };
}

// ============================================
// FEATURE & LIMIT CHECKS
// ============================================

/**
 * Vérifie si un utilisateur a accès à une feature
 */
export async function userHasFeature(userId: string, feature: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription || subscription.status !== 'active' && subscription.status !== 'trialing') {
    return false;
  }
  
  // Vérifier dans les features du plan depuis la BDD
  const features = subscription.plan?.features || {};
  const featureValue = features[feature];
  
  // Une feature est activée si elle est true ou a une valeur non nulle/non-"none"
  if (featureValue === true) return true;
  if (typeof featureValue === 'string' && featureValue !== 'none' && featureValue !== 'basic') return true;
  if (typeof featureValue === 'number' && featureValue > 0) return true;
  
  return false;
}

/**
 * Vérifie si un utilisateur est dans sa limite
 */
export async function userWithinLimit(userId: string, resource: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;
  
  const plan = subscription.plan;
  if (!plan) return false;
  
  let limit = -1;
  let used = 0;
  
  switch (resource) {
    case 'properties':
      limit = plan.max_properties;
      used = subscription.properties_count || 0;
      break;
    case 'leases':
      limit = plan.max_leases;
      used = subscription.leases_count || 0;
      break;
    case 'tenants':
      limit = plan.max_tenants;
      used = subscription.tenants_count || 0;
      break;
    default:
      return true;
  }
  
  if (limit === -1) return true; // Illimité
  return used < limit;
}

/**
 * Obtient l'usage restant pour une ressource
 */
export async function getRemainingUsage(userId: string, resource: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  if (!subscription?.plan) return 0;
  
  const plan = subscription.plan;
  let limit = -1;
  let used = 0;
  
  switch (resource) {
    case 'properties':
      limit = plan.max_properties;
      used = subscription.properties_count || 0;
      break;
    case 'leases':
      limit = plan.max_leases;
      used = subscription.leases_count || 0;
      break;
    case 'tenants':
      limit = plan.max_tenants;
      used = subscription.tenants_count || 0;
      break;
    default:
      return 999999;
  }
  
  if (limit === -1) return 999999;
  return Math.max(0, limit - used);
}

// ============================================
// SUBSCRIPTION MUTATIONS
// ============================================

/**
 * Change le plan d'un utilisateur
 */
export async function changePlan(
  userId: string,
  newPlanSlug: PlanSlug,
  options?: {
    billingCycle?: 'monthly' | 'yearly';
    skipStripe?: boolean;
    reason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  
  const profileId = await getOwnerProfileId(userId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }
  
  // Récupérer le plan_id depuis subscription_plans
  const { data: newPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', newPlanSlug)
    .single();
  
  if (planError || !newPlan) {
    return { success: false, error: 'Plan non trouvé' };
  }
  
  // Récupérer l'abonnement actuel
  const current = await getUserSubscription(userId);

  // Mettre à jour l'abonnement
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_id: newPlan.id,
      billing_cycle: options?.billingCycle || current?.billing_cycle || 'monthly',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    console.error('[SubscriptionService] Change plan error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Annule un abonnement
 */
export async function cancelSubscription(
  userId: string,
  options?: {
    immediately?: boolean;
    reason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(userId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  const updateData: Record<string, unknown> = {
    canceled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (options?.immediately) {
    updateData.status = 'canceled';
  } else {
    updateData.cancel_at_period_end = true;
  }

  const { error } = await supabase
    .from('subscriptions')
    .update(updateData)
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Réactive un abonnement annulé
 */
export async function reactivateSubscription(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(userId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      canceled_at: null,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// PROMO CODES
// ============================================

/**
 * Valide un code promo
 */
export async function validatePromoCode(
  code: string,
  planSlug: PlanSlug,
  billingCycle: 'monthly' | 'yearly',
  userId?: string
): Promise<PromoCodeValidation> {
  const supabase = createServiceRoleClient();

  // Récupérer le code
  const { data: promo, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .single();

  if (error || !promo) {
    return { valid: false, code: null, error: 'Code promo invalide' };
  }

  // Vérifications basiques
  const now = new Date();
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { valid: false, code: null, error: 'Code promo expiré' };
  }

  if (promo.max_uses && promo.uses_count >= promo.max_uses) {
    return { valid: false, code: null, error: 'Code promo épuisé' };
  }

  // Calculer la réduction
  const plan = PLANS[planSlug];
  const basePrice = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = Math.round(basePrice * (promo.discount_value / 100));
  } else {
    discountAmount = promo.discount_value;
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    valid: true,
    code: promo as PromoCode,
    discount_amount: discountAmount,
    final_price: finalPrice,
  };
}

// ============================================
// EVENTS & HISTORY
// ============================================

/**
 * Log un événement d'abonnement
 */
export async function logSubscriptionEvent(
  userId: string,
  event: Partial<SubscriptionEvent>
): Promise<void> {
  const supabase = createServiceRoleClient();
  const subscription = await getUserSubscription(userId);

  // Si la table subscription_events existe
  try {
    await supabase.from('subscription_events').insert({
      subscription_id: subscription?.id,
      user_id: userId,
      ...event,
    });
  } catch {
    // Table n'existe peut-être pas
    console.log('[SubscriptionService] subscription_events table not found');
  }
}

/**
 * Récupère l'historique des événements
 */
export async function getSubscriptionEvents(
  userId: string,
  limit = 50
): Promise<SubscriptionEvent[]> {
  const supabase = createServiceRoleClient();

  try {
    const { data, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data as SubscriptionEvent[];
  } catch {
    return [];
  }
}

// ============================================
// INVOICES
// ============================================

/**
 * Récupère les factures d'un utilisateur
 */
export async function getUserInvoices(
  userId: string,
  limit = 12
): Promise<SubscriptionInvoice[]> {
  const supabase = createServiceRoleClient();
  
  const profileId = await getOwnerProfileId(userId);
  if (!profileId) return [];

  try {
    const { data, error } = await supabase
      .from('subscription_invoices')
      .select('*')
      .eq('owner_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data as SubscriptionInvoice[];
  } catch {
    return [];
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

/**
 * Récupère les statistiques globales (admin)
 */
export async function getSubscriptionStats(): Promise<SubscriptionStats | null> {
  const supabase = createServiceRoleClient();

  // Calculer les stats manuellement
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      plan:subscription_plans(slug, price_monthly)
    `);

  if (error || !subs) return null;

  const total_users = subs.length;
  const paying_users = subs.filter(s => s.plan?.slug !== 'starter' && s.status === 'active').length;
  const free_users = subs.filter(s => s.plan?.slug === 'starter').length;
  const trialing_users = subs.filter(s => s.status === 'trialing').length;
  const canceled_users = subs.filter(s => s.status === 'canceled').length;
  
  const mrr = subs
    .filter(s => s.status === 'active' && s.plan?.price_monthly)
    .reduce((sum, s) => sum + (s.plan?.price_monthly || 0), 0);

  return {
    total_users,
    paying_users,
    free_users,
    trialing_users,
    canceled_users,
    mrr,
    arr: mrr * 12,
    arpu: paying_users > 0 ? Math.round(mrr / paying_users) : 0,
  };
}

/**
 * Récupère la distribution par plan (admin)
 */
export async function getPlansDistribution(): Promise<PlanDistribution[]> {
  const supabase = createServiceRoleClient();

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select(`
      plan:subscription_plans(slug, name)
    `);

  if (error || !subs) return [];

  // Grouper par plan
  const counts: Record<string, { name: string; count: number }> = {};
  subs.forEach(s => {
    const slug = s.plan?.slug || 'unknown';
    const name = s.plan?.name || 'Unknown';
    if (!counts[slug]) {
      counts[slug] = { name, count: 0 };
    }
    counts[slug].count++;
  });

  const total = subs.length;
  return Object.entries(counts).map(([slug, data]) => ({
    plan_slug: slug as PlanSlug,
    plan_name: data.name,
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 100 * 10) / 10 : 0,
  }));
}

/**
 * Récupère la liste des abonnements (admin)
 */
export async function getAdminSubscriptionsList(options?: {
  page?: number;
  perPage?: number;
  search?: string;
  planFilter?: PlanSlug[];
  statusFilter?: string[];
}): Promise<{ data: AdminSubscriptionOverview[]; total: number }> {
  const supabase = createServiceRoleClient();
  const page = options?.page || 1;
  const perPage = options?.perPage || 25;
  const offset = (page - 1) * perPage;

  // Requête avec jointures (sans auth.users qui pose problème)
  let query = supabase
    .from('subscriptions')
    .select(`
      id,
      status,
      billing_cycle,
      current_period_start,
      current_period_end,
      trial_end,
      canceled_at,
      cancel_at_period_end,
      properties_count,
      leases_count,
      stripe_customer_id,
      stripe_subscription_id,
      created_at,
      owner:profiles!owner_id(
        id,
        user_id,
        prenom,
        nom,
        role,
        created_at
      ),
      plan:subscription_plans(
        slug,
        name,
        price_monthly,
        max_properties
      )
    `, { count: 'exact' });

  // Filtres
  if (options?.statusFilter && options.statusFilter.length > 0) {
    query = query.in('status', options.statusFilter);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    console.error('[SubscriptionService] Admin list error:', error);
    return { data: [], total: 0 };
  }

  // Récupérer les user_ids pour fetcher les emails
  const userIds = (data || [])
    .map((sub: Record<string, unknown>) => {
      const owner = sub.owner as Record<string, unknown> | null;
      return owner?.user_id as string;
    })
    .filter(Boolean);

  // Récupérer les emails depuis auth.users via requête directe
  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: usersData } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    
    if (usersData?.users) {
      usersData.users.forEach(user => {
        if (user.email) {
          emailMap[user.id] = user.email;
        }
      });
    }
  }

  // Transformer les données
  const transformedData: AdminSubscriptionOverview[] = (data || []).map((sub: Record<string, unknown>) => {
    const owner = sub.owner as Record<string, unknown> | null;
    const plan = sub.plan as Record<string, unknown> | null;
    const userId = (owner?.user_id as string) || '';
    
    return {
      user_id: userId,
      email: emailMap[userId] || '',
      user_created_at: (owner?.created_at as string) || '',
      prenom: (owner?.prenom as string) || null,
      nom: (owner?.nom as string) || null,
      user_role: (owner?.role as string) || 'owner',
      subscription_id: sub.id as string,
      plan_slug: (plan?.slug || 'gratuit') as PlanSlug,
      plan_name: (plan?.name as string) || 'Gratuit',
      price_monthly: (plan?.price_monthly as number) || 0,
      status: sub.status as string,
      billing_cycle: sub.billing_cycle as string,
      current_period_start: sub.current_period_start as string | null,
      current_period_end: sub.current_period_end as string | null,
      trial_end: sub.trial_end as string | null,
      canceled_at: sub.canceled_at as string | null,
      cancel_at_period_end: sub.cancel_at_period_end as boolean,
      stripe_customer_id: sub.stripe_customer_id as string | null,
      stripe_subscription_id: sub.stripe_subscription_id as string | null,
      properties_count: (sub.properties_count as number) || 0,
      leases_count: (sub.leases_count as number) || 0,
      signatures_used_this_month: 0,
      max_properties: (plan?.max_properties as number) || 3,
      max_signatures: 0,
      mrr_contribution: sub.status === 'active' ? ((plan?.price_monthly as number) || 0) : 0,
    };
  });

  // Filtrer par recherche côté client si nécessaire
  let filteredData = transformedData;
  if (options?.search) {
    const search = options.search.toLowerCase();
    filteredData = transformedData.filter(d => 
      d.email?.toLowerCase().includes(search) ||
      d.prenom?.toLowerCase().includes(search) ||
      d.nom?.toLowerCase().includes(search)
    );
  }

  if (options?.planFilter && options.planFilter.length > 0) {
    filteredData = filteredData.filter(d => options.planFilter!.includes(d.plan_slug));
  }

  return {
    data: filteredData,
    total: count || 0,
  };
}

/**
 * Force un changement de plan (admin)
 */
export async function adminOverridePlan(
  adminUserId: string,
  targetUserId: string,
  newPlanSlug: PlanSlug,
  reason: string,
  notifyUser = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  
  const profileId = await getOwnerProfileId(targetUserId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  // Récupérer le plan_id
  const { data: newPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', newPlanSlug)
    .single();

  if (planError || !newPlan) {
    return { success: false, error: 'Plan non trouvé' };
  }

  // Mettre à jour l'abonnement
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_id: newPlan.id,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Logger l'action admin si la table existe
  try {
    await supabase.from('admin_subscription_actions').insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      action_type: 'plan_override',
      to_plan: newPlanSlug,
      reason,
      notify_user: notifyUser,
    });
  } catch {
    // Table n'existe peut-être pas
  }

  return { success: true };
}

/**
 * Offre des jours gratuits (admin)
 */
export async function adminGiftDays(
  adminUserId: string,
  targetUserId: string,
  days: number,
  reason: string,
  notifyUser = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(targetUserId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  // Récupérer l'abonnement
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('current_period_end, trial_end')
    .eq('owner_id', profileId)
    .single();

  if (subError || !sub) {
    return { success: false, error: 'Abonnement non trouvé' };
  }

  // Étendre la période
  const currentEnd = sub.current_period_end 
    ? new Date(sub.current_period_end) 
    : sub.trial_end
    ? new Date(sub.trial_end)
    : new Date();
  currentEnd.setDate(currentEnd.getDate() + days);

  const { error } = await supabase
    .from('subscriptions')
    .update({
      current_period_end: currentEnd.toISOString(),
      trial_end: currentEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Suspend un compte (admin)
 */
export async function adminSuspendAccount(
  adminUserId: string,
  targetUserId: string,
  reason: string,
  notifyUser = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(targetUserId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Réactive un compte suspendu (admin)
 */
export async function adminUnsuspendAccount(
  adminUserId: string,
  targetUserId: string,
  reason: string,
  notifyUser = false
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(targetUserId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('owner_id', profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
