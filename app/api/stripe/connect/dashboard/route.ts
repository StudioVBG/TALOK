export const runtime = "nodejs";

/**
 * API Route pour accéder au dashboard Stripe Express
 *
 * POST /api/stripe/connect/dashboard - Génère un lien vers le dashboard Stripe
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";

export async function POST() {
  try {
    const supabase = await createRouteHandlerClient();
    const serviceClient = createServiceRoleClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent accéder au dashboard" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect personnel (S2-2 : entity_id IS NULL)
    const { data: connectAccount } = await serviceClient
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_currently_due, requirements_past_due, requirements_disabled_reason"
      )
      .eq("profile_id", profile.id)
      .is("entity_id", null)
      .maybeSingle();

    if (!connectAccount) {
      return NextResponse.json(
        { error: "Aucun compte Stripe Connect configuré" },
        { status: 404 }
      );
    }

    const missingRequirements = [
      ...((connectAccount.requirements_currently_due as string[] | null) ?? []),
      ...((connectAccount.requirements_past_due as string[] | null) ?? []),
    ];

    if (
      !connectAccount.charges_enabled ||
      !connectAccount.payouts_enabled ||
      !connectAccount.details_submitted ||
      missingRequirements.length > 0
    ) {
      return NextResponse.json(
        {
          error: "Votre compte Stripe Connect n'est pas encore activé. Terminez l'onboarding.",
          account_not_ready: true,
          missing_requirements: missingRequirements,
          disabled_reason: connectAccount.requirements_disabled_reason ?? null,
        },
        { status: 409 }
      );
    }

    // Créer le lien de dashboard
    const loginLink = await connectService.createLoginLink(connectAccount.stripe_account_id as string);

    return NextResponse.json({
      success: true,
      dashboard_url: loginLink.url,
    });
  } catch (error) {
    console.error("[Stripe Connect] Erreur dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
