/**
 * Cloudflare Turnstile server-side verification
 * Graceful degradation: if not configured, validation is skipped
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Graceful degradation: skip if not configured
  if (!secretKey) {
    console.warn("[Turnstile] TURNSTILE_SECRET_KEY not configured — skipping verification");
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
    // Turnstile is down — graceful degradation
    console.error("[Turnstile] Service unreachable:", error);
    return { success: true };
  }
}
