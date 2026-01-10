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

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import type { FeatureKey } from "@/lib/subscriptions/plans";

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
      .single();

    if (subError || !subscription) {
      // Pas de subscription = plan gratuit avec limites strictes
      return {
        allowed: false,
        current: 0,
        max: 1,
        remaining: 0,
        plan: "gratuit",
        message: "Aucun abonnement trouvé. Veuillez activer un forfait.",
      };
    }

    const plan = subscription.plan || {};
    let current = 0;
    let max = 0;

    switch (limitType) {
      case "properties":
        current = subscription.properties_count || 0;
        max = plan.max_properties ?? 1;
        break;
      case "leases":
        current = subscription.leases_count || 0;
        max = plan.max_leases ?? 1;
        break;
      case "users":
        // Compter les team members actifs
        const { count: userCount } = await serviceClient
          .from("team_members")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .eq("status", "active");
        current = userCount || 0;
        max = plan.max_users ?? 1;
        break;
      case "documents_gb":
        current = subscription.documents_size_mb ? subscription.documents_size_mb / 1024 : 0;
        max = plan.max_documents_gb ?? 0.1; // 100 Mo pour gratuit
        break;
      case "signatures":
        // Compter les signatures du mois en cours
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { count: sigCount } = await serviceClient
          .from("signature_requests")
          .select("*", { count: "exact", head: true })
          .gte("created_at", `${currentMonth}-01`)
          .neq("status", "cancelled");
        current = sigCount || 0;
        max = plan.signatures_monthly_quota ?? 0;
        break;
    }

    // -1 signifie illimité
    if (max === -1) {
      return {
        allowed: true,
        current,
        max: -1,
        remaining: -1,
        plan: subscription.plan_slug || "gratuit",
      };
    }

    const allowed = current < max;
    const remaining = Math.max(0, max - current);

    return {
      allowed,
      current,
      max,
      remaining,
      plan: subscription.plan_slug || "gratuit",
      message: allowed
        ? undefined
        : `Limite de ${max} ${getLimitLabel(limitType)} atteinte pour le forfait "${subscription.plan_slug}". Passez à un forfait supérieur.`,
    };
  } catch (error) {
    console.error("[subscription-check] Error:", error);
    // En cas d'erreur, on bloque par sécurité
    return {
      allowed: false,
      current: 0,
      max: 0,
      remaining: 0,
      plan: "unknown",
      message: "Erreur lors de la vérification de l'abonnement.",
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
      .single();

    if (error || !subscription) {
      return {
        allowed: false,
        feature,
        plan: "gratuit",
        requiredPlan: getRequiredPlanForFeature(feature),
        message: `La fonctionnalité "${getFeatureLabel(feature)}" n'est pas disponible dans le forfait gratuit.`,
      };
    }

    const plan = subscription.plan || {};
    const features = plan.features || {};

    // Vérifier si la feature est activée dans le plan
    const featureValue = features[feature];
    const allowed = featureValue === true || (typeof featureValue === "string" && featureValue !== "none");

    return {
      allowed,
      feature,
      plan: subscription.plan_slug || "gratuit",
      requiredPlan: allowed ? undefined : getRequiredPlanForFeature(feature),
      message: allowed
        ? undefined
        : `La fonctionnalité "${getFeatureLabel(feature)}" nécessite le forfait ${getRequiredPlanForFeature(feature)} ou supérieur.`,
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
  const labels: Partial<Record<FeatureKey, string>> = {
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
 * Helper: Obtient le plan requis pour une feature
 */
function getRequiredPlanForFeature(feature: FeatureKey): string {
  const requirements: Partial<Record<FeatureKey, string>> = {
    // Confort+
    scoring_tenant: "Confort",
    work_orders: "Confort",
    irl_revision: "Confort",
    owner_reports: "Confort",
    colocation: "Confort",
    bank_reconciliation: "Confort",
    open_banking: "Confort",
    multi_users: "Confort",
    auto_reminders: "Confort",
    // Pro+
    providers_management: "Pro",
    auto_reminders_sms: "Pro",
    api_access: "Pro",
    // Enterprise+
    copro_module: "Enterprise L",
    webhooks: "Enterprise",
    white_label: "Enterprise M",
    sso: "Enterprise XL",
  };
  return requirements[feature] || "Confort";
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
