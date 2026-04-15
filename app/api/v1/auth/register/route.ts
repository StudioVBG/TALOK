export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/app/api/_lib/supabase";
import { apiError, apiSuccess, validateBody, logAudit } from "@/lib/api/middleware";
import { RegisterSchema } from "@/lib/api/schemas";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { getAuthCallbackUrl } from "@/lib/utils/redirect-url";

/**
 * POST /api/v1/auth/register
 * Register a new user account
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3 inscriptions par heure par IP
    const rateLimitResponse = await applyRateLimit(request, "signup");
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();

    // Verify Turnstile CAPTCHA token
    const turnstileResult = await verifyTurnstileToken(body.turnstileToken);
    if (!turnstileResult.success) {
      return apiError(turnstileResult.error || "Vérification anti-spam échouée", 400, "CAPTCHA_FAILED");
    }

    const { data, error: validationError } = validateBody(RegisterSchema, body);

    if (validationError) return validationError;

    const supabase = await createClient();

    // Create auth user
    // Le trigger handle_new_user créera automatiquement le profil via ON CONFLICT
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: data.role,
          prenom: data.prenom,
          nom: data.nom,
          telephone: data.telephone ?? undefined,
        },
        emailRedirectTo: getAuthCallbackUrl(process.env.NEXT_PUBLIC_APP_URL),
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return apiError("Email déjà utilisé", 409, "EMAIL_EXISTS");
      }
      return apiError(authError.message, 400, "AUTH_ERROR");
    }

    if (!authData.user) {
      return apiError("Erreur lors de la création du compte", 500, "USER_CREATION_FAILED");
    }

    // Utiliser le service role client pour les opérations post-signup
    // car l'utilisateur n'a pas encore de session active (email non confirmé)
    // et le client anon ne peut pas lire/écrire à travers le RLS
    const adminClient = supabaseAdmin();

    // Le profil est créé par le trigger handle_new_user (ON CONFLICT DO UPDATE)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profile) {
      // Create specialized profile based on role (upsert to avoid duplicate key errors)
      // SOTA 2026: chaque rôle a sa table dédiée, upsert idempotent + erreurs loggées
      // sans bloquer la création du compte auth.
      try {
        if (data.role === "owner") {
          await adminClient.from("owner_profiles").upsert(
            { profile_id: profile.id, type: "particulier" },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        } else if (data.role === "tenant") {
          await adminClient.from("tenant_profiles").upsert(
            { profile_id: profile.id },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        } else if (data.role === "provider") {
          await adminClient.from("provider_profiles").upsert(
            { profile_id: profile.id, type_services: [] },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        } else if (data.role === "guarantor") {
          await adminClient.from("guarantor_profiles").upsert(
            { profile_id: profile.id },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        } else if (data.role === "agency") {
          // raison_sociale est nullable (cf migration 20260411130100)
          // Sera renseignée dans /agency/onboarding/profile
          await adminClient.from("agency_profiles").upsert(
            { profile_id: profile.id },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        } else if (data.role === "syndic") {
          // Table créée par migration 20260411130200
          // Champs réglementaires renseignés dans /syndic/onboarding/profile
          await adminClient.from("syndic_profiles").upsert(
            { profile_id: profile.id, type_syndic: "professionnel" },
            { onConflict: "profile_id", ignoreDuplicates: true }
          );
        }
      } catch (specializedError) {
        console.error("[register] Specialized profile upsert failed:", {
          role: data.role,
          profile_id: profile.id,
          error: specializedError,
        });
        // On continue : le profil de base existe déjà, l'utilisateur peut compléter
        // dans l'onboarding. Un job de réparation peut corriger plus tard.
      }

      // B18: Résolution automatique des invitations pending.
      // Le vrai travail est fait par le trigger DB
      // `auto_link_lease_signers_on_profile_created()` (migration
      // 20260225100000) qui se déclenche à l'INSERT sur profiles et :
      //   1. Lie les lease_signers orphelins (invited_email = user email)
      //   2. Backfill invoices.tenant_id
      //   3. Marque les invitations comme used_at = NOW()
      //
      // Ce trigger se déclenche AVANT ce code (le handle_new_user trigger
      // insère le profil, puis auto_link_lease_signers_on_profile_created
      // s'exécute). Aucune action supplémentaire côté API n'est nécessaire.
      //
      // On log simplement pour le monitoring.

      // NOTE: l'email de confirmation est envoyé par Supabase (SMTP Resend configuré
      // au niveau du projet). Pas d'envoi manuel supplémentaire ici pour éviter le
      // double email à l'inscription. L'email de bienvenue/onboarding guidé peut être
      // déclenché ultérieurement (ex: après confirmation dans /auth/callback), mais
      // JAMAIS en parallèle de l'inscription.

      // Notify admins of new registration
      import("@/lib/services/admin-notification.service").then(({ notifyAdmins }) =>
        notifyAdmins({
          type: "new_user",
          title: "Nouvel utilisateur",
          body: `${data.prenom || ""} ${data.nom || ""} (${data.email}) — ${data.role}`,
          actionUrl: "/admin/users",
          metadata: { user_id: authData.user!.id, role: data.role },
        })
      ).catch(() => {});

      // Audit log (via service role pour bypass RLS)
      await logAudit(
        adminClient,
        "user.registered",
        "profiles",
        profile.id,
        authData.user.id
      );
    }

    return apiSuccess(
      {
        message: "Compte créé. Vérifiez votre email pour confirmer.",
        user: {
          id: authData.user.id,
          email: authData.user.email,
          email_confirmed: !!authData.user.email_confirmed_at,
        },
      },
      201
    );
  } catch (error: unknown) {
    console.error("[register] Error:", error);
    return apiError("Erreur serveur", 500, "SERVER_ERROR");
  }
}
