export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiSuccess, validateBody } from "@/lib/api/middleware";
import { applyRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { getAuthCallbackUrl } from "@/lib/utils/redirect-url";

/**
 * POST /api/v1/auth/magic-link
 * Envoie un lien magique (passwordless) sécurisé.
 *
 * SOTA 2026:
 * - Rate-limit (même preset que signup : 3/h par IP)
 * - Turnstile CAPTCHA
 * - Normalisation email
 * - Ne révèle pas si l'email existe déjà (protection énumération)
 */

const MagicLinkSchema = z.object({
  email: z
    .string()
    .email("Email invalide")
    .transform((val) => val.trim().toLowerCase()),
  turnstileToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 3/h par IP (même preset que signup)
    const rateLimitResponse = await applyRateLimit(request, "signup");
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();

    // Turnstile CAPTCHA
    const turnstileResult = await verifyTurnstileToken(body.turnstileToken);
    if (!turnstileResult.success) {
      return apiError(turnstileResult.error || "Vérification anti-spam échouée", 400, "CAPTCHA_FAILED");
    }

    const { data, error: validationError } = validateBody(MagicLinkSchema, body);
    if (validationError) return validationError;

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        emailRedirectTo: getAuthCallbackUrl(process.env.NEXT_PUBLIC_APP_URL),
        shouldCreateUser: false, // Ne pas créer de compte via magic link (signup séparé)
      },
    });

    // IMPORTANT: Ne jamais révéler si l'email existe ou non (énumération)
    // On renvoie toujours un success, même en cas d'erreur "user not found".
    if (error && !/user.*not.*found|not.*exist/i.test(error.message)) {
      console.error("[magic-link] signInWithOtp error:", error);
    }

    return apiSuccess({
      message: "Si un compte existe avec cet email, un lien de connexion a été envoyé.",
    });
  } catch (error: unknown) {
    console.error("[magic-link] Error:", error);
    return apiError("Erreur serveur", 500, "SERVER_ERROR");
  }
}
