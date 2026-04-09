/**
 * Subscription Check Middleware
 * SOTA 2026: Middleware de vérification des limites et features de subscription
 *
 * Usage dans une API route:
 * ```typescript
 * import { withSubscriptionLimit, withFeatureAccess } from '@/lib/middleware/subscription-check';
 *
 * export async function POST(request: Request) {
 *   const limitCheck = await withSubscriptionLimit(userId, 'properties');
 *   if (!limitCheck.allowed) {
 *     return NextResponse.json({ error: limitCheck.message }, { status: 403 });
 *   }
 *   // ... rest of the handler
 * }
 * ```
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import {
  PLANS,
  type PlanSlug,
  type FeatureKey,
  getRequiredPlanForFeature,
  hasPlanFeature,
  isSubscriptionStatusEntitled,
} from "@/lib/subscriptions/plans";

export type LimitType = "properties" | "leases" | "users" | "documents_gb" | "signatures";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  remaining: number;
  plan: string;
  message?: string;
}

export interface FeatureCheckResult {
  allowed: boolean;
  feature: string;
  plan: string;
  requiredPlan?: string;
  message?: string;
}

/**
 * Vérifie si l'utilisateur peut ajouter une ressource selon les limites de son forfait
 */
export async function withSubscriptionLimit(
  ownerId: string,
  limitType: LimitType
): Promise<LimitCheckResult> {
  const serviceClient = getServiceClient();

  try {
    // Récupérer la subscription et le plan
    const { data: subscription, error: subError } = await serviceClient
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (subError || !subscription) {
      // Pas de subscription en BDD = plan gratuit
      // On doit quand même compter l'usage réel avant de décider
      const freeLimits = PLANS.gratuit.limits;
      let current = 0;
      let max = 0;

      switch (limitType) {
        case "properties": {
          const { count: propCount } = await serviceClient
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("owner_id", ownerId)
            .is("deleted_at", null);
          current = propCount || 0;
          max = freeLimits.max_properties;
          break;
        }
        case "leases": {
          const { data: ownerProperties } = await serviceClient
            .from("properties")
            .select("id")
            .eq("owner_id", ownerId)
            .is("deleted_at", null);
          if (ownerProperties && ownerProperties.length > 0) {
            const propertyIds = ownerProperties.map((p: { id: string }) => p.id);
            const { count: leaseCount } = await serviceClient
              .from("leases")
              .select("id", { count: "exact", head: true })
              .in("property_id", propertyIds)
              .in("statut", ["active", "pending_signature"]);
            current = leaseCount || 0;
          }
          max = freeLimits.max_leases;
          break;
        }
        case "users": {
          const { count: userCount } = await serviceClient
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", ownerId)
            .eq("status", "active");
          current = userCount || 0;
          max = freeLimits.max_users;
          break;
        }
        case "documents_gb":
          current = 0;
          max = freeLimits.max_documents_gb;
          break;
        case "signatures": {
          const currentMonth = new Date().toISOString().slice(0, 7);
          const { count: sigCount } = await serviceClient
            .from("signature_requests")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", ownerId)
            .gte("created_at", `${currentMonth}-01`)
            .neq("status", "cancelled");
          current = sigCount || 0;
          max = freeLimits.signatures_monthly_quota;
          break;
        }
      }

      if (max === -1) {
        return { allowed: true, current, max: -1, remaining: -1, plan: "gratuit" };
      }

      const allowed = current < max;
      const remaining = Math.max(0, max - current);
      return {
        allowed,
        current,
        max,
        remaining,
        plan: "gratuit",
        message: allowed
          ? undefined
          : `Limite de ${max} ${getLimitLabel(limitType)} atteinte pour le forfait gratuit. Passez à un forfait supérieur.`,
      };
    }

    // Déterminer le plan slug et les limites
    // Priorité: plan_slug > plan.slug (jointure) > fallback gratuit
    const resolvedSlug = subscription.plan_slug || (subscription.plan as any)?.slug;
    if (!subscription.plan_slug && resolvedSlug) {
      console.warn(`[subscription-check] plan_slug NULL pour owner_id=${ownerId}, résolu depuis plan.slug="${resolvedSlug}"`);
    }
    const planSlug: PlanSlug = (resolvedSlug || "gratuit") as PlanSlug;
    const planConfig = PLANS[planSlug] || PLANS.gratuit;

    // Vérifier que le statut de la subscription permet l'usage
    if (!isSubscriptionStatusEntitled(subscription.status)) {
      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0,
        plan: planSlug,
        message: `Votre abonnement n'est plus actif (${subscription.status}). Veuillez mettre à jour votre moyen de paiement.`,
      };
    }

    // Trial expiré ? Mettre à jour en BDD et bloquer
    if (subscription.status === 'trialing' && subscription.trial_end && new Date(subscription.trial_end) < new Date()) {
      // Fire-and-forget : mettre à jour le statut en BDD
      serviceClient
        .from('subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', subscription.id)
        .then(() => {});

      return {
        allowed: false,
        current: 0,
        max: 0,
        remaining: 0,
        plan: planSlug,
        message: "Votre période d'essai est terminée. Passez à un forfait payant pour continuer.",
      };
    }

    const plan = (subscription.plan || {}) as any;
    let current = 0;
    let max = 0;

    switch (limitType) {
      case "properties": {
        const { count: propCount } = await serviceClient
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .is("deleted_at", null);
        current = propCount || 0;
        max = plan.max_properties ?? planConfig.limits.max_properties;

        // Si le forfait permet des biens supplémentaires payants,
        // ne pas bloquer au-delà du nombre inclus
        if (planConfig.limits.extra_property_price > 0) {
          // Le forfait autorise des biens au-delà du quota inclus (avec surcoût)
          // → toujours autoriser la création
          return {
            allowed: true,
            current,
            max: -1, // Pas de plafond dur
            remaining: -1,
            plan: planSlug,
          };
        }
        break;
      }
      case "leases": {
        const { data: ownerProperties } = await serviceClient
          .from("properties")
          .select("id")
          .eq("owner_id", ownerId)
          .is("deleted_at", null);
        if (ownerProperties && ownerProperties.length > 0) {
          const propertyIds = ownerProperties.map((p: { id: string }) => p.id);
          const { count: leaseCount } = await serviceClient
            .from("leases")
            .select("id", { count: "exact", head: true })
            .in("property_id", propertyIds)
            .in("statut", ["active", "pending_signature"]);
          current = leaseCount || 0;
        } else {
          current = 0;
        }
        max = plan.max_leases ?? planConfig.limits.max_leases;
        break;
      }
      case "users":
        // Compter les team members actifs
        const { count: userCount } = await serviceClient
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .eq("status", "active");
        current = userCount || 0;
        max = plan.max_users ?? planConfig.limits.max_users;
        break;
      case "documents_gb":
        current = subscription.documents_size_mb ? subscription.documents_size_mb / 1024 : 0;
        max = plan.max_documents_gb ?? planConfig.limits.max_documents_gb;
        break;
      case "signatures":
        // Compter les signatures du mois en cours pour CE propriétaire
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { count: sigCount } = await serviceClient
          .from("signature_requests")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .gte("created_at", `${currentMonth}-01`)
          .neq("status", "cancelled");
        current = sigCount || 0;
        max = plan.signatures_monthly_quota ?? planConfig.limits.signatures_monthly_quota;
        break;
    }

    // -1 signifie illimité
    if (max === -1) {
      return {
        allowed: true,
        current,
        max: -1,
        remaining: -1,
        plan: planSlug,
      };
    }

    const allowed = current < max;
    const remaining = Math.max(0, max - current);

    return {
      allowed,
      current,
      max,
      remaining,
      plan: planSlug,
      message: allowed
        ? undefined
        : `Limite de ${max} ${getLimitLabel(limitType)} atteinte pour le forfait "${planSlug}". Passez à un forfait supérieur.`,
    };
  } catch (error) {
    console.error("[subscription-check] Error:", error);
    // En cas d'erreur technique, on autorise pour ne pas bloquer l'utilisateur
    // Le backend vérifiera à nouveau lors de la prochaine action
    return {
      allowed: true,
      current: 0,
      max: -1,
      remaining: -1,
      plan: "unknown",
      message: undefined,
    };
  }
}

