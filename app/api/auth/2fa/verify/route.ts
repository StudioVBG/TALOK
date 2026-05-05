export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/auth/2fa/verify - Vérifier un code TOTP et activer 2FA
 * SOTA 2026 - Support recovery codes + audit logging
 *
 * @security CRITICAL - Les secrets TOTP sont déchiffrés avant vérification
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyTOTPCode, countRemainingRecoveryCodes } from "@/lib/auth/totp";
import { decrypt, isEncrypted } from "@/lib/security/encryption.service";
import { applyRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit anti-bruteforce TOTP (5 tentatives / 15 min par IP)
  const rateLimitResponse = await applyRateLimit(request, "auth");
  if (rateLimitResponse) return rateLimitResponse;

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
    const { code, token, isRecoveryCode = false, activateAfterVerify = false } = body;

    // Support ancien format (token) et nouveau (code)
    const inputCode = code || token;

    if (!inputCode || inputCode.length < 6) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer la config 2FA (nouvelle table ou ancienne)
    let twoFAConfig: any = null;

    // Essayer la nouvelle table d'abord
    const { data: newConfig } = await serviceClient
      .from("user_2fa")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (newConfig) {
      twoFAConfig = newConfig;
    } else {
      // Fallback sur l'ancien système (profiles.two_factor_secret)
      const { data: profile } = await supabase
        .from("profiles")
        .select("two_factor_secret, two_factor_enabled")
        .eq("user_id", user.id as any)
        .single();

      if (profile && (profile as any).two_factor_secret) {
        twoFAConfig = {
          totp_secret: (profile as any).two_factor_secret,
          enabled: (profile as any).two_factor_enabled,
          recovery_codes: [],
        };
      }
    }

    if (!twoFAConfig || !twoFAConfig.totp_secret) {
      return NextResponse.json(
        { error: "2FA non configuré" },
        { status: 400 }
      );
    }

    // Déchiffrer le secret TOTP si nécessaire (migration transparente)
    let totpSecret = twoFAConfig.totp_secret;
    if (isEncrypted(totpSecret)) {
      try {
        totpSecret = decrypt(totpSecret);
      } catch (decryptError) {
        console.error("[2FA] Erreur déchiffrement:", decryptError);
        return NextResponse.json(
          { error: "Erreur de configuration 2FA" },
          { status: 500 }
        );
      }
    }

    let valid = false;

    if (isRecoveryCode) {
      // Vérification via la fonction SQL pgcrypto : crypt() en temps constant,
      // marque le code comme used=true en transaction. Les codes sont stockés
      // hashés (bcrypt cost 12) — la comparaison plain-text n'est plus possible.
      const { data: matched, error: rpcError } = await serviceClient.rpc(
        "verify_2fa_recovery_code" as any,
        { p_user_id: user.id, p_code: inputCode }
      );
      if (rpcError) {
        console.error("[2FA] Erreur RPC verify_2fa_recovery_code:", rpcError);
        return NextResponse.json(
          { error: "Erreur de vérification" },
          { status: 500 }
        );
      }
      valid = matched === true;
    } else {
      // Vérifier le code TOTP avec le secret déchiffré
      valid = verifyTOTPCode(totpSecret, inputCode);
    }

    if (!valid) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 400 }
      );
    }

    // Recharger la config pour obtenir les recovery_codes à jour (le RPC a
    // pu marquer un code comme used).
    const { data: refreshed } = await serviceClient
      .from("user_2fa")
      .select("recovery_codes")
      .eq("user_id", user.id)
      .single();
    const updatedRecoveryCodes = (refreshed?.recovery_codes as any) || twoFAConfig.recovery_codes || [];

    // Si c'est l'activation initiale
    if (activateAfterVerify && (twoFAConfig.pending_activation || !twoFAConfig.enabled)) {
      await serviceClient
        .from("user_2fa")
        .upsert({
          user_id: user.id,
          totp_secret: twoFAConfig.totp_secret,
          recovery_codes: updatedRecoveryCodes,
          enabled: true,
          pending_activation: false,
          activated_at: new Date().toISOString(),
        });

      // Aussi mettre à jour l'ancien système pour compatibilité
      await supabase
        .from("profiles")
        .update({ two_factor_enabled: true } as any)
        .eq("user_id", user.id as any);

      // Journaliser
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "2fa_enabled",
        entity_type: "user",
        entity_id: user.id,
      } as any);

      return NextResponse.json({
        success: true,
        message: "2FA activé avec succès",
        activated: true,
      });
    }

    return NextResponse.json({
      success: true,
      valid: true,
      remainingRecoveryCodes: countRemainingRecoveryCodes(updatedRecoveryCodes),
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur vérification:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





