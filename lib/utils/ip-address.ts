/**
 * Utilitaires pour l'extraction d'adresses IP depuis les requêtes HTTP
 * 
 * Gère les cas où X-Forwarded-For contient plusieurs IPs (proxy chains)
 * Format attendu: "client, proxy1, proxy2" -> on veut "client"
 */

/**
 * Expression régulière pour valider une adresse IPv4
 */
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * Expression régulière pour valider une adresse IPv6
 */
const IPV6_REGEX = /^([a-f\d]{0,4}:){2,7}[a-f\d]{0,4}$/i;

/**
 * Vérifie si une chaîne est une adresse IP valide (IPv4 ou IPv6)
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== "string") return false;
  const trimmed = ip.trim();
  return IPV4_REGEX.test(trimmed) || IPV6_REGEX.test(trimmed);
}

/**
 * Extrait la première adresse IP valide depuis les headers de la requête
 * 
 * @param request - La requête HTTP
 * @param fallback - Valeur par défaut si aucune IP valide trouvée (défaut: "0.0.0.0")
 * @returns L'adresse IP du client
 * 
 * @example
 * // X-Forwarded-For: "92.144.19.212, 100.27.6.12" -> "92.144.19.212"
 * const ip = extractClientIP(request);
 */
export function extractClientIP(request: Request, fallback: string = "0.0.0.0"): string {
  // Ordre de priorité des headers
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const realIp = request.headers.get("x-real-ip") || "";
  const cfConnectingIp = request.headers.get("cf-connecting-ip") || ""; // Cloudflare
  
  // X-Forwarded-For peut contenir: "client, proxy1, proxy2"
  // On veut uniquement la première IP (le client original)
  const candidates = [
    ...forwardedFor.split(",").map(ip => ip.trim()),
    realIp.trim(),
    cfConnectingIp.trim(),
  ].filter(Boolean);
  
  // Trouver la première IP valide
  for (const candidate of candidates) {
    if (isValidIP(candidate)) {
      return candidate;
    }
  }
  
  // Aucune IP valide trouvée
  console.warn(`[extractClientIP] Aucune IP valide trouvée dans: "${forwardedFor || realIp}", utilisation de "${fallback}"`);
  return fallback;
}

/**
 * Version pour les cas où on veut "unknown" comme fallback (rate limiting, logs)
 */
export function extractClientIPForLogging(request: Request): string {
  return extractClientIP(request, "unknown");
}

/**
 * Version pour PostgreSQL inet type (doit être une IP valide ou null)
 * Retourne null si aucune IP valide trouvée
 */
export function extractClientIPForDB(request: Request): string | null {
  const ip = extractClientIP(request, "");
  return ip && ip !== "0.0.0.0" ? ip : null;
}

