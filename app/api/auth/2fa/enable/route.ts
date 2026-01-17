export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

/**
 * POST /api/auth/2fa/enable - Activer la 2FA (P1-1)
 */
export async function POST(request: Request) {
  try {
    // Rate limiting pour les authentifications (5 req/15 min)
    const rateLimitResponse = applyRateLimit(request, "auth");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Générer un secret pour l'utilisateur
    const secret = authenticator.generateSecret();
    const serviceName = "Talok";
    const accountName = user.email || user.id;

    // Générer l'URL du QR code
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret);

    // Stocker temporairement le secret (en attente de vérification)
    // En production, utiliser une table dédiée ou un cache Redis
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        two_factor_secret: secret, // À chiffrer en production
        two_factor_enabled: false, // Pas encore activé tant que non vérifié
      } as any)
      .eq("user_id", user.id as any);

    if (updateError) throw updateError;

    return NextResponse.json({
      secret,
      qr_code_url: otpAuthUrl,
      message: "Scannez le QR code avec votre application d'authentification",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





