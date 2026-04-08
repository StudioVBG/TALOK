export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { ADDON_CONFIGS, getAddonPriceId, type AddonType } from "@/lib/subscriptions/addon-config";

const VALID_ADDON_TYPES: AddonType[] = [
  'signature_pack',
  'storage_20gb',
  'rar_electronic',
  'etat_date',
];

/**
 * POST /api/subscriptions/addons/purchase
 * Body: { addonType: AddonType, metadata?: Record<string, string> }
 *
 * Creates a Stripe Checkout Session for the requested add-on.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { addonType, metadata: extraMeta } = await request.json() as {
      addonType: string;
      metadata?: Record<string, string>;
    };

    if (!VALID_ADDON_TYPES.includes(addonType as AddonType)) {
      return NextResponse.json({ error: "Type d'add-on invalide" }, { status: 400 });
    }

    const typedAddon = addonType as AddonType;
    const config = ADDON_CONFIGS[typedAddon];

    // Retrieve profile + subscription to get stripe_customer_id
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: subscription } = await serviceSupabase
      .from("subscriptions")
      .select("stripe_customer_id, plan_slug")
      .eq("owner_id", profile.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Abonnement non trouvé. Les add-ons ne sont pas disponibles en plan gratuit." },
        { status: 403 }
      );
    }

    // Create pending addon record
    const { data: addon, error: insertError } = await serviceSupabase
      .from("subscription_addons")
      .insert({
        profile_id: profile.id,
        addon_type: typedAddon,
        quantity: config.defaultQuantity,
        status: "pending",
        metadata: extraMeta || {},
      })
      .select()
      .single();

    if (insertError || !addon) {
      throw insertError || new Error("Failed to create addon record");
    }

    const priceId = getAddonPriceId(typedAddon);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripe_customer_id,
      mode: config.mode as any,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/owner/settings/billing?addon=success&type=${typedAddon}`,
      cancel_url: `${baseUrl}/owner/settings/billing?addon=cancelled`,
      metadata: {
        addon_id: addon.id,
        addon_type: typedAddon,
        profile_id: profile.id,
      },
      automatic_tax: { enabled: true },
    });

    // Store checkout session id
    await serviceSupabase
      .from("subscription_addons")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", addon.id);

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error("[Addons Purchase]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
