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
import { resolveInvitationByToken, type ResolvedInvitation } from "@/lib/invitations/server-resolver";

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

    // Log du rôle reçu avant d'appeler Supabase — utile pour auditer les bugs
    // de routing par rôle (ex: syndic qui crée un compte tenant).
    console.log("[register] signUp request", {
      email: data.email,
      role: data.role,
      has_telephone: !!data.telephone,
      has_invite: !!data.inviteToken,
    });

    // Verrouillage rôle via invitation : si un token est fourni, on lookup
    // l'invitation côté serveur (table `invitations` ou `guarantor_invitations`)
    // et on force le rôle final. Cela bloque les tentatives de détournement
    // (ex: lien `garant` → signup `owner`).
    let resolvedInvitation: ResolvedInvitation | null = null;
    if (data.inviteToken) {
      const adminClient = supabaseAdmin();
      const result = await resolveInvitationByToken(adminClient, data.inviteToken);

      if (!result.ok) {
        switch (result.error.kind) {
          case "not_found":
            return apiError("Invitation introuvable", 404, "INVITE_NOT_FOUND");
          case "already_used":
            return apiError("Cette invitation a déjà été utilisée.", 409, "INVITE_ALREADY_USED");
          case "expired":
            return apiError("Cette invitation a expiré.", 410, "INVITE_EXPIRED");
          case "declined":
            return apiError("Cette invitation a été refusée.", 409, "INVITE_DECLINED");
        }
      }

      resolvedInvitation = result.invitation;

      if (resolvedInvitation.email !== data.email) {
        return apiError(
          "L'email saisi ne correspond pas à l'invitation.",
          403,
          "INVITE_EMAIL_MISMATCH"
        );
      }

      if (resolvedInvitation.applicativeRole !== data.role) {
        console.warn("[register] role override forced by invitation", {
          email: data.email,
          requested: data.role,
          forced: resolvedInvitation.applicativeRole,
          invitation_role: resolvedInvitation.invitationRole,
          source: resolvedInvitation.source,
        });
        // Verrouillage strict : on force le rôle au lieu d'accepter celui du
        // client, qui peut avoir été manipulé via l'URL `?role=...`.
        data.role = resolvedInvitation.applicativeRole;
      }
    }

    const supabase = await createClient();

    // Create auth user
    // Le trigger handle_new_user lira raw_user_meta_data.role et créera le
    // profil avec le bon rôle (cf. migration 20260415000000_signup_integrity_guard).
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
    // On relit le rôle réellement écrit en base pour détecter tout écart entre
    // le rôle demandé (data.role) et le rôle persisté (profile.role).
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profile && profile.role !== data.role) {
      console.error("[register] Role mismatch between request and profile", {
        user_id: authData.user.id,
        requested_role: data.role,
        persisted_role: profile.role,
      });
    }

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
      // Pour la table `invitations` (bail), le trigger DB
      // `auto_link_lease_signers_on_profile_created()` (migration
      // 20260225100000) gère :
      //   1. Lie les lease_signers orphelins (invited_email = user email)
      //   2. Backfill invoices.tenant_id
      //   3. Marque les invitations comme used_at = NOW()
      //
      // Pour `guarantor_invitations` (garant standalone), aucun trigger
      // équivalent n'existe : on marque manuellement l'invitation acceptée
      // ici, en utilisant la résolution déjà faite avant le signUp.
      if (resolvedInvitation && resolvedInvitation.source === "guarantor") {
        try {
          await adminClient
            .from("guarantor_invitations")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString(),
              guarantor_profile_id: profile.id,
            })
            .eq("id", resolvedInvitation.id)
            .eq("status", "pending");
        } catch (guarantorLinkError) {
          console.error("[register] guarantor_invitation accept failed:", {
            invitation_id: resolvedInvitation.id,
            error: guarantorLinkError,
          });
          // Non bloquant : un endpoint d'acceptation post-login peut rejouer
          // l'opération.
        }
      }

      // NOTE: l'email de confirmation est envoyé par Supabase (SMTP Resend configuré
      // au niveau du projet). Pas d'envoi manuel supplémentaire ici pour éviter le
      // double email à l'inscription. L'email de bienvenue/onboarding guidé peut être
      // déclenché ultérieurement (ex: après confirmation dans /auth/callback), mais
      // JAMAIS en parallèle de l'inscription.

      // Planifier les rappels d'onboarding (24h, 72h, 7j) consommés par le cron
      // /api/cron/onboarding-reminders. Sans ces lignes, le cron n'a rien à envoyer
      // et les utilisateurs qui n'ont pas terminé l'onboarding ne sont jamais relancés.
      // Upsert idempotent sur (user_id, reminder_type) : un re-signup ne duplique pas.
      try {
        const now = Date.now();
        const HOUR = 60 * 60 * 1000;
        const reminders = [
          { reminder_type: "24h", delay: 24 * HOUR },
          { reminder_type: "72h", delay: 72 * HOUR },
          { reminder_type: "7d", delay: 7 * 24 * HOUR },
        ];
        await adminClient.from("onboarding_reminders").upsert(
          reminders.map((r) => ({
            user_id: authData.user!.id,
            profile_id: profile.id,
            role: profile.role,
            reminder_type: r.reminder_type,
            scheduled_at: new Date(now + r.delay).toISOString(),
            email_sent_to: data.email,
            status: "pending" as const,
          })),
          { onConflict: "user_id,reminder_type", ignoreDuplicates: true }
        );
      } catch (reminderError) {
        console.error("[register] onboarding_reminders upsert failed:", {
          user_id: authData.user.id,
          role: profile.role,
          error: reminderError,
        });
        // Non bloquant : un job de réparation peut planifier les rappels plus tard.
      }

      // Notify admins of new registration
      import("@/lib/services/admin-notification.service").then(({ notifyAdmins }) =>
        notifyAdmins({
          type: "new_user",
          title: "Nouvel utilisateur",
          body: `${data.prenom || ""} ${data.nom || ""} (${data.email}) — ${data.role}`,
          actionUrl: "/admin/people",
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
