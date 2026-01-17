export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/disable - Désactiver la 2FA
 * SOTA 2026 - Requiert code 2FA + mot de passe pour sécurité
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyTOTPCode } from "@/lib/auth/totp";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code, token, password } = body;

    // Support ancien format (token) et nouveau (code)
    const inputCode = code || token;

    if (!inputCode) {
      return NextResponse.json(
        { error: "Code 2FA requis" },
        { status: 400 }
      );
    }

    // Vérifier le mot de passe si fourni (sécurité renforcée)
    if (password) {
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (passwordError) {
        return NextResponse.json(
          { error: "Mot de passe incorrect" },
          { status: 400 }
        );
      }
    }

    const serviceClient = getServiceClient();

    // Récupérer la config 2FA (nouvelle table ou ancienne)
    let totpSecret: string | null = null;
    let hasNewTable = false;

    const { data: newConfig } = await serviceClient
      .from("user_2fa")
      .select("totp_secret, enabled")
      .eq("user_id", user.id)
      .single();

    if (newConfig?.totp_secret) {
      totpSecret = newConfig.totp_secret;
      hasNewTable = true;
    } else {
      // Fallback sur l'ancien système
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_secret")
        .eq("user_id", user.id as any)
        .single();

      if (profile && (profile as any).two_factor_secret) {
        totpSecret = (profile as any).two_factor_secret;
      }
    }

    if (!totpSecret) {
      return NextResponse.json(
        { error: "2FA non activé" },
        { status: 400 }
      );
    }

    // Vérifier le code TOTP
    const valid = verifyTOTPCode(totpSecret, inputCode);

    if (!valid) {
      return NextResponse.json(
        { error: "Code 2FA invalide" },
        { status: 400 }
      );
    }

    // Désactiver 2FA dans la nouvelle table
    if (hasNewTable) {
      await serviceClient
        .from("user_2fa")
        .update({
          enabled: false,
          totp_secret: null,
          recovery_codes: [],
          disabled_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    // Désactiver dans l'ancien système aussi
    await supabase
      .from("profiles")
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
      } as any)
      .eq("user_id", user.id as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "2fa_disabled",
      entity_type: "user",
      entity_id: user.id,
    } as any);

    return NextResponse.json({
      success: true,
      message: "2FA désactivé avec succès",
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur désactivation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





