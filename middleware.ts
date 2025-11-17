import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // En développement, désactiver complètement le cache pour éviter les problèmes
  if (process.env.NODE_ENV === "development") {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          request.cookies.set(name, value);
          response = NextResponse.next({
            request,
          });
          response.cookies.set(name, value, options);
        },
        remove(name: string, options?: any) {
          request.cookies.delete(name);
          response = NextResponse.next({
            request,
          });
          response.cookies.delete(name);
        },
      },
    }
  );

  // Rafraîchit la session si nécessaire
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Routes publiques qui ne nécessitent pas d'authentification
  const publicRoutes = [
    "/auth/signin",
    "/auth/signup",
    "/auth/callback",
    "/auth/verify-email",
    "/signup", // Toutes les routes d'inscription
    "/blog",
    "/",
  ];
  const isPublicRoute =
    publicRoutes.includes(request.nextUrl.pathname) ||
    publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  // Si l'utilisateur est connecté mais que son email n'est pas confirmé
  // et qu'il n'est pas déjà sur la page de vérification ou d'inscription
  if (
    user &&
    !user.email_confirmed_at &&
    !request.nextUrl.pathname.startsWith("/auth/verify-email") &&
    !request.nextUrl.pathname.startsWith("/auth/callback") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !isPublicRoute
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
    // Pour les admins, rediriger directement vers le dashboard admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }

    // Pour les autres rôles, rediriger directement vers le dashboard
    // Le dashboard affichera la checklist si nécessaire, mais ne bloque pas l'accès
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

