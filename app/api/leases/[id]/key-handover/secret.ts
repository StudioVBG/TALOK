/**
 * Secret HMAC dédié à la signature des tokens QR de remise des clés.
 *
 * Avant : le code retombait silencieusement sur NEXTAUTH_SECRET, puis sur
 * JWT_SECRET, puis sur le hardcode "talok-key-handover-secret" — ce dernier
 * fallback permettait à quiconque lisant le code de forger des tokens si
 * aucun des deux env vars n'était configuré.
 *
 * Désormais : on exige KEY_HANDOVER_SECRET. En production une absence est
 * fatale (throw). En développement, on log un warning et on utilise un
 * dev-fallback dérivé qui ne sera jamais émis en prod.
 */

const isProduction = process.env.NODE_ENV === "production";

let warned = false;

export function getKeyHandoverSecret(): string {
  const secret = process.env.KEY_HANDOVER_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (isProduction) {
    throw new Error(
      "[CRITICAL] KEY_HANDOVER_SECRET is required in production (min 32 chars). " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (!warned) {
    console.warn(
      "[key-handover] KEY_HANDOVER_SECRET non configuré — utilisation d'un secret de développement. " +
        "Configure-le pour la prod : openssl rand -hex 32"
    );
    warned = true;
  }
  return "dev-only-key-handover-secret-do-not-use-in-production-32chars";
}
