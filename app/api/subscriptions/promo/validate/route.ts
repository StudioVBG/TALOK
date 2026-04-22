export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/subscriptions/promo/validate
 *
 * Valide un code promo côté pricing/signup. Utilisé par le composant
 * <PromoCodeField /> avant de déclencher le checkout.
 *
 * Body : { code, plan_slug, billing_cycle }
 * Res  : { valid: boolean, reason?: string, pricing?: {...} }
 */

import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  validatePromoCodeForCheckout,
  type Territory,
} from "@/lib/subscriptions/promo-codes.service";
import { PLANS, type PlanSlug } from "@/lib/subscriptions/plans";

const VALID_TERRITORIES: Territory[] = [
  "metropole",
  "martinique",
  "guadeloupe",
  "reunion",
  "guyane",
  "mayotte",
];

function isTerritory(value: unknown): value is Territory {
  return typeof value === "string" && (VALID_TERRITORIES as string[]).includes(value);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { code, plan_slug, billing_cycle } = body as {
      code?: string;
      plan_slug?: PlanSlug;
      billing_cycle?: "monthly" | "yearly";
    };

    if (!code || !plan_slug || !billing_cycle) {
      return NextResponse.json(
        { error: "code, plan_slug et billing_cycle requis" },
        { status: 400 }
      );
    }

    // Résolution du territoire : on lit la colonne subscriptions.territoire
    // si le user a déjà une souscription, sinon 'metropole' par défaut
    // (les codes sans contrainte territoire passent quand même).
    const service = createServiceRoleClient();
    const { data: sub } = await service
      .from("subscriptions")
      .select("territoire")
      .eq("user_id", user.id)
      .maybeSingle();

    const rawTerritoire = (sub as { territoire?: unknown } | null)?.territoire;
    const territoire: Territory = isTerritory(rawTerritoire)
      ? rawTerritoire
      : "metropole";

    const result = await validatePromoCodeForCheckout(code, {
      plan_slug,
      billing_cycle,
      user_id: user.id,
      territoire,
    });

    if (!result.valid || !result.code) {
      return NextResponse.json({
        valid: false,
        error: result.reason ?? "Code promo invalide",
      });
    }

    // Calcul du prix affiché côté client (centimes).
    const plan = PLANS[plan_slug];
    const originalPrice =
      billing_cycle === "yearly" ? plan.price_yearly ?? 0 : plan.price_monthly ?? 0;

    const discountAmount =
      result.code.discount_type === "percent"
        ? Math.round(originalPrice * (result.code.discount_value / 100))
        : Math.min(result.code.discount_value, originalPrice);

    const finalPrice = Math.max(0, originalPrice - discountAmount);

    return NextResponse.json({
      valid: true,
      code: {
        id: result.code.id,
        code: result.code.code,
        name: result.code.name,
        discount_type: result.code.discount_type,
        discount_value: result.code.discount_value,
      },
      pricing: {
        original: originalPrice,
        discount: discountAmount,
        final: finalPrice,
      },
      territoire,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur serveur";
    console.error("[promo/validate]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
