import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ============================================
// CONFIGURATION - SOTA 2025
// ============================================

const publicRoutes = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/auth/callback",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/signup",
  "/blog",
  "/invite",
  "/legal",
  "/signature", // Page de signature locataire (invitation)
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/payments/webhook",
  "/api/v1/signatures/webhook",
  "/api/webhooks",
  "/api/public",
  "/api/signature", // APIs de signature locataire
];

const roleRoutes: Record<string, string[]> = {
  admin: ["/admin", "/app/admin"],
  owner: ["/app/owner"],
  tenant: ["/app/tenant"],
  provider: ["/app/provider"],
};

// ============================================
// REDIRECTIONS - Structure unifiée /app/*
// ============================================

const redirects: Record<string, string> = {
  // =============================================
  // OWNER - Redirections vers /app/owner/*
  // =============================================
  "/owner": "/app/owner/dashboard",
  "/owner/dashboard": "/app/owner/dashboard",
  "/owner/properties": "/app/owner/properties",
  "/owner/properties/new": "/app/owner/properties/new",
  "/owner/leases": "/app/owner/contracts",
  "/owner/contracts": "/app/owner/contracts",
  "/owner/finances": "/app/owner/money",
  "/owner/money": "/app/owner/money",
  "/owner/documents": "/app/owner/documents",
  "/owner/support": "/app/owner/support",
  "/owner/settings": "/app/owner/profile",
  "/owner/profile": "/app/owner/profile",
  "/owner/tickets": "/app/owner/tickets",
  "/owner/inspections": "/app/owner/inspections",

  // =============================================
  // TENANT - Redirections vers /app/tenant/*
  // =============================================
  "/tenant": "/app/tenant/dashboard",
  "/tenant/dashboard": "/app/tenant/dashboard",
  "/tenant/home": "/app/tenant/lease",
  "/tenant/lease": "/app/tenant/lease",
  "/tenant/payments": "/app/tenant/payments",
  "/tenant/tickets": "/app/tenant/requests",
  "/tenant/requests": "/app/tenant/requests",
  "/tenant/meters": "/app/tenant/meters",
  "/tenant/signatures": "/app/tenant/signatures",
  "/tenant/colocation": "/app/tenant/colocation",
  "/tenant/settings": "/app/tenant/settings",
  "/tenant/help": "/app/tenant/help",
  "/tenant/messages": "/app/tenant/messages",
  "/tenant/documents": "/app/tenant/documents",

  // =============================================
  // ROUTES GÉNÉRIQUES - Redirect vers owner par défaut
  // =============================================
  "/properties": "/app/owner/properties",
  "/properties/new": "/app/owner/properties/new",
  "/leases": "/app/owner/contracts",
  "/leases/new": "/app/owner/contracts/new",
  "/contracts": "/app/owner/contracts",
  "/tickets": "/app/owner/tickets",
  "/tickets/new": "/app/owner/tickets/new",
  "/invoices": "/app/owner/money",
  "/money": "/app/owner/money",
  "/documents": "/app/owner/documents",
  "/inspections": "/app/owner/inspections",

  // =============================================
  // PROVIDER - Redirections vers /app/provider/*
  // =============================================
  "/provider": "/app/provider",
  "/app/vendor": "/app/provider",
  "/vendor": "/app/provider",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function isPublic(pathname: string): boolean {
  // Static files
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".") // static files (images, fonts, etc.)
  ) {
    return true;
  }

  // API routes publiques
  if (pathname.startsWith("/api/v1/auth") || pathname.startsWith("/api/public")) {
    return true;
  }

  return (
    publicRoutes.includes(pathname) ||
    publicRoutes.some((route) => pathname.startsWith(route + "/"))
  );
}

function isWebhook(pathname: string): boolean {
  return pathname.includes("/webhook");
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Vérifie si une redirection existe pour le chemin
 */
function getRedirectPath(pathname: string): string | null {
  // Vérifier redirection exacte
  if (pathname in redirects) {
    return redirects[pathname];
  }

  // Vérifier redirections avec préfixe
  for (const [from, to] of Object.entries(redirects)) {
    if (pathname.startsWith(from + "/")) {
      const suffix = pathname.slice(from.length);
      return to + suffix;
    }
  }

  return null;
}

/**
 * Extrait le rôle depuis les métadonnées utilisateur (JWT claims)
 */
function getRoleFromUserMetadata(user: any): string | null {
  return user?.app_metadata?.role || user?.user_metadata?.role || null;
}

/**
 * Détermine le dashboard approprié pour un rôle - NOUVELLE STRUCTURE
 */
function getDashboardPath(role: string | null): string {
  switch (role) {
    case "admin":
      return "/admin/dashboard";
    case "owner":
      return "/app/owner/dashboard";
    case "tenant":
      return "/app/tenant/dashboard";
    case "provider":
      return "/app/provider/dashboard";
    default:
      return "/dashboard";
  }
}

// ============================================
// MIDDLEWARE PRINCIPAL
// ============================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 0. Check for redirections FIRST (migration vers nouvelle structure)
  const redirectPath = getRedirectPath(pathname);
  if (redirectPath && redirectPath !== pathname) {
    const url = new URL(redirectPath, request.url);
    // Conserver les query params
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url, { status: 308 }); // 308 = Permanent redirect
  }

  // 1. Allow webhooks sans auth (priorité haute)
  if (isWebhook(pathname)) {
    return NextResponse.next();
  }

  // 2. Allow public routes (fast path)
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 3. Setup Supabase client
  const { url, anonKey } = getSupabaseConfig();
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options?: { path?: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: "strict" | "lax" | "none" }) {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      },
      remove(name: string) {
        request.cookies.delete(name);
        response.cookies.delete(name);
      },
    },
  });

  // 4. Vérifier l'authentification
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Non authentifié - redirect to login
  if (!user) {
    // Pour les routes API, retourner 401 au lieu de redirect
    if (isApiRoute(pathname)) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const loginUrl = new URL("/auth/signin", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Email non confirmé
  if (
    !user.email_confirmed_at &&
    !pathname.startsWith("/auth/verify-email") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/signup")
  ) {
    return NextResponse.redirect(new URL("/auth/verify-email", request.url));
  }

  // Email confirmé mais sur page verify
  if (user.email_confirmed_at && pathname.startsWith("/auth/verify-email")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 6. Obtenir le rôle (optimisé : essayer JWT d'abord, puis DB)
  let userRole = getRoleFromUserMetadata(user);

  // Si pas de rôle dans le JWT, requêter la DB (fallback)
  if (!userRole) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    userRole = profile?.role || null;
  }

  // 7. Vérification d'accès basée sur le rôle
  for (const [role, routes] of Object.entries(roleRoutes)) {
    for (const route of routes) {
      if (pathname.startsWith(route) && userRole !== role && userRole !== "admin") {
        // Pour les API, retourner 403
        if (isApiRoute(pathname)) {
          return new NextResponse(
            JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } }
          );
        }
        // Redirect vers le bon dashboard
        return NextResponse.redirect(new URL(getDashboardPath(userRole), request.url));
      }
    }
  }

  // 8. Handle /dashboard redirect basé sur le rôle
  if (pathname === "/dashboard") {
    return NextResponse.redirect(new URL(getDashboardPath(userRole), request.url));
  }

  // 9. Ajouter les headers de cache pour les routes authentifiées
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  response.headers.set("X-User-Role", userRole || "unknown");

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
