export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validateBody, logAudit } from "@/lib/api/middleware";
import { LoginSchema } from "@/lib/api/schemas";

/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error: validationError } = validateBody(LoginSchema, body);

    if (validationError) return validationError;

    const supabase = await createClient();

    // Authenticate
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError) {
      if (authError.message.includes("Invalid login credentials")) {
        return apiError("Email ou mot de passe incorrect", 401, "INVALID_CREDENTIALS");
      }
      if (authError.message.includes("Email not confirmed")) {
        return apiError("Veuillez confirmer votre email", 401, "EMAIL_NOT_CONFIRMED");
      }
      return apiError(authError.message, 401, "AUTH_ERROR");
    }

    if (!authData.user || !authData.session) {
      return apiError("Erreur d'authentification", 500, "AUTH_FAILED");
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", authData.user.id)
      .single();

    // Check if 2FA is required
    const { data: twoFactorSettings } = await supabase
      .from("two_factor_settings")
      .select("enabled")
      .eq("user_id", authData.user.id)
      .single();

    const requires2FA = twoFactorSettings?.enabled || false;

    // Audit log
    if (profile) {
      await logAudit(
        supabase,
        "user.login",
        "profiles",
        profile.id,
        authData.user.id
      );
    }

    return apiSuccess({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile: profile
          ? {
              id: profile.id,
              role: profile.role,
              prenom: profile.prenom,
              nom: profile.nom,
            }
          : null,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
      },
      requires_2fa: requires2FA,
    });
  } catch (error: any) {
    console.error("[login] Error:", error);
    return apiError("Erreur serveur", 500, "SERVER_ERROR");
  }
}

