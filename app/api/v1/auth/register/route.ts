// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validateBody, logAudit } from "@/lib/api/middleware";
import { RegisterSchema } from "@/lib/api/schemas";

/**
 * POST /api/v1/auth/register
 * Register a new user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error: validationError } = validateBody(RegisterSchema, body);

    if (validationError) return validationError;

    const supabase = await createClient();

    // Create auth user
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

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      role: data.role,
      prenom: data.prenom || null,
      nom: data.nom || null,
    });

    if (profileError) {
      console.error("[register] Profile creation error:", profileError);
      // Don't fail the request, profile might be created by trigger
    }

    // Create specialized profile based on role
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (profile) {
      if (data.role === "owner") {
        await supabase.from("owner_profiles").insert({
          profile_id: profile.id,
          type: "particulier",
        });
      } else if (data.role === "tenant") {
        await supabase.from("tenant_profiles").insert({
          profile_id: profile.id,
        });
      } else if (data.role === "provider") {
        await supabase.from("provider_profiles").insert({
          profile_id: profile.id,
          type_services: [],
        });
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
  } catch (error: any) {
    console.error("[register] Error:", error);
    return apiError("Erreur serveur", 500, "SERVER_ERROR");
  }
}

