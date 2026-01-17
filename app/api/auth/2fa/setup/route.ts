/**
 * API Route: Configure 2FA TOTP pour un utilisateur
 * POST /api/auth/2fa/setup
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { setupTOTP, generateRecoveryCodes } from "@/lib/auth/totp";

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

    // Générer les codes de récupération
    const recoveryCodes = generateRecoveryCodes(10);

    // Stocker temporairement (non activé encore)
    await serviceClient.from("user_2fa").upsert({
      user_id: user.id,
      totp_secret: totpSetup.secret,
      recovery_codes: recoveryCodes,
      enabled: false,
      pending_activation: true,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      secret: totpSetup.secret,
      uri: totpSetup.uri,
      qrCodeUrl: totpSetup.qrCodeUrl,
      recoveryCodes: recoveryCodes.map((c) => c.code),
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur setup:", error);
    return NextResponse.json(
      { error: "Erreur lors de la configuration 2FA" },
      { status: 500 }
    );
  }
}
