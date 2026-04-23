/**
 * Service de gestion des abonnements
 * Compatible avec le schéma existant (owner_id dans subscriptions)
 */

import { createServiceRoleClient } from '@/lib/supabase/server';
import { PLANS, type PlanSlug, getUsagePercentage } from './plans';
import { getSignatureUsageByOwner } from './signature-tracking';
import { stripe } from '@/lib/stripe';
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
      plan:subscription_plans!plan_id(
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
  } as unknown as SubscriptionWithPlan;
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
      plan:subscription_plans!plan_id(
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
  } as unknown as SubscriptionWithPlan;
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
    users: await (async () => {
      // Compter les vrais utilisateurs via team_members
      let userCount = 1; // Le propriétaire compte toujours comme 1
      if (profileId) {
        try {
          const { createClient } = await import("@/lib/supabase/server");
          const supabase = await createClient();
          const { count } = await supabase
            .from("team_members")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", profileId)
            .eq("status", "active");
          userCount = 1 + (count || 0); // propriétaire + membres actifs
        } catch {
          // Fallback silencieux à 1 si la requête échoue
        }
      }
      return {
        used: userCount,
        limit: plan.limits.max_users,
        percentage: getUsagePercentage(userCount, plan.limits.max_users),
      };
    })(),
    tenants: {
      used: used.tenants,
      limit: limits.max_tenants,
      percentage: getUsagePercentage(used.tenants, limits.max_tenants),
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
  if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
    return false;
  }
  
  // Vérifier dans les features du plan depuis la BDD
  const features = subscription.plan?.features || {};
  const featureValue = features[feature];
  
  // Une feature est activée si elle est true ou a une valeur non nulle/non-"none"
  // Note: 'basic' IS considered enabled (it's a limited but active tier)
  if (featureValue === true) return true;
  if (typeof featureValue === 'string' && featureValue !== 'none') return true;
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

  const { data: currentSubscription } = await supabase
    .from('subscriptions')
    .select('id, stripe_subscription_id')
    .eq('owner_id', profileId)
    .maybeSingle();

  if (currentSubscription?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(currentSubscription.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
    } catch (stripeError) {
      return {
        success: false,
        error: stripeError instanceof Error ? stripeError.message : 'Impossible de reactiver Stripe',
      };
    }
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      canceled_at: null,
      cancel_at_period_end: false,
      scheduled_plan_id: null,
      scheduled_plan_slug: null,
      scheduled_plan_effective_at: null,
      updated_at: new Date().toISOString(),
    } as any)
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
  if (promo.valid_until && new Date(promo.valid_until as string) < now) {
    return { valid: false, code: null, error: 'Code promo expiré' };
  }

  if (promo.max_uses && (promo.uses_count as number) >= (promo.max_uses as number)) {
    return { valid: false, code: null, error: 'Code promo épuisé' };
  }

  // Calculer la réduction
  const plan = PLANS[planSlug];
  const basePrice = (billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly) ?? 0;

  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = Math.round(basePrice * ((promo.discount_value as number) / 100));
  } else {
    discountAmount = promo.discount_value as number;
  }

  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    valid: true,
    code: promo as unknown as PromoCode,
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
    console.error('[SubscriptionService] subscription_events table not found');
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
    return data as unknown as SubscriptionEvent[];
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
    return data as unknown as SubscriptionInvoice[];
  } catch {
    return [];
  }
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

// Rôles qui comptent comme "comptes clients payants possibles".
const BILLABLE_ROLES = ['owner', 'agency', 'syndic'] as const;

/**
 * Récupère les statistiques globales (admin)
 *
 * Compte TOUS les profils payants (owner/agency/syndic) même s'ils n'ont pas
 * encore de ligne `subscriptions` — ils sont considérés "gratuit".
 */
