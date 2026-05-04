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
import { PLAN_LIMITS } from "@/lib/subscriptions/plan-limits";
import { resolveCurrentPlan } from "@/lib/subscriptions/resolve-current-plan";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
const CONNECT_CONFLICT_RETRY_ERROR =
  "Un compte bancaire existe deja pour ce profil. Reprise de l'onboarding impossible pour le moment, veuillez reessayer.";
const CONNECT_SETUP_ERROR =
  "Impossible de configurer le compte bancaire pour le moment. Veuillez reessayer.";
type StoredConnectAccountReference = {
  id: string;
  stripe_account_id: string;
};

type DatabaseErrorLike = {
  code?: string;
  message?: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeStoredConnectAccount(account: unknown): StoredConnectAccount {
  const record =
    account && typeof account === "object" ? (account as Record<string, unknown>) : {};

  return {
    id: typeof record.id === "string" ? record.id : "",
    stripe_account_id:
      typeof record.stripe_account_id === "string" ? record.stripe_account_id : "",
    charges_enabled:
      typeof record.charges_enabled === "boolean" ? record.charges_enabled : false,
    payouts_enabled:
      typeof record.payouts_enabled === "boolean" ? record.payouts_enabled : false,
    details_submitted:
      typeof record.details_submitted === "boolean" ? record.details_submitted : false,
    requirements_currently_due: asStringArray(record.requirements_currently_due),
    requirements_eventually_due: asStringArray(record.requirements_eventually_due),
    requirements_past_due: asStringArray(record.requirements_past_due),
    requirements_disabled_reason:
      typeof record.requirements_disabled_reason === "string"
        ? record.requirements_disabled_reason
        : null,
    bank_account_last4:
      typeof record.bank_account_last4 === "string" ? record.bank_account_last4 : null,
    bank_account_bank_name:
      typeof record.bank_account_bank_name === "string"
        ? record.bank_account_bank_name
        : null,
    created_at: typeof record.created_at === "string" ? record.created_at : null,
    onboarding_completed_at:
      typeof record.onboarding_completed_at === "string"
        ? record.onboarding_completed_at
        : null,
  };
}

function isUniqueProfileConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as DatabaseErrorLike;
  const normalizedMessage = candidate.message?.toLowerCase() ?? "";

  return (
    candidate.code === "23505" ||
    normalizedMessage.includes("unique_profile_connect") ||
    normalizedMessage.includes("duplicate key value")
  );
}

function toSafePostConnectErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === CONNECT_CONFLICT_RETRY_ERROR || error.message === CONNECT_SETUP_ERROR) {
      return error.message;
    }
  }

  return CONNECT_SETUP_ERROR;
}

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

  if (!profile || !["owner", "syndic", "provider"].includes(profile.role)) {
    return {
      error: NextResponse.json(
        {
          error:
            "Seuls les propriétaires, syndics et prestataires peuvent avoir un compte Connect",
        },
        { status: 403 }
      ),
    };
  }

  return { supabase, user, profile };
}

