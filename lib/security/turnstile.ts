/**
 * Cloudflare Turnstile server-side verification
 *
 * SOTA 2026 — Graceful degradation consistente entre client et serveur.
 *
 * Règle:
 * - Si `TURNSTILE_SECRET_KEY` n'est pas configuré → fonctionnalité désactivée
 *   (côté client, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` est absent aussi, donc
 *   le widget ne s'affiche pas et aucun token n'est envoyé). On laisse
 *   passer la requête : la protection anti-bot repose alors sur le rate
 *   limiting (3/h par IP pour signup) + la confirmation d'email Supabase.
 *   En PRODUCTION, on émet un log CRITICAL pour alerter l'admin de la
 *   mauvaise configuration sans bloquer les utilisateurs légitimes.
 * - Si `TURNSTILE_SECRET_KEY` est configuré → on exige un token valide.
 *   Fail-closed en cas d'erreur réseau pour éviter les bypass.
 *
 * Historique: la version précédente faisait fail-closed quand la clé
 * manquait en production, ce qui bloquait toute inscription lorsque
 * l'environnement n'était pas provisionné — incident #registration.
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// Log unique par process pour éviter de polluer les logs à chaque requête
let criticalWarningLogged = false;

export async function verifyTurnstileToken(token: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Cas 1 — Turnstile non configuré côté serveur : feature désactivée.
  // Le widget ne s'affiche pas côté client non plus (même logique dans
  // TurnstileWidget qui retourne null si NEXT_PUBLIC_TURNSTILE_SITE_KEY
  // est absent). On laisse passer sans bloquer.
  if (!secretKey) {
    if (IS_PRODUCTION && !criticalWarningLogged) {
      console.error(
        "[Turnstile] CRITICAL: TURNSTILE_SECRET_KEY absent en production — " +
          "anti-spam désactivé. La protection repose uniquement sur le rate " +
          "limiting et la confirmation email. Configurez la clé pour restaurer " +
          "Turnstile."
      );
      criticalWarningLogged = true;
    } else if (!IS_PRODUCTION) {
      console.warn("[Turnstile] TURNSTILE_SECRET_KEY non configuré — vérification désactivée (dev).");
    }
    return { success: true };
  }

  // Cas 2 — Turnstile configuré côté serveur mais aucun token envoyé.
  // Le client a soit désactivé le widget (clé publique manquante), soit
  // refusé le CAPTCHA. On rejette poliment et on demande un retry.
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
