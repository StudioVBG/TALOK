"use client";

/**
 * SubscriptionProvider - Context React pour la gestion des abonnements
 * Fournit l'état de l'abonnement, l'usage et les helpers à toute l'application
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS, type PlanSlug, type FeatureKey, getUsagePercentage } from "@/lib/subscriptions/plans";
import type { SubscriptionWithPlan, UsageSummary } from "@/lib/subscriptions/types";

// ============================================
// TYPES
// ============================================

interface SubscriptionContextValue {
  // État
  subscription: SubscriptionWithPlan | null;
  currentPlan: PlanSlug;
  usage: UsageSummary | null;
  loading: boolean;
  error: string | null;

  // Helpers
  hasFeature: (feature: FeatureKey) => boolean;
  canUseMore: (resource: "properties" | "leases" | "users" | "signatures") => boolean;
  getRemainingUsage: (resource: "properties" | "leases" | "users" | "signatures") => number;
  getUsagePercent: (resource: "properties" | "leases" | "users" | "signatures") => number;
  isOverLimit: (resource: "properties" | "leases" | "users" | "signatures") => boolean;

  // Status helpers
  isActive: boolean;
  isTrialing: boolean;
  isCanceled: boolean;
  isPastDue: boolean;
  isSuspended: boolean;
  trialDaysRemaining: number | null;
  daysUntilRenewal: number | null;

  // Actions
  refresh: () => Promise<void>;
}

// ============================================
// CONTEXT
// ============================================

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface SubscriptionProviderProps {
  children: React.ReactNode;
  initialSubscription?: SubscriptionWithPlan | null;
  initialUsage?: UsageSummary | null;
}

export function SubscriptionProvider({
  children,
  initialSubscription = null,
  initialUsage = null,
}: SubscriptionProviderProps) {
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(initialSubscription);
  const [usage, setUsage] = useState<UsageSummary | null>(initialUsage);
  const [loading, setLoading] = useState(!initialSubscription);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Current plan slug - gratuit par défaut pour les nouveaux utilisateurs
  const currentPlan = useMemo<PlanSlug>(
    () => (subscription?.plan_slug as PlanSlug) || "gratuit",
    [subscription]
  );

  // Plan config
  const planConfig = useMemo(() => PLANS[currentPlan], [currentPlan]);

  // ============================================
  // FETCH DATA
  // ============================================

  const fetchSubscription = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setUsage(null);
        setLoading(false);
        return;
      }

      // Récupérer le profile_id d'abord
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        // Pas de profil = pas d'abonnement
        setSubscription(null);
        setUsage(null);
        setLoading(false);
        return;
      }

      // Fetch subscription via owner_id (schéma existant)
      const { data: sub, error: subError } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("owner_id", profile.id)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        console.error("[SubscriptionProvider] Error fetching subscription:", subError);
      }

      // Si subscription existe, récupérer le plan séparément
      let subscriptionWithPlan: SubscriptionWithPlan | null = null;
      if (sub) {
        let plan = null;
        
        // Utiliser plan_slug si disponible, sinon fallback sur plan_id
        if (sub.plan_slug) {
          const { data } = await supabase
            .from("subscription_plans")
            .select("name, price_monthly, price_yearly, max_properties, max_leases, max_tenants, max_documents_gb, features, slug")
            .eq("slug", sub.plan_slug)
            .maybeSingle();
          // Transformer en format attendu avec limits
          plan = data ? {
            ...data,
            limits: {
              max_properties: data.max_properties,
              max_leases: data.max_leases,
              max_tenants: data.max_tenants,
              max_documents_gb: data.max_documents_gb,
            }
          } : null;
        } else if (sub.plan_id) {
          const { data } = await supabase
            .from("subscription_plans")
            .select("name, price_monthly, price_yearly, max_properties, max_leases, max_tenants, max_documents_gb, features, slug")
            .eq("id", sub.plan_id)
            .maybeSingle();
          // Transformer en format attendu avec limits
          plan = data ? {
            ...data,
            limits: {
              max_properties: data.max_properties,
              max_leases: data.max_leases,
              max_tenants: data.max_tenants,
              max_documents_gb: data.max_documents_gb,
            }
          } : null;
        }

        subscriptionWithPlan = {
          ...sub,
          plan_slug: sub.plan_slug || plan?.slug || "gratuit",
          plan: plan || null,
        } as SubscriptionWithPlan;
      }

      setSubscription(subscriptionWithPlan);

      // Fetch usage from API
      const usageRes = await fetch("/api/subscriptions/usage");
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData.usage);
      }
    } catch (err) {
      console.error("[SubscriptionProvider] Error:", err);
      setError("Erreur lors du chargement de l'abonnement");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    if (!initialSubscription) {
      fetchSubscription();
    }
  }, [fetchSubscription, initialSubscription]);

  // Listen for auth changes
  useEffect(() => {
    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchSubscription();
      }
      if (event === "SIGNED_OUT") {
        setSubscription(null);
        setUsage(null);
      }
    });

    return () => authSub.unsubscribe();
  }, [supabase, fetchSubscription]);

  // ============================================
  // FEATURE CHECKS
  // ============================================

  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      // Check subscription status first
      if (subscription?.status && !["active", "trialing"].includes(subscription.status)) {
        return false;
      }
      return planConfig.features[feature] === true;
    },
    [subscription, planConfig]
  );

  // ============================================
  // USAGE CHECKS
  // ============================================

  const getLimitForResource = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): number => {
      const limitKey = resource === "signatures" ? "max_signatures_monthly" : `max_${resource}`;
      return (planConfig.limits as Record<string, number>)[limitKey] ?? 0;
    },
    [planConfig]
  );

  const getUsedForResource = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): number => {
      if (!usage) return 0;
      return usage[resource]?.used ?? 0;
    },
    [usage]
  );

  const canUseMore = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): boolean => {
      const limit = getLimitForResource(resource);
      if (limit === -1) return true; // Unlimited
      const used = getUsedForResource(resource);
      return used < limit;
    },
    [getLimitForResource, getUsedForResource]
  );

  const getRemainingUsage = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): number => {
      const limit = getLimitForResource(resource);
      if (limit === -1) return Infinity;
      const used = getUsedForResource(resource);
      return Math.max(0, limit - used);
    },
    [getLimitForResource, getUsedForResource]
  );

  const getUsagePercent = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): number => {
      const limit = getLimitForResource(resource);
      const used = getUsedForResource(resource);
      return getUsagePercentage(used, limit);
    },
    [getLimitForResource, getUsedForResource]
  );

  const isOverLimit = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures"): boolean => {
      const limit = getLimitForResource(resource);
      if (limit === -1) return false;
      const used = getUsedForResource(resource);
      return used >= limit;
    },
    [getLimitForResource, getUsedForResource]
  );

  // ============================================
  // STATUS HELPERS
  // ============================================

  const isActive = useMemo(
    () => subscription?.status === "active" || subscription?.status === "trialing",
    [subscription]
  );

  const isTrialing = useMemo(
    () => subscription?.status === "trialing",
    [subscription]
  );

  const isCanceled = useMemo(
    () => subscription?.status === "canceled" || subscription?.cancel_at_period_end === true,
    [subscription]
  );

  const isPastDue = useMemo(
    () => subscription?.status === "past_due",
    [subscription]
  );

  const isSuspended = useMemo(
    () => subscription?.status === "suspended",
    [subscription]
  );

  const trialDaysRemaining = useMemo(() => {
    if (!subscription?.trial_end) return null;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }, [subscription]);

  const daysUntilRenewal = useMemo(() => {
    if (!subscription?.current_period_end) return null;
    const periodEnd = new Date(subscription.current_period_end);
    const now = new Date();
    const diff = periodEnd.getTime() - now.getTime();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
  }, [subscription]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      currentPlan,
      usage,
      loading,
      error,
      hasFeature,
      canUseMore,
      getRemainingUsage,
      getUsagePercent,
      isOverLimit,
      isActive,
      isTrialing,
      isCanceled,
      isPastDue,
      isSuspended,
      trialDaysRemaining,
      daysUntilRenewal,
      refresh: fetchSubscription,
    }),
    [
      subscription,
      currentPlan,
      usage,
      loading,
      error,
      hasFeature,
      canUseMore,
      getRemainingUsage,
      getUsagePercent,
      isOverLimit,
      isActive,
      isTrialing,
      isCanceled,
      isPastDue,
      isSuspended,
      trialDaysRemaining,
      daysUntilRenewal,
      fetchSubscription,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

// ============================================
// HOOKS HELPERS
// ============================================

/**
 * Hook pour vérifier une feature spécifique
 */
