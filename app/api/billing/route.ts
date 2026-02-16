import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getStripe } from "@/lib/stripe-client";
import { getAlertLevel, getUsagePercentage } from "@/lib/billing-utils";
import type {
  BillingData,
  UsageMetric,
  UsageSummary,
  PlanFeatureGroup,
  Territoire,
  PlanId,
  SubscriptionStatus,
  BillingCycle,
} from "@/types/billing";

/** Extended subscription row: DB may have extra columns (territoire, tva_taux, pause_collection_until) not in generated types */
type SubscriptionRowExtended = {
  id: string;
  user_id?: string;
  plan_id?: string | null;
  plan?: string;
  status?: string;
  billing_cycle?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  trial_end?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  created_at?: string;
  updated_at?: string;
  territoire?: string;
  tva_taux?: number;
  pause_collection_until?: string | null;
};

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Fetch subscription via owner_id (schéma unifié)
    let subscription: SubscriptionRowExtended | null = null;
    let subError: { code?: string } | null = null;

    // Utiliser service role pour la vérification du profil (bypass RLS)
    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      const result = await supabase
        .from("subscriptions")
        .select("*")
        .eq("owner_id", profile.id)
        .maybeSingle();

      subscription = result.data as SubscriptionRowExtended | null;
      subError = result.error;
    }

    if (subError && subError.code !== "PGRST116") {
      return NextResponse.json({ error: "Erreur lors de la recherche d'abonnement" }, { status: 500 });
    }

    // Pas d'abonnement = nouveau compte ou plan gratuit
    if (!subscription) {
      const defaultResponse: BillingData = {
        subscription: null as any,
        usage: {
          biens: { metric: "biens", current_value: 0, max_value: 1, percentage: 0, alert_level: "normal" },
          signatures: { metric: "signatures", current_value: 0, max_value: 0, percentage: 0, alert_level: "normal" },
          utilisateurs: { metric: "utilisateurs", current_value: 0, max_value: 1, percentage: 0, alert_level: "normal" },
          stockage_mb: { metric: "stockage_mb", current_value: 0, max_value: 100, percentage: 0, alert_level: "normal" },
        },
        plan: {
          id: "gratuit",
          name: "Gratuit",
          description: "Plan gratuit - 1 bien",
          price_monthly_ht: 0,
          price_yearly_ht: 0,
          yearly_discount_percent: 0,
          limits: { biens: 1, signatures: 0, utilisateurs: 1, stockage_mb: 100 },
          features: [],
          stripe_price_monthly: "",
          stripe_price_yearly: "",
        },
        payment_method: null,
      };
      return NextResponse.json(defaultResponse);
    }

    // Fetch plan (table subscription_plans — schéma unifié)
    const planId = subscription.plan_id ?? subscription.plan ?? "";
    const { data: planData } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    // Fetch usage
    const { data: usageData } = await supabase
      .from("subscription_usage")
      .select("*")
      .eq("subscription_id", subscription.id)
      .single();

    type UsageRow = { properties_count?: number; signatures_used?: number; users_count?: number; storage_mb?: number };
    const usageRow = (usageData ?? {}) as UsageRow;

    // Fetch payment method from Stripe if available
    let paymentMethod = null;
    if (subscription.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
          expand: ["default_payment_method"],
        });
        const pm = stripeSub.default_payment_method;
        if (pm && typeof pm !== "string" && pm.card) {
          paymentMethod = {
            id: pm.id,
            brand: (pm.card.brand || "unknown") as "visa" | "mastercard" | "amex" | "discover" | "unknown",
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          };
        }
      } catch {
        // Stripe unavailable — no payment method
      }
    }

    // Build usage summary (planData has flat structure: max_properties, signatures_monthly_quota, etc.)
    const maxProperties = planData?.max_properties ?? -1;
    const maxSignatures = planData?.signatures_monthly_quota ?? -1;
    const maxUsers = planData?.max_users ?? -1;
    const maxDocumentsGb = planData?.max_documents_gb ?? -1;

    const buildUsageRecord = (metric: UsageMetric, current: number, max: number) => ({
      metric,
      current_value: current,
      max_value: max,
      percentage: getUsagePercentage(current, max),
      alert_level: getAlertLevel(current, max),
    });

    const usage: UsageSummary = {
      biens: buildUsageRecord("biens", Number(usageRow.properties_count ?? 0), maxProperties),
      signatures: buildUsageRecord("signatures", Number(usageRow.signatures_used ?? 0), maxSignatures),
      utilisateurs: buildUsageRecord("utilisateurs", Number(usageRow.users_count ?? 0), maxUsers),
      stockage_mb: buildUsageRecord("stockage_mb", Number(usageRow.storage_mb ?? 0), maxDocumentsGb * 1024),
    };

    // Build plan features (planData.features is Json; may be PlanFeatureGroup[])
    const features: PlanFeatureGroup[] = (planData?.features as PlanFeatureGroup[] | null | undefined) ?? [];

    const territoire: Territoire = (subscription.territoire as Territoire) || "metropole";

    const subPlanId = (subscription.plan_id ?? subscription.plan ?? "gratuit") as PlanId;
    const subStatus = (subscription.status ?? "active") as SubscriptionStatus;
    const subBillingCycle = (subscription.billing_cycle ?? "monthly") as BillingCycle;
    const subPeriodStart = subscription.current_period_start ?? "";
    const subPeriodEnd = subscription.current_period_end ?? "";
    const subCreatedAt = subscription.created_at ?? "";
    const subUpdatedAt = subscription.updated_at ?? subscription.created_at ?? "";

    const response: BillingData = {
      subscription: {
        id: subscription.id,
        user_id: subscription.user_id ?? "",
        plan_id: subPlanId,
        status: subStatus,
        billing_cycle: subBillingCycle,
        current_period_start: subPeriodStart,
        current_period_end: subPeriodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        pause_collection_until: subscription.pause_collection_until ?? null,
        trial_end: subscription.trial_end ?? null,
        territoire,
        tva_taux: subscription.tva_taux ?? 20,
        stripe_customer_id: subscription.stripe_customer_id ?? null,
        stripe_subscription_id: subscription.stripe_subscription_id ?? null,
        created_at: subCreatedAt,
        updated_at: subUpdatedAt,
      },
      usage,
      plan: {
        id: (planData?.slug ?? subscription.plan_id ?? subscription.plan ?? "gratuit") as PlanId,
        name: planData?.name ?? "Plan",
        description: planData?.description ?? "",
        price_monthly_ht: planData?.price_monthly ?? 0,
        price_yearly_ht: planData?.price_yearly ?? 0,
        yearly_discount_percent: 20, // SubscriptionPlanRow has no yearly_discount_percent; use default
        limits: {
          biens: maxProperties,
          signatures: maxSignatures,
          utilisateurs: maxUsers,
          stockage_mb: maxDocumentsGb * 1024,
        },
        features,
        stripe_price_monthly: planData?.stripe_price_monthly_id ?? "",
        stripe_price_yearly: planData?.stripe_price_yearly_id ?? "",
      },
      payment_method: paymentMethod,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
