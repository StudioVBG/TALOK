import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

const DowngradeSchema = z.object({
  new_plan_id: z.enum(["gratuit", "starter", "confort", "pro", "enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"]),
});

type PlanRow = {
  max_properties?: number;
  max_leases?: number;
  max_tenants?: number;
  stripe_price_yearly_id?: string | null;
  stripe_price_monthly_id?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = DowngradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
    }

    const { new_plan_id } = parsed.data;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "Aucun abonnement Stripe actif" }, { status: 400 });
    }

    const { data: newPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", new_plan_id)
      .single();

    if (!newPlan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    const plan = newPlan as PlanRow;

    // Valider que l'usage actuel rentre dans les limites du nouveau plan
    const usageConflicts: string[] = [];
    const currentProps = subscription.properties_count || 0;
    const currentLeases = subscription.leases_count || 0;
    const currentTenants = (subscription as { tenants_count?: number }).tenants_count || 0;

    if (plan.max_properties !== undefined && plan.max_properties !== -1 && currentProps > plan.max_properties) {
      usageConflicts.push(`Biens : ${currentProps} actuels > ${plan.max_properties} max`);
    }
    if (plan.max_leases !== undefined && plan.max_leases !== -1 && currentLeases > plan.max_leases) {
      usageConflicts.push(`Baux : ${currentLeases} actuels > ${plan.max_leases} max`);
    }
    if (plan.max_tenants !== undefined && plan.max_tenants !== -1 && currentTenants > plan.max_tenants) {
      usageConflicts.push(`Locataires : ${currentTenants} actuels > ${plan.max_tenants} max`);
    }

    if (usageConflicts.length > 0) {
      return NextResponse.json({
        error: "Votre usage actuel depasse les limites du nouveau plan. Reduisez votre usage avant de changer.",
        conflicts: usageConflicts,
      }, { status: 409 });
    }

    const cycle = subscription.billing_cycle || "monthly";
    const newPriceId = (cycle === "yearly" ? plan.stripe_price_yearly_id : plan.stripe_price_monthly_id) ?? null;

    if (!newPriceId) {
      return NextResponse.json({ error: "Prix Stripe non configure pour ce plan" }, { status: 400 });
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;

    if (!itemId) {
      return NextResponse.json({ error: "Item d'abonnement introuvable" }, { status: 400 });
    }

    // Downgrade: applies at next renewal
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: itemId, price: String(newPriceId) }],
      proration_behavior: "create_prorations",
    });

    await supabase
      .from("subscriptions")
      .update({
        plan_id: newPlan.id,
        plan_slug: new_plan_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "update",
      entity_type: "subscription",
      entity_id: subscription.id,
      metadata: { from_plan: subscription.plan_slug ?? subscription.plan_id, to_plan: new_plan_id, type: "downgrade" },
      risk_level: "medium",
      success: true,
    });

    return NextResponse.json({ success: true, plan_id: new_plan_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