export function useFeature(feature: FeatureKey): { hasAccess: boolean; loading: boolean } {
  const { hasFeature, loading } = useSubscription();
  return { hasAccess: hasFeature(feature), loading };
}

/**
 * Hook pour vérifier une limite
 */
export function useUsageLimit(resource: "properties" | "leases" | "users" | "signatures") {
  const { canUseMore, getRemainingUsage, getUsagePercent, isOverLimit, loading } = useSubscription();

  return {
    canAdd: canUseMore(resource),
    remaining: getRemainingUsage(resource),
    percentage: getUsagePercent(resource),
    isAtLimit: isOverLimit(resource),
    loading,
  };
}

/**
 * Hook pour obtenir le plan actuel
 */
export function useCurrentPlan() {
  const { currentPlan, subscription, loading } = useSubscription();
  const plan = PLANS[currentPlan];

  return {
    slug: currentPlan,
    name: plan.name,
    plan,
    subscription,
    loading,
  };
}

/**
 * Hook spécifique pour les signatures avec détails complets
 */
export function useSignatureQuota() {
  const { usage, currentPlan, loading } = useSubscription();
  const plan = PLANS[currentPlan];

  const used = usage?.signatures?.used ?? 0;
  const limit = usage?.signatures?.limit ?? plan.limits.signatures_monthly_quota;
  const isUnlimited = limit === -1;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);
  const percentage = isUnlimited ? 0 : (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : (used > 0 ? 100 : 0));

  // Prix par signature supplémentaire (en centimes)
  const pricePerExtra = (plan.features.signature_price as number) || 590;

  return {
    used,
    limit,
    remaining,
    percentage,
    isUnlimited,
    canSign: isUnlimited || used < limit,
    isAtLimit: !isUnlimited && used >= limit,
    pricePerExtra,
    pricePerExtraFormatted: `${(pricePerExtra / 100).toFixed(2)}€`,
    loading,
  };
}

// Export default
export default SubscriptionProvider;