export async function getSubscriptionStats(): Promise<SubscriptionStats | null> {
  const supabase = createServiceRoleClient();

  // 1. Profils payants (base de l'univers)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', BILLABLE_ROLES as unknown as string[]);

  if (profilesError) {
    console.error('[SubscriptionService] Stats profiles error:', profilesError);
    throw new Error(`Impossible de charger les profils: ${profilesError.message}`);
  }

  const profileIds = (profiles || []).map((p) => p.id);
  const total_users = profileIds.length;

  if (total_users === 0) {
    return {
      total_users: 0,
      paying_users: 0,
      free_users: 0,
      trialing_users: 0,
      canceled_users: 0,
      mrr: 0,
      arr: 0,
      arpu: 0,
    };
  }

  // 2. Abonnements existants pour ces profils
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select(`
      owner_id,
      status,
      plan:subscription_plans!plan_id(slug, price_monthly)
    `)
    .in('owner_id', profileIds);

  if (error) {
    console.error('[SubscriptionService] Stats subs error:', error);
    throw new Error(`Impossible de charger les abonnements: ${error.message}`);
  }

  const entitled = (st: string) => ['active', 'trialing', 'past_due'].includes(st);
  const subsList = subs || [];
  const ownersWithSub = new Set(subsList.map((s) => s.owner_id as string));
  const implicit_free_users = total_users - ownersWithSub.size;

  const paying_users = subsList.filter(
    (s) => s.plan?.slug !== 'gratuit' && entitled(s.status)
  ).length;
  const free_users =
    implicit_free_users + subsList.filter((s) => s.plan?.slug === 'gratuit').length;
  const trialing_users = subsList.filter((s) => s.status === 'trialing').length;
  const canceled_users = subsList.filter((s) => s.status === 'canceled').length;

  const mrr = subsList
    .filter((s) => entitled(s.status) && s.plan?.price_monthly)
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
 *
 * Les profils sans `subscriptions` sont classés "gratuit".
 */
export async function getPlansDistribution(): Promise<PlanDistribution[]> {
  const supabase = createServiceRoleClient();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .in('role', BILLABLE_ROLES as unknown as string[]);

  if (profilesError) {
    console.error('[SubscriptionService] Distribution profiles error:', profilesError);
    throw new Error(`Impossible de charger les profils: ${profilesError.message}`);
  }

  const profileIds = (profiles || []).map((p) => p.id);
  if (profileIds.length === 0) return [];

  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select(`
      owner_id,
      plan:subscription_plans!plan_id(slug, name)
    `)
    .in('owner_id', profileIds);

  if (error) {
    console.error('[SubscriptionService] Distribution subs error:', error);
    throw new Error(`Impossible de charger les abonnements: ${error.message}`);
  }

  const counts: Record<string, { name: string; count: number }> = {};
  const subsList = subs || [];
  const ownersWithSub = new Set<string>();

  subsList.forEach((s) => {
    ownersWithSub.add(s.owner_id as string);
    const slug = s.plan?.slug || 'gratuit';
    const name = s.plan?.name || 'Gratuit';
    if (!counts[slug]) counts[slug] = { name, count: 0 };
    counts[slug].count++;
  });

  // Profils sans abonnement = gratuit implicite
  const implicitFree = profileIds.length - ownersWithSub.size;
  if (implicitFree > 0) {
    if (!counts.gratuit) counts.gratuit = { name: 'Gratuit', count: 0 };
    counts.gratuit.count += implicitFree;
  }

  const total = profileIds.length;
  return Object.entries(counts).map(([slug, data]) => ({
    plan_slug: slug as PlanSlug,
    plan_name: data.name,
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 100 * 10) / 10 : 0,
  }));
}

