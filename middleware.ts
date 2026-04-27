import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware SOTA 2026 - Edge Safe + RBAC Route Guard
 *
 * RÈGLE D'OR : Zéro import @supabase/* ici pour éviter les erreurs
 * "Node API used in Edge runtime" (process.version).
 *
 * On se contente d'une vérification de la présence des cookies de session.
 * La validation forte (rôle, 2FA, feature flags) est faite dans les
 * layouts serveurs Node.js.
 *
 * WHITE-LABEL: Détection des domaines personnalisés via le header Host.
 * La résolution complète se fait via l'API /api/white-label/resolve.
 *
 * ROUTE_ROLES: Mapping déclaratif des chemins protégés par rôle.
 * La vérification réelle du rôle est faite côté serveur (layouts/API),
 * ici on ne fait que du cookie-check pour le redirect.
 */

// Domaine principal de l'application
const MAIN_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || "talok.fr";
const MAIN_DOMAINS = [MAIN_DOMAIN, `www.${MAIN_DOMAIN}`, "localhost"];

/**
 * ROUTE_ROLES — Mapping déclaratif des rôles autorisés par chemin.
 * La vérification effective du rôle JWT est faite dans les layouts serveur Node.js,
 * pas ici (Edge runtime = pas d'accès à Supabase Auth).
 * Ce mapping sert de documentation et de référence pour les layouts.
 */
const ROUTE_ROLES: Record<string, string[]> = {
  "/owner": ["owner"],
  "/tenant": ["tenant"],
  "/provider": ["provider"],
  "/syndic": ["syndic"],
  "/agency": ["agency"],
  "/admin": ["admin"],
  "/guarantor": ["guarantor"],
  "/copro": ["tenant", "owner"], // copropriétaires
  "/dashboard": ["owner", "tenant", "provider", "syndic", "agency", "admin"],
  "/messages": ["owner", "tenant", "provider", "syndic", "agency", "admin"],
  "/notifications": ["owner", "tenant", "provider", "syndic", "agency", "admin"],
  "/settings": ["owner", "tenant", "provider", "syndic", "agency", "admin"],
  "/profile": ["owner", "tenant", "provider", "syndic", "agency", "admin", "guarantor"],
};

// Routes publiques qui ne nécessitent aucune vérification
const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/callback",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/recovery/password",
  "/signup",
  "/login",
  "/signout",
  "/pricing",
  "/blog",
  "/legal",
  "/demo",
  "/signature",
  "/onboarding",
  "/faq",
  "/fonctionnalites",
  "/solutions",
  "/temoignages",
  "/guides",
  "/outils",
  "/a-propos",
  "/contact",
  "/features",
  "/modeles",
  "/invite",
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

  // 5. Redirect authenticated users away from auth pages (avoid login loop)
  const authPages = ["/auth/signin", "/auth/signup"];
  if (hasAuthCookie && authPages.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    const safeRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/dashboard";
    url.pathname = safeRedirect;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // B5: Redirect authenticated users from /pricing to their dashboard.
  // Le middleware tourne en Edge runtime et ne peut pas lire le rôle depuis
  // la DB — on redirige vers /dashboard qui résout le rôle côté serveur Node
  // via getRoleDashboardUrl() (évite de coincer les non-owners sur /owner).
  if (hasAuthCookie && pathname === "/pricing") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // 6. Redirection si non authentifié vers les zones protégées
  const protectedPaths = [
    "/tenant",
    "/owner",
    "/provider",
    "/agency",
    "/guarantor",
    "/copro",
    "/syndic",
    "/admin",
    "/ec", // Portail expert-comptable. Pas de rôle dédié — l'autorisation
            // dynamique se fait via la table ec_access côté API/dashboard
            // (un user authentifié sans accès EC voit "Aucun client"). On
            // protège juste contre l'accès anonyme.
    "/messages",
    "/notifications",
    "/settings",
    "/profile",
    "/dashboard",
  ];

  const isProtected = protectedPaths.some(p => pathname === p || pathname.startsWith(`${p}/`)) || pathname.startsWith("/app");

  if (isProtected && !hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    // Only set redirect for safe internal paths (prevent open redirect)
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }

  // 7. Propager le pathname et les rôles autorisés pour les layouts serveur (identity gate)
  const response = NextResponse.next();
  response.headers.set("x-pathname", pathname);

  // Trouver les rôles autorisés pour cette route et les propager au layout serveur
  const matchedRoute = Object.keys(ROUTE_ROLES).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  if (matchedRoute) {
    response.headers.set("x-allowed-roles", ROUTE_ROLES[matchedRoute].join(","));
  }

  return response;
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
