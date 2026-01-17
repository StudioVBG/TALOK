/**
 * Service de gestion des abonnements
 * Gère les plans, subscriptions, limites et Stripe Billing
 */

import { createClient } from "@/lib/supabase/client";

// ============================================
// TYPES
// ============================================

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  features: PlanFeatures;
  is_popular: boolean;
  display_order: number;
}

export interface PlanFeatures {
  signatures: boolean;
  ocr: boolean;
  scoring: boolean;
  automations: boolean;
  api_access: boolean;
  priority_support: boolean;
  white_label: boolean;
  cash_payments: boolean;
  export_csv: boolean;
  multi_users: boolean;
}

export interface Subscription {
  id: string;
  owner_id: string;
  plan_id: string;
  plan: Plan;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: "monthly" | "yearly";
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  cancel_at_period_end: boolean;
  properties_count: number;
  leases_count: number;
  tenants_count: number;
  documents_size_mb: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  | "incomplete";

export interface SubscriptionLimits {
  plan_name: string;
  plan_slug: string;
  status: string;
  trial_end: string | null;
  properties_current: number;
  properties_max: number;
  leases_current: number;
  leases_max: number;
  tenants_current: number;
  tenants_max: number;
  features: PlanFeatures;
}

export interface UsageRecord {
  usage_type: string;
  quantity: number;
  period_month: string;
}

// ============================================
// SERVICE
// ============================================

class SubscriptionsService {
  /**
   * Récupère tous les plans disponibles
   */
  async getPlans(): Promise<Plan[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("display_order");

    if (error) {
      console.error("Erreur récupération plans:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère un plan par son slug
   */
  async getPlanBySlug(slug: string): Promise<Plan | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Récupère l'abonnement actuel d'un propriétaire
   */
  async getCurrentSubscription(ownerId: string): Promise<Subscription | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", ownerId)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Erreur récupération subscription:", error);
      }
      return null;
    }

    return data;
  }

  /**
   * Récupère les limites actuelles (via RPC)
   */
  async getLimits(ownerId: string): Promise<SubscriptionLimits | null> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_subscription_limits", {
      p_owner_id: ownerId,
    });

    if (error) {
      console.error("Erreur récupération limites:", error);
      return null;
    }

    return data?.[0] || null;
  }

  /**
   * Vérifie si une limite est atteinte
   */
  async checkLimit(
    ownerId: string,
    resource: "properties" | "leases" | "tenants"
  ): Promise<{ allowed: boolean; current: number; max: number; message?: string }> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("check_subscription_limit", {
      p_owner_id: ownerId,
      p_resource: resource,
    });

    if (error) {
      console.error("Erreur vérification limite:", error);
      return { allowed: false, current: 0, max: 0, message: "Erreur de vérification" };
    }

    const limits = await this.getLimits(ownerId);
    const current = resource === "properties"
      ? limits?.properties_current || 0
      : resource === "leases"
      ? limits?.leases_current || 0
      : limits?.tenants_current || 0;

    const max = resource === "properties"
      ? limits?.properties_max || 1
      : resource === "leases"
      ? limits?.leases_max || 1
      : limits?.tenants_max || 1;

    return {
      allowed: data,
      current,
      max,
      message: data
        ? undefined
        : `Limite atteinte (${current}/${max}). Passez à un plan supérieur.`,
    };
  }

  /**
   * Vérifie si le propriétaire a accès à une feature
   */
  async hasFeature(
    ownerId: string,
    feature: keyof PlanFeatures
  ): Promise<boolean> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("has_subscription_feature", {
      p_owner_id: ownerId,
      p_feature: feature,
    });

    if (error) {
      console.error("Erreur vérification feature:", error);
      return false;
    }

    return data || false;
  }

  /**
   * Crée une session de checkout Stripe
   */
  async createCheckoutSession(
    planSlug: string,
    billingCycle: "monthly" | "yearly",
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ url: string } | { error: string }> {
    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: planSlug,
          billing_cycle: billingCycle,
          success_url: successUrl || `${window.location.origin}/owner/settings/billing?success=true`,
          cancel_url: cancelUrl || `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Erreur lors de la création du checkout" };
      }

      return { url: data.url };
    } catch (error: unknown) {
      return { error: error.message };
    }
  }

  /**
   * Crée un portail de gestion Stripe
   */
  async createPortalSession(): Promise<{ url: string } | { error: string }> {
    try {
      const response = await fetch("/api/subscriptions/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Erreur lors de la création du portail" };
      }

      return { url: data.url };
    } catch (error: unknown) {
      return { error: error.message };
    }
  }

  /**
   * Annule un abonnement
   */
  async cancelSubscription(
    atPeriodEnd: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at_period_end: atPeriodEnd }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error };
      }

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enregistre un usage (pour les quotas)
   */
  async recordUsage(
    subscriptionId: string,
    usageType: string,
    quantity: number = 1,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = createClient();
    const periodMonth = new Date().toISOString().slice(0, 7); // "2024-11"

    await supabase.from("subscription_usage").insert({
      subscription_id: subscriptionId,
      usage_type: usageType,
      quantity,
      period_month: periodMonth,
      metadata,
    });
  }

  /**
   * Récupère l'usage du mois
   */
  async getMonthlyUsage(
    subscriptionId: string
  ): Promise<Record<string, number>> {
    const supabase = createClient();
    const periodMonth = new Date().toISOString().slice(0, 7);

    const { data } = await supabase
      .from("subscription_usage")
      .select("usage_type, quantity")
      .eq("subscription_id", subscriptionId)
      .eq("period_month", periodMonth);

    const usage: Record<string, number> = {};
    for (const record of data || []) {
      usage[record.usage_type] = (usage[record.usage_type] || 0) + record.quantity;
    }

    return usage;
  }

  /**
   * Vérifie si l'essai gratuit est actif
   */
  isTrialing(subscription: Subscription | null): boolean {
    if (!subscription) return false;
    if (subscription.status !== "trialing") return false;
    if (!subscription.trial_end) return false;
    return new Date(subscription.trial_end) > new Date();
  }

  /**
   * Calcule le nombre de jours restants d'essai
   */
  getTrialDaysRemaining(subscription: Subscription | null): number {
    if (!subscription?.trial_end) return 0;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Formate un prix en euros
   */
  formatPrice(cents: number, showDecimal: boolean = true): string {
    const euros = cents / 100;
    if (showDecimal) {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(euros);
    }
    return `${Math.round(euros)}€`;
  }

  /**
   * Calcule l'économie annuelle
   */
  calculateYearlySaving(plan: Plan): { amount: number; percent: number } {
    if (plan.price_monthly === 0) return { amount: 0, percent: 0 };
    const monthlyYearTotal = plan.price_monthly * 12;
    const yearlySaving = monthlyYearTotal - plan.price_yearly;
    const percent = Math.round((yearlySaving / monthlyYearTotal) * 100);
    return { amount: yearlySaving, percent };
  }
}

// Singleton
export const subscriptionsService = new SubscriptionsService();