/**
 * Récupère la liste des abonnements (admin)
 *
 * Part de `profiles` (rôles billables) pour que TOUS les comptes apparaissent,
 * même ceux qui n'ont jamais souscrit (affichés comme "Gratuit").
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

  // 1. Tous les profils billables
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, user_id, prenom, nom, role, created_at')
    .in('role', BILLABLE_ROLES as unknown as string[])
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('[SubscriptionService] Admin list profiles error:', profilesError);
    throw new Error(`Impossible de charger les profils: ${profilesError.message}`);
  }

  const profilesList = profiles || [];
  if (profilesList.length === 0) {
    return { data: [], total: 0 };
  }

  const profileIds = profilesList.map((p) => p.id as string);

  // 2. Abonnements de ces profils (LEFT JOIN manuel)
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select(`
      id,
      owner_id,
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
      plan:subscription_plans!plan_id(
        slug,
        name,
        price_monthly,
        max_properties
      )
    `)
    .in('owner_id', profileIds);

  if (subsError) {
    console.error('[SubscriptionService] Admin list subs error:', subsError);
    throw new Error(`Impossible de charger les abonnements: ${subsError.message}`);
  }

  const subByOwner = new Map<string, Record<string, unknown>>();
  (subs || []).forEach((s: Record<string, unknown>) => {
    subByOwner.set(s.owner_id as string, s);
  });

  // 3. Emails depuis auth.users (paginé pour dépasser la limite de 1000)
  const userIds = profilesList
    .map((p) => p.user_id as string | null)
    .filter((id): id is string => Boolean(id));
  const emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const neededIds = new Set(userIds);
    let authPage = 1;
    const authPerPage = 1000;
    // Pagine jusqu'à avoir couvert tous les IDs ou épuisé la source.
    // Limite de sécurité: 20 pages (20 000 users) pour éviter une boucle infinie.
    while (neededIds.size > 0 && authPage <= 20) {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        page: authPage,
        perPage: authPerPage,
      });
      if (authError) {
        console.error('[SubscriptionService] auth.listUsers error:', authError);
        break;
      }
      const users = authData?.users || [];
      if (users.length === 0) break;
      users.forEach((u) => {
        if (u.email && neededIds.has(u.id)) {
          emailMap[u.id] = u.email;
          neededIds.delete(u.id);
        }
      });
      if (users.length < authPerPage) break;
      authPage++;
    }
  }

  // 4. Construire les lignes (1 par profil, avec fallback "gratuit")
  const allRows: AdminSubscriptionOverview[] = profilesList.map((profile) => {
    const profileId = profile.id as string;
    const userId = (profile.user_id as string) || '';
    const sub = subByOwner.get(profileId) || null;
    const plan = (sub?.plan as Record<string, unknown> | null) || null;

    const planSlug = ((plan?.slug as string) || 'gratuit') as PlanSlug;
    const planName = (plan?.name as string) || 'Gratuit';
    const priceMonthly = (plan?.price_monthly as number) ?? 0;
    const status = (sub?.status as string) || (sub ? 'active' : 'free');
    const entitled = ['active', 'trialing', 'past_due'].includes(status);

    return {
      user_id: userId,
      email: emailMap[userId] || '',
      user_created_at: (profile.created_at as string) || '',
      prenom: (profile.prenom as string) || null,
      nom: (profile.nom as string) || null,
      user_role: (profile.role as string) || 'owner',
      subscription_id: (sub?.id as string) || null,
      plan_slug: planSlug,
      plan_name: planName,
      price_monthly: priceMonthly,
      status,
      billing_cycle: (sub?.billing_cycle as string) || 'monthly',
      current_period_start: (sub?.current_period_start as string) || null,
      current_period_end: (sub?.current_period_end as string) || null,
      trial_end: (sub?.trial_end as string) || null,
      canceled_at: (sub?.canceled_at as string) || null,
      cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
      stripe_customer_id: (sub?.stripe_customer_id as string) || null,
      stripe_subscription_id: (sub?.stripe_subscription_id as string) || null,
      properties_count: (sub?.properties_count as number) || 0,
      leases_count: (sub?.leases_count as number) || 0,
      signatures_used_this_month: 0,
      max_properties: (plan?.max_properties as number) || 3,
      max_signatures: 0,
      mrr_contribution: entitled ? priceMonthly : 0,
    };
  });

  // 5. Filtres (search, plan, status)
  let filteredData = allRows;
  if (options?.search) {
    const search = options.search.toLowerCase();
    filteredData = filteredData.filter(
      (d) =>
        d.email?.toLowerCase().includes(search) ||
        d.prenom?.toLowerCase().includes(search) ||
        d.nom?.toLowerCase().includes(search)
    );
  }
  if (options?.planFilter && options.planFilter.length > 0) {
    filteredData = filteredData.filter((d) => options.planFilter!.includes(d.plan_slug));
  }
  if (options?.statusFilter && options.statusFilter.length > 0) {
    filteredData = filteredData.filter((d) => options.statusFilter!.includes(d.status));
  }

  const total = filteredData.length;
  const offset = (page - 1) * perPage;
  const paged = filteredData.slice(offset, offset + perPage);

  return { data: paged, total };
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
    .select('id, slug')
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
      plan_slug: newPlan.slug,
      status: 'active',
      selected_plan_at: new Date().toISOString(),
      selected_plan_source: 'admin_override',
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
 * Si planSlug est fourni, change aussi le plan et passe en trialing.
 * Sinon, prolonge le trial sur le plan actuel.
 */
