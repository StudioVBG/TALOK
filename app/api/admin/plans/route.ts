export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { z } from "zod";

const createPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  price_monthly: z.number().min(0).default(0),
  price_yearly: z.number().min(0).default(0),
  max_properties: z.number().int().min(1).default(1),
  max_leases: z.number().int().min(1).default(1),
  max_tenants: z.number().int().min(1).default(1),
  max_documents_gb: z.number().min(0).default(1),
  features: z.record(z.boolean()).optional(),
  is_active: z.boolean().default(true),
  is_popular: z.boolean().default(false),
  display_order: z.number().int().default(0),
});

const updatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price_monthly: z.number().min(0).optional(),
  price_yearly: z.number().min(0).optional(),
  max_properties: z.number().int().min(1).optional(),
  max_leases: z.number().int().min(1).optional(),
  max_tenants: z.number().int().min(1).optional(),
  max_documents_gb: z.number().min(0).optional(),
  features: z.record(z.boolean()).optional(),
  is_active: z.boolean().optional(),
  is_popular: z.boolean().optional(),
  change_reason: z.string().optional(),
  effective_date: z.string().optional(),
  grandfather_months: z.number().int().min(0).default(6),
  notify_subscribers: z.boolean().default(true),
});

/**
 * GET /api/admin/plans - Lister tous les plans avec le nombre d'abonnés
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.plans.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    // Récupérer les plans avec le comptage des abonnés
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("display_order");

    if (error) throw error;

    // Compter les abonnés actifs pour chaque plan
    const plansWithCounts = await Promise.all(
      (plans || []).map(async (plan) => {
        const { count } = await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", plan.id)
          .in("status", ["active", "trialing"]);
        
        return {
          ...plan,
          active_subscribers_count: count || 0
        };
      })
    );

    return NextResponse.json({ plans: plansWithCounts });
  } catch (error: unknown) {
    console.error("[Admin Plans GET]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/plans - Mettre à jour un plan avec gestion des abonnés actifs
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
      rateLimit: "adminCritical",
      auditAction: "Mise à jour plan tarifaire",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;
    const profile = auth.profile;
    const supabase = await createClient();

    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
      id,
      name,
      description,
      price_monthly,
      price_yearly,
      max_properties,
      max_leases,
      max_tenants,
      max_documents_gb,
      features,
      is_active,
      is_popular,
      change_reason,
      effective_date,
      grandfather_months,
      notify_subscribers
    } = parsed.data;

    // 1. Récupérer l'ancien plan
    const { data: oldPlan, error: oldPlanError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", id)
      .single();

    if (oldPlanError) throw oldPlanError;

    // 2. Vérifier s'il y a un changement de prix ou de features
    const priceChanged = 
      oldPlan.price_monthly !== price_monthly || 
      oldPlan.price_yearly !== price_yearly;
    
    const featuresChanged = 
      JSON.stringify(oldPlan.features) !== JSON.stringify(features);

    let affectedSubscribers = 0;

    // 3. Si changement de prix → traiter les abonnés actifs
    if (priceChanged || featuresChanged) {
      // Date effective minimum = 30 jours
      const minEffectiveDate = new Date();
      minEffectiveDate.setDate(minEffectiveDate.getDate() + 30);
      
      const finalEffectiveDate = effective_date 
        ? new Date(effective_date)
        : minEffectiveDate;
      
      if (finalEffectiveDate < minEffectiveDate) {
        return NextResponse.json({ 
          error: "La date effective doit être au moins 30 jours dans le futur (obligation légale)" 
        }, { status: 400 });
      }

      // 4. Récupérer les abonnés actifs sur ce plan
      const { data: activeSubscriptions } = await supabase
        .from("subscriptions")
        .select(`
          id,
          owner_id,
          billing_cycle,
          profiles!subscriptions_owner_id_fkey(user_id, prenom, nom)
        `)
        .eq("plan_id", id)
        .in("status", ["active", "trialing"]);

      affectedSubscribers = activeSubscriptions?.length || 0;

      // 5. Sauvegarder l'historique
      await supabase.from("plan_pricing_history").insert({
        plan_id: id,
        old_price_monthly: oldPlan.price_monthly,
        old_price_yearly: oldPlan.price_yearly,
        old_features: oldPlan.features,
        old_limits: {
          max_properties: oldPlan.max_properties,
          max_leases: oldPlan.max_leases,
          max_tenants: oldPlan.max_tenants,
          max_documents_gb: oldPlan.max_documents_gb
        },
        new_price_monthly: price_monthly,
        new_price_yearly: price_yearly,
        new_features: features,
        new_limits: {
          max_properties,
          max_leases,
          max_tenants,
          max_documents_gb
        },
        change_reason: change_reason || "Mise à jour des tarifs",
        effective_date: finalEffectiveDate.toISOString(),
        notification_sent_at: notify_subscribers ? new Date().toISOString() : null,
        affected_subscribers_count: affectedSubscribers,
        changed_by: profile.id
      });

      // 6. Appliquer le "grandfathering" et notifier
      if (activeSubscriptions && activeSubscriptions.length > 0 && notify_subscribers) {
        const grandfatheredUntil = new Date(finalEffectiveDate);
        grandfatheredUntil.setMonth(grandfatheredUntil.getMonth() + grandfather_months);

        for (const sub of activeSubscriptions) {
          // Mettre à jour l'abonnement avec le grandfathering
          await supabase
            .from("subscriptions")
            .update({
              grandfathered_until: grandfatheredUntil.toISOString(),
              locked_price_monthly: oldPlan.price_monthly,
              locked_price_yearly: oldPlan.price_yearly,
              price_change_notified_at: new Date().toISOString(),
              price_change_accepted: null
            })
            .eq("id", sub.id);

          // Créer une notification in-app
          const subProfile = sub.profiles as any;
          if (subProfile?.user_id) {
            await supabase.from("notifications").insert({
              user_id: subProfile.user_id,
              type: "price_change",
              title: "📢 Modification de votre abonnement",
              body: `Les tarifs du plan ${oldPlan.name} évoluent à partir du ${finalEffectiveDate.toLocaleDateString('fr-FR')}. Votre tarif actuel est maintenu jusqu'au ${grandfatheredUntil.toLocaleDateString('fr-FR')}. Vous pouvez accepter les nouvelles conditions ou résilier sans frais.`,
              link: "/settings/billing",
              metadata: {
                plan_id: id,
                plan_name: oldPlan.name,
                old_price_monthly: oldPlan.price_monthly,
                new_price_monthly: price_monthly,
                effective_date: finalEffectiveDate.toISOString(),
                grandfathered_until: grandfatheredUntil.toISOString()
              },
              is_read: false
            });
          }
        }

        // Émettre un événement pour déclencher l'envoi d'emails
        await supabase.from("outbox").insert({
          event_type: "Subscription.PriceChanged",
          payload: {
            plan_id: id,
            plan_name: oldPlan.name,
            old_price_monthly: oldPlan.price_monthly,
            old_price_yearly: oldPlan.price_yearly,
            new_price_monthly: price_monthly,
            new_price_yearly: price_yearly,
            effective_date: finalEffectiveDate.toISOString(),
            grandfathered_until: grandfatheredUntil.toISOString(),
            affected_subscriptions: affectedSubscribers,
            grandfather_months,
            change_reason: change_reason || "Mise à jour des tarifs"
          }
        });
      }
    }

    // 7. Mettre à jour le plan
    const { data: plan, error } = await supabase
      .from("subscription_plans")
      .update({
        name,
        description,
        price_monthly,
        price_yearly,
        max_properties,
        max_leases,
        max_tenants,
        max_documents_gb,
        features,
        is_active,
        is_popular,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // 8. Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: priceChanged ? "plan_price_updated" : "plan_updated",
      entity_type: "subscription_plan",
      entity_id: id,
      metadata: { 
        changes: body,
        price_changed: priceChanged,
        features_changed: featuresChanged,
        affected_subscribers: affectedSubscribers
      }
    });

    return NextResponse.json({ 
      plan,
      price_changed: priceChanged,
      features_changed: featuresChanged,
      affected_subscribers: affectedSubscribers
    });
  } catch (error: unknown) {
    console.error("[Admin Plans PUT]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * POST /api/admin/plans - Créer un nouveau plan
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.plans.write"], {
      rateLimit: "adminCritical",
      auditAction: "Création nouveau plan",
    });
    if (isAdminAuthError(auth)) return auth;

    const user = auth.user;
    const supabase = await createClient();

    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const {
      name,
      slug,
      description,
      price_monthly,
      price_yearly,
      max_properties,
      max_leases,
      max_tenants,
      max_documents_gb,
      features,
      is_active,
      is_popular,
      display_order,
    } = parsed.data;

    // Créer le plan
    const { data: plan, error } = await supabase
      .from("subscription_plans")
      .insert({
        name,
        slug,
        description,
        price_monthly,
        price_yearly,
        max_properties,
        max_leases,
        max_tenants,
        max_documents_gb,
        features: {
          signatures: false,
          ocr: false,
          scoring: false,
          automations: false,
          api_access: false,
          priority_support: false,
          white_label: false,
          cash_payments: true,
          export_csv: true,
          multi_users: false,
          ...features
        },
        is_active,
        is_popular,
        display_order
      })
      .select()
      .single();

    if (error) throw error;

    // Log audit
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "plan_created",
      entity_type: "subscription_plan",
      entity_id: plan.id,
      metadata: { plan_name: name, slug }
    });

    return NextResponse.json({ plan });
  } catch (error: unknown) {
    console.error("[Admin Plans POST]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