async function getStoredConnectAccountReference(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  entityId?: string | null
): Promise<StoredConnectAccountReference | null> {
  // S2-2 : filtrer par entité juridique si fournie, sinon compte personnel.
  // Depuis la migration 20260412100000 un même profile_id peut avoir plusieurs
  // comptes Connect (un personnel + plusieurs scopés par entité juridique).
  let query = serviceClient
    .from("stripe_connect_accounts")
    .select("id, stripe_account_id")
    .eq("profile_id", profileId);

  if (entityId) {
    query = query.eq("entity_id", entityId);
  } else {
    query = query.is("entity_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Erreur lecture compte Connect: ${error.message}`);
  }

  if (!data?.stripe_account_id) {
    return null;
  }

  return {
    id: data.id as string,
    stripe_account_id: data.stripe_account_id as string,
  };
}

/**
 * GET - Récupérer le compte Connect de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedOwnerProfile();
    if (auth.error) {
      return auth.error;
    }

    const { profile } = auth;
    const serviceClient = createServiceRoleClient();
    const entityId = new URL(request.url).searchParams.get("entityId") || undefined;

    // Récupérer le compte Connect (personnel ou scopé par entité)
    let connectQuery = serviceClient
      .from("stripe_connect_accounts")
      .select("*")
      .eq("profile_id", profile.id);

    if (entityId) {
      connectQuery = connectQuery.eq("entity_id", entityId);
    } else {
      connectQuery = connectQuery.is("entity_id", null);
    }

    const { data: connectAccount } = await connectQuery.maybeSingle();

    if (!connectAccount) {
      return NextResponse.json({
        has_account: false,
        account: null,
      });
    }

    const storedConnectAccount = normalizeStoredConnectAccount(connectAccount);

    // Rafraîchir les infos depuis Stripe
    try {
      const stripeAccount = await connectService.getConnectAccount(
        storedConnectAccount.stripe_account_id
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
              ? storedConnectAccount.onboarding_completed_at || new Date().toISOString()
              : null,
        })
        .eq("id", storedConnectAccount.id);

      return NextResponse.json(
        buildConnectAccountResponse(
          {
            ...storedConnectAccount,
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
        buildConnectAccountResponse(storedConnectAccount, null, {
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

    const body = await request.json().catch(() => ({}));
    const entityId: string | undefined = body.entityId || undefined;

    // Plan gating : la création d'un compte scopé à une entité juridique
    // requiert un plan supportant le multi-entité (Confort+ pour les owners).
    // Les syndics sont exemptés (obligation légale ALUR de séparation des comptes
    // par copropriété) ; les comptes personnels (entityId vide) restent ouverts à tous.
    if (entityId && profile.role === "owner") {
      const { data: subscription } = await serviceClient
        .from("subscriptions")
        .select("plan_slug")
        .eq("profile_id", profile.id)
        .maybeSingle();

      const planSlug = resolveCurrentPlan(subscription?.plan_slug as string | undefined);
      if (!PLAN_LIMITS[planSlug].hasMultiEntity) {
        return NextResponse.json(
          {
            error:
              "La gestion multi-entités (SCI) est disponible à partir du plan Confort.",
            upgrade_required: true,
            feature: "hasMultiEntity",
          },
          { status: 402 }
        );
      }
    }

    // Vérifier si un compte existe déjà (personnel ou scopé par entité)
    const existingAccount = await getStoredConnectAccountReference(
      serviceClient,
      profile.id,
      entityId
    );

    let stripeAccountId: string;
    let hasExistingAccount = Boolean(existingAccount);
    let createdStripeAccountId: string | null = null;

    if (existingAccount) {
      // Compte existe, générer un nouveau lien d'onboarding
      stripeAccountId = existingAccount.stripe_account_id as string;
    } else {
      // Créer un nouveau compte Stripe Connect
      const businessType = body.business_type || "individual";

      const stripeAccount = await connectService.createConnectAccount({
        email: user.email!,
        country: "FR",
        businessType,
        metadata: {
          profile_id: profile.id,
          talok_user_id: user.id,
        },
        idempotencyKey: entityId
          ? `connect-account:${profile.id}:${entityId}`
          : `owner-connect-account:${profile.id}`,
      });

      stripeAccountId = stripeAccount.id;
      createdStripeAccountId = stripeAccount.id;

      // Enregistrer en base de données (personnel ou scopé par entité)
      const insertPayload: Record<string, any> = {
        profile_id: profile.id,
        stripe_account_id: stripeAccountId,
        account_type: "express",
        business_type: businessType,
        country: "FR",
      };
      if (entityId) {
        insertPayload.entity_id = entityId;
      }

      const { error: insertError } = await serviceClient
        .from("stripe_connect_accounts")
        .insert(insertPayload);

      if (insertError) {
        if (isUniqueProfileConflict(insertError)) {
          hasExistingAccount = true;
        } else {
          // Si erreur d'insertion, supprimer le compte Stripe
          await Promise.resolve(connectService.deleteConnectAccount(stripeAccountId)).catch(() => {});
          throw new Error(CONNECT_SETUP_ERROR);
        }
      }

      const persistedAccount = await getStoredConnectAccountReference(
        serviceClient,
        profile.id,
        entityId
      );

      if (!persistedAccount?.stripe_account_id) {
        if (createdStripeAccountId) {
          await Promise.resolve(connectService.deleteConnectAccount(createdStripeAccountId)).catch(
            () => {}
          );
        }

        throw new Error(
          hasExistingAccount ? CONNECT_CONFLICT_RETRY_ERROR : CONNECT_SETUP_ERROR
        );
      }

      stripeAccountId = persistedAccount.stripe_account_id;
      hasExistingAccount =
        hasExistingAccount ||
        persistedAccount.stripe_account_id !== createdStripeAccountId;

      if (
        createdStripeAccountId &&
        persistedAccount.stripe_account_id !== createdStripeAccountId
      ) {
        await Promise.resolve(
          connectService.deleteConnectAccount(createdStripeAccountId)
        )
          .catch((cleanupError) => {
            console.warn(
              "[Stripe Connect] Impossible de supprimer le compte orphelin après conflit:",
              cleanupError
            );
          });
      }
    }

    // Créer le lien d'onboarding
    // Le returnBase dépend du rôle : provider revient sur sa page payouts,
    // syndic sur ses paramètres Connect (si scoping par entité), owner par
    // défaut sur sa page money/banque.
    let returnBase: string;
    if (entityId) {
      returnBase = `${APP_URL}/syndic/settings/connect`;
    } else if (profile.role === "provider") {
      returnBase = `${APP_URL}/provider/settings/payouts`;
    } else {
      returnBase = `${APP_URL}/owner/money?tab=banque`;
    }
    const querySeparator = returnBase.includes("?") ? "&" : "?";
    const accountLink = await connectService.createAccountLink({
      accountId: stripeAccountId,
      refreshUrl: `${returnBase}${querySeparator}refresh=true`,
      returnUrl: `${returnBase}${querySeparator}success=true`,
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
    console.error("[Stripe Connect] Erreur POST:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // If Stripe is not configured, return a user-friendly error instead of 500
    if (isStripeConfigurationError(error)) {
      return NextResponse.json(
        { error: "Le paiement en ligne n'est pas encore configuré. Contactez l'administrateur." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: toSafePostConnectErrorMessage(error) },
      { status: 500 }
    );
  }
}
