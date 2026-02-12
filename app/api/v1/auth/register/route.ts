export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validateBody, logAudit } from "@/lib/api/middleware";
import { RegisterSchema } from "@/lib/api/schemas";
import { applyRateLimit } from "@/lib/security/rate-limit";

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
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
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

    // Le profil est créé par le trigger handle_new_user (ON CONFLICT DO UPDATE)
    // On attend juste un court instant pour le trigger puis on récupère le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profile) {
      // Create specialized profile based on role
      if (data.role === "owner") {
        await supabase.from("owner_profiles").insert({
          profile_id: profile.id,
          type: "particulier",
        }).onConflict("profile_id").ignore();
      } else if (data.role === "tenant") {
        await supabase.from("tenant_profiles").insert({
          profile_id: profile.id,
        }).onConflict("profile_id").ignore();
      } else if (data.role === "provider") {
        await supabase.from("provider_profiles").insert({
          profile_id: profile.id,
          type_services: [],
        }).onConflict("profile_id").ignore();
      } else if (data.role === "guarantor") {
        await supabase.from("guarantor_profiles").insert({
          profile_id: profile.id,
        }).onConflict("profile_id").ignore();
      }

      // Audit log
      await logAudit(
        supabase,
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
