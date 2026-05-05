/**
 * API Route: Configure 2FA TOTP pour un utilisateur
 * POST /api/auth/2fa/setup
 *
 * @security CRITICAL - Les secrets TOTP sont chiffrés avant stockage
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { setupTOTP, generatePlainRecoveryCodes } from "@/lib/auth/totp";
import { encrypt } from "@/lib/security/encryption.service";
import { generateBrandedQR } from "@/lib/qr/generator";
import { applyRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
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

    // Vérifier si 2FA est déjà activé
    const serviceClient = getServiceClient();
    const { data: existing2FA } = await serviceClient
      .from("user_2fa")
      .select("enabled")
      .eq("user_id", user.id)
      .single();

    if (existing2FA?.enabled) {
      return NextResponse.json(
        { error: "2FA déjà activé. Désactivez-le d'abord pour le reconfigurer." },
        { status: 400 }
      );
    }

    // Générer le secret TOTP
    const totpSetup = setupTOTP(user.email || user.id);

    // Générer les codes de récupération en clair (montrés une seule fois à
    // l'utilisateur dans la réponse) puis hasher via la fonction SQL pgcrypto
    // avant stockage. Les codes en clair ne sont JAMAIS persistés en DB.
    const plainCodes = generatePlainRecoveryCodes(10);
    const { data: hashedCodes, error: hashError } = await serviceClient.rpc(
      "hash_2fa_recovery_codes" as any,
      { p_codes: plainCodes }
    );
    if (hashError || !hashedCodes) {
      console.error("[2FA] Erreur hash recovery codes:", hashError);
      return NextResponse.json(
        { error: "Erreur lors de la génération des codes de récupération" },
        { status: 500 }
      );
    }

    // Chiffrer le secret TOTP avant stockage
    const encryptedSecret = encrypt(totpSetup.secret);

    // Stocker temporairement (non activé encore)
    await serviceClient.from("user_2fa").upsert({
      user_id: user.id,
      totp_secret: encryptedSecret,
      recovery_codes: hashedCodes,
      enabled: false,
      pending_activation: true,
      updated_at: new Date().toISOString(),
    });

    // QR code brandé Talok (PNG data URL avec logo au centre)
    const qrCodeUrl = await generateBrandedQR(totpSetup.uri, {
      size: 320,
      withLogo: true,
    });

    return NextResponse.json({
      secret: totpSetup.secret,
      uri: totpSetup.uri,
      qrCodeUrl,
      recoveryCodes: plainCodes,
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur setup:", error);
    return NextResponse.json(
      { error: "Erreur lors de la configuration 2FA" },
      { status: 500 }
    );
  }
}
