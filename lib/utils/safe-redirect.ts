/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only accepts relative paths starting with / that don't contain protocol prefixes.
 */
export function getSafeRedirectUrl(
  url: string | null | undefined,
  fallback: string = "/owner/dashboard"
): string {
  if (!url) return fallback;

  // Must start with /
  if (!url.startsWith("/")) return fallback;

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith("//")) return fallback;

  // Block encoded slashes and other bypass attempts
  try {
    const decoded = decodeURIComponent(url);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  } catch {
    return fallback;
  }

  // Block redirects to API routes and auth callbacks (prevent loops)
  const blocked = ["/api/", "/auth/callback"];
  if (blocked.some((b) => url.startsWith(b))) return fallback;

  return url;
}
