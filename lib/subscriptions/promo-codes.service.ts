/**
 * Service codes promo — wrapper Stripe Coupons / Promotion Codes + miroir DB.
 *
 * Architecture : Option A de l'audit — Stripe = source de vérité, table
 * locale = cache + métadonnées Talok (territoires, plans éligibles,
 * first_subscription_only, raison).
 *
 * Flow création :
 *   1. stripe.coupons.create(...)           (source de vérité remise)
 *   2. stripe.promotionCodes.create(...)    (code texte → coupon)
 *   3. INSERT public.promo_codes(...)       (miroir + métadonnées Talok)
 *   4. Si l'étape 3 échoue, on archive les objets Stripe créés pour éviter
 *      d'avoir un coupon Stripe orphelin.
 *
 * Flow désactivation :
 *   1. UPDATE promo_codes SET is_active = false
 *   2. stripe.promotionCodes.update(id, { active: false })
 *      (on ne supprime jamais le Coupon : Stripe ne l'autorise pas s'il a
 *      été utilisé, et l'historique doit rester lisible.)
 */

import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import type { PlanSlug, BillingCycle } from "./plans";

export type PromoDiscountType = "percent" | "fixed";

export type Territory =
  | "metropole"
  | "martinique"
  | "guadeloupe"
  | "reunion"
  | "guyane"
  | "mayotte";

export interface CreatePromoInput {
  code: string;
  name?: string | null;
  description?: string | null;
  discount_type: PromoDiscountType;
  /** percent : 1–100 ; fixed : centimes EUR */
  discount_value: number;
  applicable_plans?: PlanSlug[];
  eligible_territories?: Territory[];
  min_billing_cycle?: BillingCycle | null;
  first_subscription_only?: boolean;
  max_uses?: number | null;
  max_uses_per_user?: number;
  valid_from?: string;
  valid_until?: string | null;
}

