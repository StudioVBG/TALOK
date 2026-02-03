export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/promo/validate
 * Valide un code promo
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PLANS, type PlanSlug, formatPrice } from "@/lib/subscriptions/plans";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { code, plan_slug, billing_cycle } = body;

    if (!code) {
      return NextResponse.json({ error: "Code promo requis" }, { status: 400 });
    }

    // Récupérer le code promo
    const { data: promo, error } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();

    if (error || !promo) {
      return NextResponse.json({ 
        valid: false, 
        error: "Code promo invalide ou expiré" 
      });
    }

    // Vérifications
    const now = new Date();

    // Vérifier la validité temporelle
    if (promo.valid_until && new Date(promo.valid_until as string) < now) {
      return NextResponse.json({ 
        valid: false, 
        error: "Ce code promo a expiré" 
      });
    }

    // Vérifier les utilisations max
    if (promo.max_uses && (promo.uses_count as number) >= (promo.max_uses as number)) {
      return NextResponse.json({ 
        valid: false, 
        error: "Ce code promo a atteint sa limite d'utilisation" 
      });
    }

    // Vérifier les plans applicables
    if (promo.applicable_plans && (promo.applicable_plans as any[]).length > 0 && plan_slug) {
      if (!(promo.applicable_plans as any[]).includes(plan_slug)) {
        return NextResponse.json({ 
          valid: false, 
          error: "Ce code n'est pas valide pour ce plan" 
        });
      }
    }

    // Vérifier le cycle de facturation minimum
    if (promo.min_billing_cycle === "yearly" && billing_cycle === "monthly") {
      return NextResponse.json({ 
        valid: false, 
        error: "Ce code est valide uniquement pour l'abonnement annuel" 
      });
    }

    // Vérifier l'utilisation par utilisateur
    const { count: userUses } = await supabase
      .from("promo_code_uses")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", promo.id as string)
      .eq("user_id", user.id);

    if (userUses && userUses >= (promo.max_uses_per_user as number)) {
      return NextResponse.json({ 
        valid: false, 
        error: "Vous avez déjà utilisé ce code promo" 
      });
    }

    // Vérifier si c'est pour les nouveaux clients uniquement
    if (promo.first_subscription_only) {
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_slug")
        .eq("user_id", user.id)
        .single();

      if (subscription && subscription.plan_slug !== "starter") {
        return NextResponse.json({ 
          valid: false, 
          error: "Ce code est réservé aux nouveaux abonnés" 
        });
      }
    }

    // Calculer la réduction
    let discountAmount = 0;
    let originalPrice = 0;
    let finalPrice = 0;

    if (plan_slug && billing_cycle) {
      const plan = PLANS[plan_slug as PlanSlug];
      originalPrice = billing_cycle === "yearly" ? (plan.price_yearly || 0) : (plan.price_monthly || 0);

      if (promo.discount_type === "percent") {
        discountAmount = Math.round(originalPrice * ((promo.discount_value as number) / 100));
      } else {
        discountAmount = promo.discount_value as number;
      }

      finalPrice = Math.max(0, originalPrice - discountAmount);
    }

    return NextResponse.json({
      valid: true,
      code: {
        id: promo.id,
        code: promo.code,
        name: promo.name,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
      },
      discount: {
        amount: discountAmount,
        formatted: formatPrice(discountAmount),
        percentage: promo.discount_type === "percent" ? promo.discount_value : null,
      },
      pricing: plan_slug && billing_cycle ? {
        original: originalPrice,
        original_formatted: formatPrice(originalPrice),
        final: finalPrice,
        final_formatted: formatPrice(finalPrice),
        savings: discountAmount,
        savings_formatted: formatPrice(discountAmount),
      } : null,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Promo Validate]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

