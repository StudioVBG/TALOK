export const runtime = "nodejs";

/**
 * API Route pour récupérer le solde Stripe Connect
 *
 * GET /api/stripe/connect/balance - Récupère le solde disponible et en attente
 */

import { NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";
import { isStripeConfigurationError } from "@/lib/helpers/api-error";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET() {
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
        { error: "Seuls les propriétaires peuvent consulter leur solde" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect
    const { data: connectAccount, error: connectAccountError } = await serviceClient
      .from("stripe_connect_accounts")
      .select(
        "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_currently_due, requirements_past_due, requirements_disabled_reason"
      )
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (connectAccountError) {
      throw new Error(`Erreur lecture compte Connect: ${connectAccountError.message}`);
    }

    if (!connectAccount) {
      return NextResponse.json({
        available: 0,
        pending: 0,
        available_cents: 0,
        pending_cents: 0,
        currency: "eur",
        has_account: false,
        account_not_ready: true,
        missing_requirements: [],
        disabled_reason: null,
      });
    }

    const missingRequirements = [
      ...asStringArray(connectAccount.requirements_currently_due),
      ...asStringArray(connectAccount.requirements_past_due),
    ];

    if (
      !connectAccount.charges_enabled ||
      !connectAccount.payouts_enabled ||
      !connectAccount.details_submitted ||
      missingRequirements.length > 0
    ) {
      return NextResponse.json({
        available: 0,
        pending: 0,
        currency: "eur",
        has_account: true,
        account_not_ready: true,
        missing_requirements: missingRequirements,
        disabled_reason: connectAccount.requirements_disabled_reason ?? null,
      });
    }

    // Récupérer le solde depuis Stripe (avec fallback si le compte est restreint)
    let available = 0;
    let pending = 0;
    try {
      const balance = await connectService.getAccountBalance(connectAccount.stripe_account_id as string);
      available = balance.available.find((b) => b.currency === "eur")?.amount || 0;
      pending = balance.pending.find((b) => b.currency === "eur")?.amount || 0;
    } catch (balanceError) {
      console.warn("[Stripe Connect] Balance fetch failed for account, returning zeros:", balanceError);
      return NextResponse.json({
        available: 0,
        pending: 0,
        currency: "eur",
        has_account: true,
        balance_unavailable: true,
      });
    }

    return NextResponse.json({
      available: available / 100, // Convertir en euros
      pending: pending / 100,
      available_cents: available,
      pending_cents: pending,
      currency: "eur",
      has_account: true,
    });
  } catch (error) {
    console.error("[Stripe Connect] Erreur balance:", error);

    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        {
          error:
            "Le solde Stripe est temporairement indisponible. Vérifiez la configuration Stripe ou réessayez plus tard.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de récupérer le solde Stripe pour le moment",
      },
      { status: 502 }
    );
  }
}