/**
 * Vérifie si l'utilisateur a accès à une feature selon son forfait
 */
export async function withFeatureAccess(
  ownerId: string,
  feature: FeatureKey
): Promise<FeatureCheckResult> {
  const serviceClient = getServiceClient();

  try {
    // Récupérer la subscription et le plan
    const { data: subscription, error } = await serviceClient
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", ownerId)
      .maybeSingle();

    if (error || !subscription) {
      const requiredPlan = getRequiredPlanForFeature(feature);
      return {
        allowed: false,
        feature,
        plan: "gratuit",
        requiredPlan,
        message: `La fonctionnalité "${getFeatureLabel(feature)}" n'est pas disponible dans le forfait gratuit.`,
      };
    }

    const planSlug = (subscription.plan_slug || (subscription.plan as any)?.slug || "gratuit") as PlanSlug;
    const requiredPlan = getRequiredPlanForFeature(feature);
    const allowed = isSubscriptionStatusEntitled(subscription.status) && hasPlanFeature(planSlug, feature);

    return {
      allowed,
      feature,
      plan: planSlug,
      requiredPlan: allowed ? undefined : requiredPlan,
      message: allowed
        ? undefined
        : `La fonctionnalité "${getFeatureLabel(feature)}" nécessite le forfait ${PLANS[requiredPlan].name} ou supérieur.`,
    };
  } catch (error) {
    console.error("[subscription-check] Error:", error);
    return {
      allowed: false,
      feature,
      plan: "unknown",
      message: "Erreur lors de la vérification de l'abonnement.",
    };
  }
}

