export const runtime = "nodejs";

/**
 * API Route pour accéder au dashboard Stripe Express
 *
 * POST /api/stripe/connect/dashboard - Génère un lien vers le dashboard Stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";

export async function POST(request: NextRequest) {
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

    if (!profile || !["owner", "syndic"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Seuls les propriétaires et syndics peuvent accéder au dashboard" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const entityId: string | undefined = body.entityId || undefined;

    // Récupérer le compte Connect (personnel ou scopé par entité)
    let connectQuery = serviceClient
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_currently_due, requirements_past_due, requirements_disabled_reason"
      )
      .eq("profile_id", profile.id);

    if (entityId) {
      connectQuery = connectQuery.eq("entity_id", entityId);
    } else {
      connectQuery = connectQuery.is("entity_id", null);
    }

    const { data: connectAccount } = await connectQuery.maybeSingle();

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
