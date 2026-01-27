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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";

/**
 * GET - Récupérer le compte Connect de l'utilisateur
 */
export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
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
        { error: "Seuls les propriétaires peuvent avoir un compte Connect" },
        { status: 403 }
      );
    }

    // Récupérer le compte Connect
    const { data: connectAccount } = await supabase
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
        connectAccount.stripe_account_id
      );

      // Mettre à jour les infos en DB si changement
      const serviceClient = createServiceRoleClient();
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
        .eq("id", connectAccount.id);

      return NextResponse.json({
        has_account: true,
        account: {
          id: connectAccount.id,
          stripe_account_id: connectAccount.stripe_account_id,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
          is_ready: connectService.isAccountReady(stripeAccount),
          requirements: stripeAccount.requirements,
          bank_account: stripeAccount.external_accounts?.data[0]
            ? {
                last4: stripeAccount.external_accounts.data[0].last4,
                bank_name: stripeAccount.external_accounts.data[0].bank_name,
              }
            : null,
          created_at: connectAccount.created_at,
          onboarding_completed_at: connectAccount.onboarding_completed_at,
        },
      });
    } catch (stripeError) {
      // Si erreur Stripe, retourner les données en cache
      return NextResponse.json({
        has_account: true,
        account: {
          id: connectAccount.id,
          stripe_account_id: connectAccount.stripe_account_id,
          charges_enabled: connectAccount.charges_enabled,
          payouts_enabled: connectAccount.payouts_enabled,
          details_submitted: connectAccount.details_submitted,
          is_ready:
            connectAccount.charges_enabled &&
            connectAccount.payouts_enabled &&
            connectAccount.details_submitted,
          bank_account: connectAccount.bank_account_last4
            ? {
                last4: connectAccount.bank_account_last4,
                bank_name: connectAccount.bank_account_bank_name,
              }
            : null,
          created_at: connectAccount.created_at,
          onboarding_completed_at: connectAccount.onboarding_completed_at,
          _cached: true,
        },
      });
    }
  } catch (error) {
    console.error("[Stripe Connect] Erreur GET:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST - Créer un compte Connect et démarrer l'onboarding
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
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
      .select("id, prenom, nom, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent créer un compte Connect" },
        { status: 403 }
      );
    }

    // Vérifier si un compte existe déjà
    const { data: existingAccount } = await supabase
      .from("stripe_connect_accounts")
      .select("id, stripe_account_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let stripeAccountId: string;

    if (existingAccount) {
      // Compte existe, générer un nouveau lien d'onboarding
      stripeAccountId = existingAccount.stripe_account_id;
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
      });

      stripeAccountId = stripeAccount.id;

      // Enregistrer en base de données
      const serviceClient = createServiceRoleClient();
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
        // Si erreur d'insertion, supprimer le compte Stripe
        await connectService.deleteConnectAccount(stripeAccountId).catch(() => {});
        throw new Error(`Erreur base de données: ${insertError.message}`);
      }
    }

    // Créer le lien d'onboarding
    const accountLink = await connectService.createAccountLink({
      accountId: stripeAccountId,
      refreshUrl: `${APP_URL}/owner/settings/payments?refresh=true`,
      returnUrl: `${APP_URL}/owner/settings/payments?success=true`,
      type: existingAccount ? "account_update" : "account_onboarding",
    });

    return NextResponse.json(
      {
        success: true,
        onboarding_url: accountLink.url,
        expires_at: accountLink.expires_at,
        is_new_account: !existingAccount,
      },
      { status: existingAccount ? 200 : 201 }
    );
  } catch (error) {
    console.error("[Stripe Connect] Erreur POST:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
