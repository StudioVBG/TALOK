import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware SOTA 2025 - Edge Safe
 * 
 * RÈGLE D'OR : Zéro import @supabase/* ici pour éviter les erreurs 
 * "Node API used in Edge runtime" (process.version).
 * 
 * On se contente d'une vérification de la présence des cookies de session.
 * La validation forte est faite dans les layouts serveurs Node.js.
 */

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

  // 1. Laisser passer les assets statiques, les webhooks et les routes publiques
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") ||
    publicRoutes.some((route) => 
      route === "/" ? pathname === "/" : pathname.startsWith(route)
    ) ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/public") ||
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
