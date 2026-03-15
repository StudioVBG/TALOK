"use client";

/**
 * SubscriptionProvider - Context React pour la gestion des abonnements
 * Fournit l'état de l'abonnement, l'usage et les helpers à toute l'application
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PLANS,
  type PlanSlug,
  type FeatureKey,
  getUsagePercentage,
  hasPlanFeature,
  isSubscriptionStatusEntitled,
} from "@/lib/subscriptions/plans";
import { resolveCurrentPlan } from "@/lib/subscriptions/resolve-current-plan";
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
  canUseMore: (resource: "properties" | "leases" | "users" | "signatures" | "tenants") => boolean;
  getRemainingUsage: (resource: "properties" | "leases" | "users" | "signatures" | "tenants") => number;
  getUsagePercent: (resource: "properties" | "leases" | "users" | "signatures" | "tenants") => number;
  isOverLimit: (resource: "properties" | "leases" | "users" | "signatures" | "tenants") => boolean;

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
  const [usagePlanSlug, setUsagePlanSlug] = useState<PlanSlug | null>(null);
  const [loading, setLoading] = useState(!initialSubscription);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // SOTA 2026: Ref pour compter les retries (ne déclenche pas de re-render)
  const retryCountRef = React.useRef(0);

  // Current plan slug - gratuit par défaut pour les nouveaux utilisateurs
  const currentPlan = useMemo<PlanSlug>(
    () => resolveCurrentPlan(subscription?.plan_slug, usagePlanSlug),
    [subscription?.plan_slug, usagePlanSlug]
  );

  // Plan config
  const planConfig = useMemo(() => PLANS[currentPlan], [currentPlan]);

  // ============================================
  // FETCH DATA
  // ============================================

  const fetchSubscription = useCallback(async () => {
    try {
      setError(null);
      setUsagePlanSlug(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubscription(null);
        setUsage(null);
        setUsagePlanSlug(null);
        setLoading(false);
        return;
      }

      // Récupérer le profile_id d'abord (maybeSingle pour éviter 406 si profil absent)
      let profile: { id: string } | null = null;
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        // Si erreur de récursion RLS, utiliser la route API en fallback
        if (profileError.code === '42P17' || profileError.message?.includes('infinite recursion')) {
          console.warn("[SubscriptionProvider] RLS recursion detected, using API fallback");
          try {
            const response = await fetch("/api/me/profile", { credentials: "include" });
            if (response.ok) {
              const apiProfile = await response.json();
              profile = { id: apiProfile.id };
            }
          } catch (apiError) {
            console.error("[SubscriptionProvider] API fallback error:", apiError);
          }
        }
      } else {
        profile = profileData;
      }

      if (!profile) {
        // Pas de profil = pas d'abonnement
        setSubscription(null);
        setUsage(null);
        setUsagePlanSlug(null);
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
        const planFields = "name, price_monthly, price_yearly, max_properties, max_leases, max_tenants, max_documents_gb, features, slug";
        const toPlan = (data: any) => data ? {
          ...data,
          limits: {
            max_properties: data.max_properties,
            max_leases: data.max_leases,
            max_tenants: data.max_tenants,
            max_documents_gb: data.max_documents_gb,
          }
        } : null;

        // 1. Essayer plan_slug d'abord
        if (sub.plan_slug) {
          const { data } = await supabase
            .from("subscription_plans")
            .select(planFields)
            .eq("slug", sub.plan_slug)
            .maybeSingle();
          plan = toPlan(data);
        }

        // 2. Fallback sur plan_id si plan_slug absent ou non trouvé
        if (!plan && sub.plan_id) {
          const { data } = await supabase
            .from("subscription_plans")
            .select(planFields)
            .eq("id", sub.plan_id)
            .maybeSingle();
          plan = toPlan(data);
          if (plan && !sub.plan_slug) {
            console.warn(`[SubscriptionProvider] plan_slug manquant, résolu via plan_id: ${plan.slug}`);
          }
        }

        const resolvedSlug = sub.plan_slug || plan?.slug || "gratuit";
        subscriptionWithPlan = {
          ...sub,
          plan_slug: resolvedSlug,
          plan: plan || null,
        } as SubscriptionWithPlan;
      }

      setSubscription(subscriptionWithPlan);

      // Fetch usage from API
      const usageRes = await fetch("/api/subscriptions/usage");
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData.usage);
        setUsagePlanSlug(resolveCurrentPlan(undefined, usageData.plan_slug));
      } else {
        setUsagePlanSlug(null);
      }

      // Succès : fin du chargement + reset retry counter
      setLoading(false);
      retryCountRef.current = 0;
    } catch (err) {
      console.error("[SubscriptionProvider] Error:", err);
      setError("Erreur lors du chargement de l'abonnement");

      // SOTA 2026: Retry automatique avec backoff exponentiel (max 2 retries)
      if (retryCountRef.current < 2) {
        retryCountRef.current += 1;
        const delay = retryCountRef.current * 2000; // 2s, 4s
        console.info(`[SubscriptionProvider] Retry ${retryCountRef.current}/2 dans ${delay}ms`);
        setTimeout(() => fetchSubscription(), delay);
        // Ne pas mettre loading=false pendant le retry
        return;
      }
      setLoading(false);
    }
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    if (!initialSubscription) {
      retryCountRef.current = 0;
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
        setUsagePlanSlug(null);
      }
    });

    return () => authSub.unsubscribe();
  }, [supabase, fetchSubscription]);

  // ============================================
  // FEATURE CHECKS
  // ============================================

  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      if (!isSubscriptionStatusEntitled(subscription?.status)) {
        return false;
      }
      return hasPlanFeature(currentPlan, feature);
    },
    [subscription?.status, currentPlan]
  );

  // ============================================
  // USAGE CHECKS
  // ============================================

  const getLimitForResource = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): number => {
      const limitKey = resource === "signatures" ? "signatures_monthly_quota" : `max_${resource}`;
      return (planConfig.limits as unknown as Record<string, number>)[limitKey] ?? 0;
    },
    [planConfig]
  );

  const getUsedForResource = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): number => {
      if (!usage) return 0;
      return usage[resource]?.used ?? 0;
    },
    [usage]
  );

  const canUseMore = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): boolean => {
      // SOTA 2026: Pendant le chargement, être permissif (le backend vérifiera)
      // Évite les faux blocages pendant le fetch initial
      if (loading && !usage) return true;

      const limit = getLimitForResource(resource);
      if (limit === -1) return true; // Unlimited

      // Pour les propriétés : si le plan autorise des biens supplémentaires payants,
      // ne pas bloquer au-delà du quota inclus (aligné avec le backend subscription-check.ts)
      if (resource === "properties" && planConfig.limits.extra_property_price > 0) {
        return true;
      }

      const used = getUsedForResource(resource);
      return used < limit;
    },
    [getLimitForResource, getUsedForResource, planConfig, loading, usage]
  );

  const getRemainingUsage = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): number => {
      const limit = getLimitForResource(resource);
      if (limit === -1) return Infinity;

      // Pour les propriétés avec biens supplémentaires payants : pas de plafond dur
      if (resource === "properties" && planConfig.limits.extra_property_price > 0) {
        return Infinity;
      }

      const used = getUsedForResource(resource);
      return Math.max(0, limit - used);
    },
    [getLimitForResource, getUsedForResource, planConfig]
  );

  const getUsagePercent = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): number => {
      const limit = getLimitForResource(resource);

      // Pour les propriétés avec biens supplémentaires payants :
      // calculer le pourcentage par rapport aux biens inclus (informatif uniquement, pas bloquant)
      if (resource === "properties" && planConfig.limits.extra_property_price > 0) {
        const used = getUsedForResource(resource);
        const included = planConfig.limits.included_properties;
        if (included <= 0) return 0;
        return getUsagePercentage(used, included);
      }

      const used = getUsedForResource(resource);
      return getUsagePercentage(used, limit);
    },
    [getLimitForResource, getUsedForResource, planConfig]
  );

  const isOverLimit = useCallback(
    (resource: "properties" | "leases" | "users" | "signatures" | "tenants"): boolean => {
      const limit = getLimitForResource(resource);
      if (limit === -1) return false;

      // Pour les propriétés avec biens supplémentaires payants : jamais "over limit"
      if (resource === "properties" && planConfig.limits.extra_property_price > 0) {
        return false;
      }

      const used = getUsedForResource(resource);
      return used >= limit;
    },
    [getLimitForResource, getUsedForResource, planConfig]
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
    () => subscription?.status === "paused" || subscription?.status === ("suspended" as any),
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
export function useUsageLimit(resource: "properties" | "leases" | "users" | "signatures" | "tenants") {
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

