import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware SOTA 2025 - Edge Safe
 *
 * RÈGLE D'OR : Zéro import @supabase/* ici pour éviter les erreurs
 * "Node API used in Edge runtime" (process.version).
 *
 * On se contente d'une vérification de la présence des cookies de session.
 * La validation forte est faite dans les layouts serveurs Node.js.
 *
 * WHITE-LABEL: Détection des domaines personnalisés via le header Host.
 * La résolution complète se fait via l'API /api/white-label/resolve.
 */

// Domaine principal de l'application
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "talok.fr";
const MAIN_DOMAINS = [MAIN_DOMAIN, `www.${MAIN_DOMAIN}`, "localhost"];

// Routes publiques qui ne nécessitent aucune vérification
const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/callback",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/signup",
  "/pricing",
  "/blog",
  "/legal",
  "/demo",
  "/signature",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0]; // Enlever le port si présent

  // 0. WHITE-LABEL: Détection de domaine personnalisé
  const isCustomDomain = !MAIN_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`)
  );

  if (isCustomDomain && hostname) {
    // Ajouter le header X-Custom-Domain pour que l'app puisse le détecter
    const response = NextResponse.next();
    response.headers.set("X-Custom-Domain", hostname);
    response.headers.set("X-White-Label", "true");

    // Pour les routes API, laisser passer sans modification
    if (pathname.startsWith("/api/")) {
      return response;
    }

    // Le reste de la logique s'applique normalement
    // L'app résoudra le branding via l'API /api/white-label/resolve
  }

  // 1. Laisser passer les assets statiques, les routes API et les routes publiques
  // IMPORTANT: Les routes /api/* gèrent leur propre authentification et retournent des erreurs JSON.
  // Ne pas les rediriger vers /auth/signin car cela causerait des erreurs JSON parse côté client.
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    pathname.startsWith("/api/") ||
    publicRoutes.some((route) =>
      route === "/" ? pathname === "/" : pathname.startsWith(route)
    ) ||
    pathname.startsWith("/auth/callback")
  ) {
    return NextResponse.next();
  }

  // 3. Redirections de structure (legacy fix)
  if (pathname.startsWith("/app/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace("/app/", "/");
    return NextResponse.redirect(url);
  }

  if (pathname === "/tenant/home") {
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/lease";
    return NextResponse.redirect(url);
  }

  // 4. Vérification ultra-légère de la session (présence d'un cookie auth Supabase)
  // Pattern standard : sb-xxxx-auth-token ou auth-token
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes("auth-token") || c.name.startsWith("sb-")
  );

  // 5. Redirection si non authentifié vers les zones protégées
  const protectedPaths = [
    "/tenant",
    "/owner",
    "/provider",
    "/agency",
    "/guarantor",
    "/copro",
    "/syndic",
    "/admin",
    "/messages",
    "/notifications",
    "/settings"
  ];
  
  const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith("/app");

  if (isProtected && !hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/dashboard") {
    // Le layout de l'app se chargera de rediriger vers le bon dashboard selon le rôle
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
