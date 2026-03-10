/**
 * Sync Property Billing to Stripe
 * Met à jour le subscription item "biens supplémentaires" dans Stripe
 * quand le nombre de propriétés d'un owner change.
 */

import { stripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase/service-client";
import { PLANS, type PlanSlug } from "@/lib/subscriptions/plans";
import type Stripe from "stripe";

/**
 * Synchronise la facturation des biens supplémentaires avec Stripe.
 * Appelé après création/suppression d'un bien ou changement de plan.
 *
 * - Calcule le nombre de biens au-delà du quota inclus
 * - Crée, met à jour ou supprime le subscription item Stripe correspondant
 * - Non-bloquant : les erreurs sont loguées mais ne propagent pas
 */
export async function syncPropertyBillingToStripe(ownerId: string): Promise<void> {
  const serviceClient = getServiceClient();

  // 1. Récupérer la subscription
  const { data: subscription, error: subError } = await serviceClient
    .from("subscriptions")
    .select("id, stripe_subscription_id, plan_slug, properties_count")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (subError || !subscription?.stripe_subscription_id) {
    // Pas de subscription Stripe (plan gratuit ou pas encore abonné) → rien à faire
    return;
  }

  const planSlug = (subscription.plan_slug || "gratuit") as PlanSlug;
  const planConfig = PLANS[planSlug];

  if (!planConfig || planConfig.limits.extra_property_price <= 0) {
    // Ce plan ne facture pas de biens supplémentaires
    return;
  }

  // 2. Compter les propriétés actives
  const { count: propertiesCount } = await serviceClient
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("deleted_at", null);

  const currentCount = propertiesCount || 0;
  const includedProperties = planConfig.limits.included_properties;
  const extraCount = Math.max(0, currentCount - includedProperties);
  const extraPriceCents = planConfig.limits.extra_property_price;

  // 3. Récupérer la subscription Stripe et chercher l'item extra_properties
  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  } catch (err) {
    console.error("[syncPropertyBilling] Error retrieving Stripe subscription:", err);
    return;
  }

  if (stripeSub.status === "canceled" || stripeSub.status === "incomplete_expired") {
    return;
  }

  // Chercher l'item "extra_properties" via metadata
  const existingItem = stripeSub.items.data.find(
    (item) => item.metadata?.type === "extra_properties"
  );

  // 4. Récupérer ou créer le Stripe Price ID pour les biens supplémentaires
  let extraPriceId: string | null = null;

  // Chercher dans subscription_plans
  const { data: planRow } = await serviceClient
    .from("subscription_plans")
    .select("stripe_price_extra_property_id, stripe_product_id")
    .eq("slug", planSlug)
    .maybeSingle();

  if (planRow?.stripe_price_extra_property_id) {
    extraPriceId = planRow.stripe_price_extra_property_id;
  }

  // 5. Appliquer la logique de sync
  if (extraCount > 0) {
    if (!extraPriceId) {
      // Créer un prix Stripe ad-hoc si pas encore configuré
      try {
        const productId = planRow?.stripe_product_id;
        const price = await stripe.prices.create({
          currency: "eur",
          unit_amount: extraPriceCents,
          recurring: { interval: "month" },
          product: productId || undefined,
          ...(productId
            ? {}
            : {
                product_data: {
                  name: `Bien supplémentaire - ${planConfig.name}`,
                },
              }),
          metadata: {
            plan_slug: planSlug,
            type: "extra_property",
          },
        });
        extraPriceId = price.id;

        // Sauvegarder le price ID pour le réutiliser
        await serviceClient
          .from("subscription_plans")
          .update({ stripe_price_extra_property_id: price.id })
          .eq("slug", planSlug);
      } catch (err) {
        console.error("[syncPropertyBilling] Error creating Stripe price:", err);
        return;
      }
    }

    if (!existingItem) {
      // Créer un nouvel item
      try {
        await stripe.subscriptionItems.create({
          subscription: subscription.stripe_subscription_id,
          price: extraPriceId,
          quantity: extraCount,
          proration_behavior: "create_prorations",
          metadata: { type: "extra_properties" },
        });
        console.log(
          `[syncPropertyBilling] Created extra_properties item: quantity=${extraCount} for owner=${ownerId}`
        );
      } catch (err) {
        console.error("[syncPropertyBilling] Error creating subscription item:", err);
        return;
      }
    } else if (existingItem.quantity !== extraCount) {
      // Mettre à jour la quantity
      try {
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: extraCount,
          proration_behavior: "create_prorations",
        });
        console.log(
          `[syncPropertyBilling] Updated extra_properties item: quantity=${extraCount} for owner=${ownerId}`
        );
      } catch (err) {
        console.error("[syncPropertyBilling] Error updating subscription item:", err);
        return;
      }
    }
    // else: quantity already correct, nothing to do
  } else if (existingItem) {
    // Plus de biens supplémentaires → supprimer l'item
    try {
      await stripe.subscriptionItems.del(existingItem.id, {
        proration_behavior: "create_prorations",
      });
      console.log(
        `[syncPropertyBilling] Removed extra_properties item for owner=${ownerId}`
      );
    } catch (err) {
      console.error("[syncPropertyBilling] Error deleting subscription item:", err);
      return;
    }
  }

  // 6. Mettre à jour properties_count en DB
  await serviceClient
    .from("subscriptions")
    .update({
      properties_count: currentCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);
}
