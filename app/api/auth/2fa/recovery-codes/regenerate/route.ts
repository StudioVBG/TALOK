/**
 * POST /api/auth/2fa/recovery-codes/regenerate
 *
 * Régénère 10 nouveaux codes de récupération 2FA. Les anciens deviennent
 * immédiatement invalides. L'utilisateur doit fournir son code TOTP courant
 * pour valider l'opération (preuve de possession du second facteur).
 *
 * Réponse : { recoveryCodes: string[] } — codes en clair affichés UNE seule fois.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyTOTPCode, generatePlainRecoveryCodes } from "@/lib/auth/totp";
import { decrypt, isEncrypted } from "@/lib/security/encryption.service";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { sendTwoFactorChangeNotification } from "@/lib/emails/resend.service";

export async function POST(request: NextRequest) {
  const rateLimitResponse = await applyRateLimit(request, "auth");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { code } = body || {};

    if (!code || typeof code !== "string" || code.length < 6) {
      return NextResponse.json(
        { error: "Code TOTP requis pour régénérer les codes de récupération" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();
    const { data: config } = await serviceClient
      .from("user_2fa")
      .select("totp_secret, enabled")
      .eq("user_id", user.id)
      .single();

    if (!config?.enabled || !config.totp_secret) {
      return NextResponse.json(
        { error: "2FA non activé sur ce compte" },
        { status: 400 }
      );
    }

    let totpSecret = config.totp_secret as string;
    if (isEncrypted(totpSecret)) {
      try {
        totpSecret = decrypt(totpSecret);
      } catch (decryptError) {
        console.error("[2FA] Erreur déchiffrement (regenerate):", decryptError);
        return NextResponse.json(
          { error: "Erreur de configuration 2FA" },
          { status: 500 }
        );
      }
    }

    if (!verifyTOTPCode(totpSecret, code)) {
      return NextResponse.json({ error: "Code TOTP invalide" }, { status: 400 });
    }

    // Générer 10 nouveaux codes en clair, hasher via la fonction SQL pgcrypto
    const plainCodes = generatePlainRecoveryCodes(10);
    const { data: hashedCodes, error: hashError } = await serviceClient.rpc(
      "hash_2fa_recovery_codes" as any,
      { p_codes: plainCodes }
    );
    if (hashError || !hashedCodes) {
      console.error("[2FA] Erreur hash recovery codes (regenerate):", hashError);
      return NextResponse.json(
        { error: "Erreur lors de la génération des codes" },
        { status: 500 }
      );
    }

    const { error: updateError } = await serviceClient
      .from("user_2fa")
      .update({
        recovery_codes: hashedCodes,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[2FA] Erreur update recovery codes:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour des codes" },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "2fa_recovery_codes_regenerated",
      entity_type: "user",
      entity_id: user.id,
    } as any);

    // Email d'alerte (non bloquant)
    if (user.email) {
      try {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("prenom, nom")
          .eq("user_id", user.id)
          .single();
        const userName =
          [profile?.prenom, profile?.nom].filter(Boolean).join(" ") ||
          user.email.split("@")[0];
        await sendTwoFactorChangeNotification({
          userEmail: user.email,
          userName,
          action: "recovery_codes_regenerated",
        });
      } catch (emailError) {
        console.error("[2FA] email notif regen recovery codes failed:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      recoveryCodes: plainCodes,
      message: "Codes de récupération régénérés. Conservez-les en lieu sûr.",
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur regenerate recovery codes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
