/**
 * API Route: Récupère le statut 2FA d'un utilisateur
 * GET /api/auth/2fa/status
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { countRemainingRecoveryCodes } from "@/lib/auth/totp";

export async function GET(request: NextRequest) {
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

    const serviceClient = getServiceClient();

    // Récupérer la config 2FA
    const { data: twoFAConfig } = await serviceClient
      .from("user_2fa")
      .select("enabled, activated_at, recovery_codes")
      .eq("user_id", user.id)
      .single();

    // Récupérer les passkeys
    const { data: passkeys } = await serviceClient
      .from("passkey_credentials")
      .select("id, friendly_name, device_type, created_at, last_used_at")
      .eq("user_id", user.id);

    const remainingRecoveryCodes = twoFAConfig?.recovery_codes
      ? countRemainingRecoveryCodes(twoFAConfig.recovery_codes)
      : 0;

    return NextResponse.json({
      twoFactorEnabled: twoFAConfig?.enabled || false,
      twoFactorActivatedAt: twoFAConfig?.activated_at || null,
      remainingRecoveryCodes,
      passkeys: passkeys || [],
      passkeyCount: passkeys?.length || 0,
    });
  } catch (error: unknown) {
    console.error("[2FA] Erreur statut:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du statut" },
      { status: 500 }
    );
  }
}
