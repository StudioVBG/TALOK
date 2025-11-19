import { getSupabaseConfig } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = [
  "/auth/signin",
  "/auth/signup",
  "/auth/callback",
  "/auth/verify-email",
  "/signup",
  "/blog",
  "/",
];

function isPublic(pathname: string) {
  return (
    publicRoutes.includes(pathname) ||
    publicRoutes.some((route) => pathname.startsWith(route))
  );
}

export async function middleware(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Si l'utilisateur est connecté mais que son email n'est pas confirmé
  // et qu'il n'est pas déjà sur la page de vérification ou d'inscription
  // (seulement si ce n'est pas une route publique)
  if (
    user &&
    !user.email_confirmed_at &&
    !request.nextUrl.pathname.startsWith("/auth/verify-email") &&
    !request.nextUrl.pathname.startsWith("/auth/callback") &&
    !request.nextUrl.pathname.startsWith("/signup")
  ) {
    return NextResponse.redirect(new URL("/auth/verify-email", request.url));
  }

  // Si l'utilisateur est connecté avec email confirmé et essaie d'accéder à la page de vérification
  // mais pas s'il est en train de compléter l'onboarding
  if (
    user &&
    user.email_confirmed_at &&
    request.nextUrl.pathname.startsWith("/auth/verify-email") &&
    !request.nextUrl.pathname.startsWith("/signup")
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

