export const runtime = "nodejs";

/**
 * API Routes pour Stripe Connect
 *
 * GET  /api/stripe/connect - Récupérer le compte Connect de l'utilisateur
 * POST /api/stripe/connect - Créer un compte Connect et démarrer l'onboarding
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient, createServiceRoleClient } from "@/lib/supabase/server";
import { connectService } from "@/lib/stripe/connect.service";
import { isStripeConfigurationError } from "@/lib/helpers/api-error";
import {
  buildConnectAccountResponse,
  type StoredConnectAccount,
} from "@/lib/stripe/connect-account";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";

async function getAuthenticatedOwnerProfile() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Seuls les propriétaires peuvent avoir un compte Connect" },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, profile };
}

/**
 * GET - Récupérer le compte Connect de l'utilisateur
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedOwnerProfile();
    if (auth.error) {
      return auth.error;
    }

    const { profile } = auth;
    const serviceClient = createServiceRoleClient();

    // Récupérer le compte Connect
    const { data: connectAccount } = await serviceClient
      .from("stripe_connect_accounts")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!connectAccount) {
      return NextResponse.json({
        has_account: false,
        account: null,
      });
    }

    // Rafraîchir les infos depuis Stripe
    try {
      const stripeAccount = await connectService.getConnectAccount(
        connectAccount.stripe_account_id as string
      );

      // Mettre à jour les infos en DB si changement
      await serviceClient
        .from("stripe_connect_accounts")
        .update({
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
          requirements_currently_due: stripeAccount.requirements?.currently_due || [],
          requirements_eventually_due: stripeAccount.requirements?.eventually_due || [],
          requirements_past_due: stripeAccount.requirements?.past_due || [],
          requirements_disabled_reason: stripeAccount.requirements?.disabled_reason,
          bank_account_last4: stripeAccount.external_accounts?.data[0]?.last4,
          bank_account_bank_name: stripeAccount.external_accounts?.data[0]?.bank_name,
          updated_at: new Date().toISOString(),
          onboarding_completed_at:
            stripeAccount.charges_enabled && stripeAccount.payouts_enabled
              ? connectAccount.onboarding_completed_at || new Date().toISOString()
              : null,
        })
        .eq("id", connectAccount.id as string);

      return NextResponse.json(
        buildConnectAccountResponse(
          {
            ...(connectAccount as StoredConnectAccount),
            charges_enabled: stripeAccount.charges_enabled,
            payouts_enabled: stripeAccount.payouts_enabled,
            details_submitted: stripeAccount.details_submitted,
            requirements_currently_due: stripeAccount.requirements?.currently_due ?? [],
            requirements_eventually_due: stripeAccount.requirements?.eventually_due ?? [],
            requirements_past_due: stripeAccount.requirements?.past_due ?? [],
            requirements_disabled_reason: stripeAccount.requirements?.disabled_reason,
            bank_account_last4: stripeAccount.external_accounts?.data[0]?.last4,
            bank_account_bank_name: stripeAccount.external_accounts?.data[0]?.bank_name,
          },
          stripeAccount
        )
      );
    } catch (stripeError) {
      // Si erreur Stripe, retourner les données en cache
      return NextResponse.json(
        buildConnectAccountResponse(connectAccount as StoredConnectAccount, null, {
          cached: true,
        })
      );
    }
  } catch (error) {
    console.error("[Stripe Connect] Erreur GET:", error);

    // If Stripe is not configured, return a clean "no account" response instead of 500
    if (isStripeConfigurationError(error)) {
      return NextResponse.json({
        has_account: false,
        account: null,
        not_configured: true,
      });
    }

    const errorMessage = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: errorMessage || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST - Créer un compte Connect et démarrer l'onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOwnerProfile();
    if (auth.error) {
      return auth.error;
    }

    const { profile, user } = auth;
    const serviceClient = createServiceRoleClient();

    // Vérifier si un compte existe déjà
    const { data: existingAccount } = await serviceClient
      .from("stripe_connect_accounts")
      .select("id, stripe_account_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let stripeAccountId: string;
    let hasExistingAccount = Boolean(existingAccount);

    if (existingAccount) {
      // Compte existe, générer un nouveau lien d'onboarding
      stripeAccountId = existingAccount.stripe_account_id as string;
    } else {
      // Créer un nouveau compte Stripe Connect
      const body = await request.json().catch(() => ({}));
      const businessType = body.business_type || "individual";

      const stripeAccount = await connectService.createConnectAccount({
        email: user.email!,
        country: "FR",
        businessType,
        metadata: {
          profile_id: profile.id,
          talok_user_id: user.id,
        },
        idempotencyKey: `owner-connect-account:${profile.id}`,
      });

      stripeAccountId = stripeAccount.id;

      // Enregistrer en base de données
      const { error: insertError } = await serviceClient
        .from("stripe_connect_accounts")
        .insert({
          profile_id: profile.id,
          stripe_account_id: stripeAccountId,
          account_type: "express",
          business_type: businessType,
          country: "FR",
        });

      if (insertError) {
        if ((insertError as { code?: string }).code === "23505") {
          const { data: conflictAccount } = await serviceClient
            .from("stripe_connect_accounts")
            .select("id, stripe_account_id")
            .eq("profile_id", profile.id)
            .maybeSingle();

          if (conflictAccount?.stripe_account_id) {
            stripeAccountId = conflictAccount.stripe_account_id as string;
            hasExistingAccount = true;
          } else {
            await connectService.deleteConnectAccount(stripeAccountId).catch(() => {});
            throw new Error("Conflit de creation du compte Connect sans compte recuperable");
          }
        } else {
          // Si erreur d'insertion, supprimer le compte Stripe
          await connectService.deleteConnectAccount(stripeAccountId).catch(() => {});
          throw new Error(`Erreur base de données: ${insertError.message}`);
        }
      }
    }

    // Créer le lien d'onboarding
    const accountLink = await connectService.createAccountLink({
      accountId: stripeAccountId,
      refreshUrl: `${APP_URL}/owner/money?tab=banque&refresh=true`,
      returnUrl: `${APP_URL}/owner/money?tab=banque&success=true`,
      type: hasExistingAccount ? "account_update" : "account_onboarding",
    });

    return NextResponse.json(
      {
        success: true,
        onboarding_url: accountLink.url,
        expires_at: accountLink.expires_at,
        is_new_account: !hasExistingAccount,
      },
      { status: hasExistingAccount ? 200 : 201 }
    );
  } catch (error) {
    console.error("[Stripe Connect] Erreur POST:", error);

    // If Stripe is not configured, return a user-friendly error instead of 500
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré. Contactez l'administrateur." },
        { status: 503 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { error: errorMessage || "Erreur serveur" },
      { status: 500 }
    );
  }
}