/**
 * Helper: Obtient le libellé d'une limite
 */
function getLimitLabel(limitType: LimitType): string {
  const labels: Record<LimitType, string> = {
    properties: "bien(s)",
    leases: "bail(baux)",
    users: "utilisateur(s)",
    documents_gb: "Go de stockage",
    signatures: "signature(s) ce mois",
  };
  return labels[limitType] || limitType;
}

/**
 * Helper: Obtient le libellé d'une feature
 */
function getFeatureLabel(feature: FeatureKey): string {
  const labels: Record<string, string> = {
    scoring_tenant: "Scoring locataire IA",
    work_orders: "Ordres de travaux",
    providers_management: "Gestion des prestataires",
    irl_revision: "Révision IRL automatique",
    copro_module: "Module copropriété",
    owner_reports: "Rapports analytics",
    colocation: "Gestion colocation",
    bank_reconciliation: "Rapprochement bancaire",
    open_banking: "Open Banking",
    multi_users: "Multi-utilisateurs",
    auto_reminders: "Relances automatiques",
    auto_reminders_sms: "Relances SMS",
    api_access: "Accès API",
    webhooks: "Webhooks",
    white_label: "Marque blanche",
    sso: "SSO",
  };
  return labels[feature] || feature;
}

/**
 * Wrapper pour créer une réponse d'erreur standardisée
 */
export function createSubscriptionErrorResponse(
  result: LimitCheckResult | FeatureCheckResult,
  statusCode: number = 403
): Response {
  return new Response(
    JSON.stringify({
      error: "SUBSCRIPTION_LIMIT",
      message: result.message,
      details: result,
      upgrade_url: "/settings/billing",
    }),
    {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    }
  );
}
