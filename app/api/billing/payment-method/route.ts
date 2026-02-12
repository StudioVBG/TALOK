import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe-client";
import { headers } from "next/headers";

export async function POST() {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Chercher via user_id d'abord, puis owner_id via profile
    let stripeCustomerId: string | null = null;

    const { data: sub1 } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (sub1?.stripe_customer_id) {
      stripeCustomerId = sub1.stripe_customer_id;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        const { data: sub2 } = await supabase
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("owner_id", profile.id)
          .maybeSingle();
        stripeCustomerId = sub2?.stripe_customer_id || null;
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Aucun client Stripe associe. Souscrivez d'abord un forfait payant.", code: "NO_STRIPE_CUSTOMER" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (() => {
      const headersList = headers();
      const host = (headersList as any).get?.("host") || "localhost:3000";
      const protocol = host.includes("localhost") ? "http" : "https";
      return `${protocol}://${host}`;
    })();

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/owner/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
