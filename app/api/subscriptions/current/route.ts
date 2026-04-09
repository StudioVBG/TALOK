export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolvePlanIdentifiers } from "@/lib/subscriptions/market-standard";

/**
 * GET /api/subscriptions/current - Récupérer l'abonnement actuel de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil via service role (évite la récursion RLS 42P17 sur profiles)
    const { getServiceClient } = await import("@/lib/supabase/service-client");
    const serviceClient = getServiceClient();
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[Current Subscription GET] Profile error:", profileError);
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer l'abonnement via service role (évite la récursion RLS 42P17 sur subscriptions)
    // Utiliser maybeSingle() au lieu de single() pour éviter les erreurs PGRST116
    const { data: subscription, error: subError } = await serviceClient
      .from("subscriptions")
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq("owner_id", profile.id)
      .maybeSingle();

    if (subError) {
      console.error("[Current Subscription GET] Subscription query error:", subError);
      // Ne pas throw - retourner null subscription (plan gratuit)
    }

    // Récupérer les add-ons souscrits
    let addonSubscriptions: any[] = [];
    if (subscription) {
      if (!subscription.plan && (subscription.plan_slug || subscription.plan_id)) {
        try {
          const resolvedPlan = await resolvePlanIdentifiers(serviceClient as any, {
            planSlug: (subscription as { plan_slug?: string | null }).plan_slug ?? null,
            planId: (subscription as { plan_id?: string | null }).plan_id ?? null,
          });

          if (resolvedPlan.id) {
            const { data: planRow } = await serviceClient
              .from("subscription_plans")
              .select("*")
              .eq("id", resolvedPlan.id)
              .maybeSingle();

            if (planRow) {
              (subscription as Record<string, unknown>).plan = planRow;
              (subscription as Record<string, unknown>).plan_id = resolvedPlan.id;
              (subscription as Record<string, unknown>).plan_slug = resolvedPlan.slug;
            }
          }
        } catch (planError) {
          console.warn("[Current Subscription GET] Plan resolution error (non-blocking):", planError);
        }
      }

      // Récupérer les add-ons - table peut ne pas exister, ne pas bloquer
      try {
        const { data: addons } = await serviceClient
          .from("subscription_addon_subscriptions" as any)
          .select(`
            *,
            addon:subscription_addons(*)
          `)
          .eq("subscription_id", subscription.id)
          .eq("status", "active");

        addonSubscriptions = addons || [];
      } catch {
        // Table subscription_addon_subscriptions peut ne pas exister - non-bloquant
      }
    }

    return NextResponse.json({
      subscription: subscription || null,
      addon_subscriptions: addonSubscriptions
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AuthApiError') {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    console.error("[Current Subscription GET]", error);
    // Retourner un résultat vide plutôt qu'une erreur 500
    // Le client interprétera null comme plan gratuit
    return NextResponse.json({
      subscription: null,
      addon_subscriptions: []
    });
  }
}

