export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

/**
 * POST /api/subscriptions/addons/cancel
 * Body: { addonId: string }
 *
 * Cancels a recurring add-on (storage_20gb) by cancelling the Stripe subscription.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const serviceSupabase = createServiceRoleClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { addonId } = await request.json() as { addonId: string };

    if (!addonId) {
      return NextResponse.json({ error: "addonId requis" }, { status: 400 });
    }

    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Fetch the addon and verify ownership
    const { data: addon, error: fetchError } = await serviceSupabase
      .from("subscription_addons")
      .select("*")
      .eq("id", addonId)
      .eq("profile_id", profile.id)
      .single();

    if (fetchError || !addon) {
      return NextResponse.json({ error: "Add-on non trouvé" }, { status: 404 });
    }

    if (addon.status !== "active") {
      return NextResponse.json({ error: "Cet add-on n'est pas actif" }, { status: 400 });
    }

    if (!addon.stripe_subscription_id) {
      // Non-recurring addon — just mark cancelled directly
      await serviceSupabase
        .from("subscription_addons")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", addonId);

      return NextResponse.json({ cancelled: true });
    }

    // Cancel the Stripe subscription (which will trigger the webhook)
    await stripe.subscriptions.cancel(addon.stripe_subscription_id);

    return NextResponse.json({ cancelled: true });
  } catch (error: unknown) {
    console.error("[Addons Cancel]", error);
    return NextResponse.json(
      { error: extractErrorMessage(error) },
      { status: 500 }
    );
  }
}