export interface PromoCodeRecord {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number;
  applicable_plans: string[];
  eligible_territories: string[];
  min_billing_cycle: "monthly" | "yearly" | null;
  first_subscription_only: boolean;
  max_uses: number | null;
  uses_count: number;
  max_uses_per_user: number;
  valid_from: string;
  valid_until: string | null;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Liste les codes (admin). Inclut archivés par défaut.
 */
export async function listPromoCodes(options?: {
  onlyActive?: boolean;
}): Promise<PromoCodeRecord[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.onlyActive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[promo-codes] listPromoCodes: ${error.message}`);
  }
  return (data ?? []) as unknown as PromoCodeRecord[];
}

/**
 * Convertit l'input Talok en payload Stripe Coupon.
 */
function buildStripeCouponParams(input: CreatePromoInput): Stripe.CouponCreateParams {
  const base: Stripe.CouponCreateParams = {
    // Les codes promo Talok s'appliquent une fois (remise sur la première
    // période facturée). Si un besoin "repeating" émerge, exposer un champ
    // duration dans le schéma et le mapper ici.
    duration: "once",
    name: input.name ?? input.code,
    metadata: {
      talok_code: input.code,
      talok_applicable_plans: (input.applicable_plans ?? []).join(","),
      talok_eligible_territories: (input.eligible_territories ?? []).join(","),
      talok_first_subscription_only: String(input.first_subscription_only ?? false),
    },
  };

  if (input.discount_type === "percent") {
    base.percent_off = input.discount_value;
  } else {
    base.amount_off = input.discount_value;
    base.currency = "eur";
  }

  if (input.max_uses != null) {
    base.max_redemptions = input.max_uses;
  }

  if (input.valid_until) {
    // Stripe attend un timestamp Unix en secondes.
    base.redeem_by = Math.floor(new Date(input.valid_until).getTime() / 1000);
  }

  return base;
}

/**
 * Crée un code promo : Stripe Coupon + Promotion Code + insert DB.
 * Rollback Stripe si l'insert DB échoue.
 */
export async function createPromoCode(
  input: CreatePromoInput,
  adminUserId: string
): Promise<PromoCodeRecord> {
  const code = input.code.trim().toUpperCase();

  // 1. Stripe Coupon
  const coupon = await stripe.coupons.create(buildStripeCouponParams(input));

  // 2. Stripe Promotion Code (lie le texte du code au coupon)
  let promotionCode: Stripe.PromotionCode;
  try {
    promotionCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
      active: true,
      max_redemptions: input.max_uses ?? undefined,
      expires_at: input.valid_until
        ? Math.floor(new Date(input.valid_until).getTime() / 1000)
        : undefined,
      metadata: {
        talok_code: code,
      },
    });
  } catch (err) {
    // Compensation : archive le coupon orphelin.
    await stripe.coupons.del(coupon.id).catch(() => {});
    throw err;
  }

  // 3. Insert DB
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      code,
      name: input.name ?? null,
      description: input.description ?? null,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      applicable_plans: input.applicable_plans ?? [],
      eligible_territories: input.eligible_territories ?? [],
      min_billing_cycle: input.min_billing_cycle ?? null,
      first_subscription_only: input.first_subscription_only ?? false,
      max_uses: input.max_uses ?? null,
      max_uses_per_user: input.max_uses_per_user ?? 1,
      valid_from: input.valid_from ?? new Date().toISOString(),
      valid_until: input.valid_until ?? null,
      stripe_coupon_id: coupon.id,
      stripe_promotion_code_id: promotionCode.id,
      is_active: true,
      created_by: adminUserId,
    })
    .select()
    .single();

  if (error) {
    // Compensation : désactive le Promotion Code et archive le Coupon.
    await stripe.promotionCodes.update(promotionCode.id, { active: false }).catch(() => {});
    await stripe.coupons.del(coupon.id).catch(() => {});
    throw new Error(`[promo-codes] createPromoCode insert: ${error.message}`);
  }

  return data as unknown as PromoCodeRecord;
}

/**
 * Archive un code promo : désactive côté Stripe + flag is_active=false.
 * Conserve l'historique pour l'admin. La route /api/admin/promo-codes/[id]
 * DELETE mappe sur cette fonction (pas de hard delete).
 */
export async function archivePromoCode(id: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("promo_codes")
    .select("id, stripe_promotion_code_id, is_active")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    throw new Error(`[promo-codes] archivePromoCode: code introuvable (${id})`);
  }

  // Stripe d'abord (si l'appel échoue on ne laisse pas la DB désynchronisée).
  const promotionCodeId = (existing as { stripe_promotion_code_id: string | null })
    .stripe_promotion_code_id;
  if (promotionCodeId) {
    try {
      await stripe.promotionCodes.update(promotionCodeId, { active: false });
    } catch (err) {
      // Si le Promotion Code n'existe plus côté Stripe on tolère (idempotence).
      const stripeErr = err as { code?: string };
      if (stripeErr.code !== "resource_missing") throw err;
    }
  }

  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`[promo-codes] archivePromoCode update: ${error.message}`);
  }
}

/**
 * Réactive un code archivé : remet is_active=true + active=true côté Stripe.
 * Nécessaire car le bouton UI est un toggle.
 */
export async function reactivatePromoCode(id: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("promo_codes")
    .select("id, stripe_promotion_code_id")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    throw new Error(`[promo-codes] reactivatePromoCode: code introuvable (${id})`);
  }

  const promotionCodeId = (existing as { stripe_promotion_code_id: string | null })
    .stripe_promotion_code_id;
  if (promotionCodeId) {
    await stripe.promotionCodes.update(promotionCodeId, { active: true });
  }

  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: true })
    .eq("id", id);

  if (error) {
    throw new Error(`[promo-codes] reactivatePromoCode update: ${error.message}`);
  }
}

/**
 * Contexte de validation d'un code promo au checkout.
 */
export interface ValidatePromoContext {
  plan_slug: PlanSlug;
  billing_cycle: BillingCycle;
  user_id: string;
  territoire?: Territory | null;
}

export interface ValidatePromoResult {
  valid: boolean;
  reason?: string;
  code?: PromoCodeRecord;
  stripe_promotion_code_id?: string | null;
}

/**
 * Valide un code promo pour un checkout donné.
 *
 * Vérifie : existence, actif, non expiré, quota global, plan éligible,
 * territoire éligible, cycle de facturation min, premier abonnement
 * (si flaggé), quota par utilisateur.
 *
 * Retourne l'ID du Promotion Code Stripe à passer dans
 * `checkout.sessions.create({ discounts: [{ promotion_code }] })`.
 */
export async function validatePromoCodeForCheckout(
  code: string,
  ctx: ValidatePromoContext
): Promise<ValidatePromoResult> {
  const supabase = createServiceRoleClient();

  const { data: promo, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .eq("is_active", true)
    .single();

  if (error || !promo) {
    return { valid: false, reason: "Code promo invalide ou archivé" };
  }

  const record = promo as unknown as PromoCodeRecord;
  const now = Date.now();

  if (record.valid_until && new Date(record.valid_until).getTime() < now) {
    return { valid: false, reason: "Code promo expiré" };
  }

  if (record.max_uses != null && record.uses_count >= record.max_uses) {
    return { valid: false, reason: "Code promo épuisé" };
  }

  if (record.applicable_plans.length > 0 && !record.applicable_plans.includes(ctx.plan_slug)) {
    return { valid: false, reason: "Code promo non applicable à ce plan" };
  }

  if (
    record.eligible_territories.length > 0 &&
    (!ctx.territoire || !record.eligible_territories.includes(ctx.territoire))
  ) {
    return { valid: false, reason: "Code promo non applicable à votre territoire" };
  }

  if (record.min_billing_cycle === "yearly" && ctx.billing_cycle === "monthly") {
    return {
      valid: false,
      reason: "Code promo réservé à un abonnement annuel",
    };
  }

  // Quota par utilisateur
  const { count: userUses } = await supabase
    .from("promo_code_uses")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", record.id)
    .eq("user_id", ctx.user_id);

  if (userUses != null && userUses >= record.max_uses_per_user) {
    return { valid: false, reason: "Vous avez déjà utilisé ce code promo" };
  }

  // Premier abonnement uniquement
  if (record.first_subscription_only) {
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("plan_slug, status")
      .eq("user_id", ctx.user_id)
      .maybeSingle();

    if (
      existingSub &&
      (existingSub as { plan_slug?: string }).plan_slug &&
      (existingSub as { plan_slug?: string }).plan_slug !== "starter" &&
      (existingSub as { plan_slug?: string }).plan_slug !== "gratuit"
    ) {
      return {
        valid: false,
        reason: "Code promo réservé aux nouveaux abonnés",
      };
    }
  }

  return {
    valid: true,
    code: record,
    stripe_promotion_code_id: record.stripe_promotion_code_id,
  };
}

/**
 * Enregistre l'utilisation d'un code promo : incrémente uses_count
 * + insère une ligne promo_code_uses. Appelé depuis le webhook
 * checkout.session.completed pour les sessions de subscription.
 */
export async function recordPromoCodeUse(params: {
  promo_code_id: string;
  user_id: string;
  subscription_id?: string | null;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  applied_plan_slug: string;
  applied_billing_cycle: "monthly" | "yearly";
  stripe_session_id: string;
}): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error: insertErr } = await supabase.from("promo_code_uses").insert({
    promo_code_id: params.promo_code_id,
    user_id: params.user_id,
    subscription_id: params.subscription_id ?? null,
    discount_amount: params.discount_amount,
    original_amount: params.original_amount,
    final_amount: params.final_amount,
    applied_plan_slug: params.applied_plan_slug,
    applied_billing_cycle: params.applied_billing_cycle,
    stripe_session_id: params.stripe_session_id,
  });

  if (insertErr) {
    throw new Error(`[promo-codes] recordPromoCodeUse insert: ${insertErr.message}`);
  }

  // uses_count est incrémenté automatiquement par le trigger
  // trg_promo_code_uses_increment (migration 20260422130000).
}