export async function adminGiftDays(
  adminUserId: string,
  targetUserId: string,
  days: number,
  reason: string,
  notifyUser = false,
  planSlug?: PlanSlug
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleClient();

  const profileId = await getOwnerProfileId(targetUserId);
  if (!profileId) {
    return { success: false, error: 'Profil non trouvé' };
  }

  // Récupérer l'abonnement existant (peut ne pas exister)
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .select('id, status, current_period_end, trial_end, trial_start')
    .eq('owner_id', profileId)
    .maybeSingle();

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + days);

  // Résoudre le plan_id si un planSlug est fourni
  let resolvedPlanId: string | null = null;
  if (planSlug) {
    const { data: planRow, error: planError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('slug', planSlug)
      .single();

    if (planError || !planRow) {
      return { success: false, error: `Plan "${planSlug}" non trouvé` };
    }
    resolvedPlanId = planRow.id;
  }

  const updateData: Record<string, unknown> = {
    status: 'trialing',
    trial_end: trialEnd.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: trialEnd.toISOString(),
    updated_at: now.toISOString(),
  };

  // Set trial_start seulement si pas déjà en trial
  if (!sub || sub.status !== 'trialing') {
    updateData.trial_start = now.toISOString();
  }

  // Changer le plan si demandé
  if (planSlug) {
    updateData.plan_slug = planSlug;
  }
  if (resolvedPlanId) {
    updateData.plan_id = resolvedPlanId;
  }

  // Ajouter metadata de traçabilité
  updateData.metadata = {
    granted_by: adminUserId,
    granted_at: now.toISOString(),
    grant_reason: reason,
    grant_days: days,
    ...(planSlug ? { grant_plan: planSlug } : {}),
  };

  if (sub) {
    // Mettre à jour l'abonnement existant
    const { error } = await supabase
      .from('subscriptions')
      .update(updateData)
      .eq('owner_id', profileId);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    // Créer un nouvel abonnement en trial
    const { error } = await supabase
      .from('subscriptions')
      .insert({
        owner_id: profileId,
        ...updateData,
      });

    if (error) {
      return { success: false, error: error.message };
    }
  }

  try {
    await supabase.from('admin_subscription_actions').insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      action_type: 'gift_days',
      reason,
      notify_user: notifyUser,
      action_metadata: { days, ...(planSlug ? { plan: planSlug } : {}) },
    });
  } catch {
    // Table optionnelle
  }

  if (notifyUser) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, prenom, nom, user_id')
        .eq('id', profileId)
        .single();

      let recipientEmail = profile?.email ?? null;
      if (!recipientEmail && profile?.user_id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
        recipientEmail = authUser?.user?.email ?? null;
      }

      if (recipientEmail) {
        const recipientName = [profile?.prenom, profile?.nom]
          .filter(Boolean)
          .join(' ')
          .trim() || 'Bonjour';

        const planName = planSlug ? PLANS[planSlug]?.name : undefined;
        const trialEndDate = trialEnd.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://talok.fr';

        const { emailTemplates } = await import('@/lib/emails/templates');
        const { sendEmail } = await import('@/lib/services/email-service');

        const template = emailTemplates.giftDaysNotification({
          recipientName,
          days,
          planName,
          reason,
          trialEndDate,
          dashboardUrl: `${appUrl}/owner/dashboard`,
        });

        const emailResult = await sendEmail({
          to: recipientEmail,
          subject: template.subject,
          html: template.html,
          tags: [{ name: 'type', value: 'gift_days' }],
        });

        if (!emailResult.success) {
          console.error('[adminGiftDays] Email notification failed:', emailResult.error);
        }
      } else {
        console.warn('[adminGiftDays] No email found for target user', targetUserId);
      }
    } catch (emailError) {
      console.error('[adminGiftDays] Email notification error:', emailError);
      try {
        const Sentry = await import('@sentry/nextjs');
        Sentry.captureException(emailError, { tags: { route: 'admin.subscriptions.gift.email' } });
      } catch {}
    }
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

  await supabase
    .from('profiles')
    .update({
      account_status: 'suspended',
      suspended_at: new Date().toISOString(),
      suspended_reason: reason,
    } as any)
    .eq('id', profileId);

  try {
    await supabase.auth.admin.updateUserById(targetUserId, {
      ban_duration: '876000h',
    });
  } catch {
    // Best effort
  }

  try {
    await supabase.from('admin_subscription_actions').insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      action_type: 'suspend',
      reason,
      notify_user: notifyUser,
    });
  } catch {
    // Table optionnelle
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

  await supabase
    .from('profiles')
    .update({
      account_status: 'active',
      suspended_at: null,
      suspended_reason: null,
    } as any)
    .eq('id', profileId);

  try {
    await supabase.auth.admin.updateUserById(targetUserId, {
      ban_duration: 'none',
    });
  } catch {
    // Best effort
  }

  try {
    await supabase.from('admin_subscription_actions').insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      action_type: 'unsuspend',
      reason,
      notify_user: notifyUser,
    });
  } catch {
    // Table optionnelle
  }

  return { success: true };
}
