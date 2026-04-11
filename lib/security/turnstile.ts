/**
 * Cloudflare Turnstile server-side verification
 *
 * SOTA 2026:
 * - En production: strict (fail-closed si TURNSTILE_SECRET_KEY absent)
 * - En dev: graceful-degradation avec warning
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export async function verifyTurnstileToken(token: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    // En production: fail-closed pour empêcher les bots en cas de misconfig
    if (IS_PRODUCTION) {
      console.error("[Turnstile] CRITICAL: TURNSTILE_SECRET_KEY missing in production — rejecting request");
      return { success: false, error: "Configuration CAPTCHA incomplète. Contactez le support." };
    }
    // En dev: graceful-degradation
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY not configured — skipping verification (dev only)");
    return { success: true };
  }

  if (!token) {
    return { success: false, error: "Vérification anti-spam requise" };
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    console.warn("[Turnstile] Verification failed:", data["error-codes"]);
    return { success: false, error: "Vérification anti-spam échouée. Rechargez la page et réessayez." };
  } catch (error) {
    // Turnstile API unreachable
    console.error("[Turnstile] Service unreachable:", error);
    // En production: fail-closed plutôt que de laisser passer
    if (IS_PRODUCTION) {
      return { success: false, error: "Service de vérification indisponible. Réessayez dans quelques instants." };
    }
    // En dev: laisser passer
    return { success: true };
  }
}
