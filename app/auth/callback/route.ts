export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // Utiliser l'origine de la requête (Vercel en production, localhost en dev)
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("Error exchanging code for session:", error);
      return NextResponse.redirect(new URL("/auth/signin?error=invalid_code", origin));
    }

    // Vérifier si l'email est confirmé
    if (data.user && !data.user.email_confirmed_at) {
      return NextResponse.redirect(new URL("/auth/verify-email", origin));
    }

    // Si l'email est confirmé, rediriger directement vers le dashboard
    // Le dashboard gérera l'affichage de la checklist si nécessaire
    if (data.user && data.user.email_confirmed_at) {
      // Récupérer le profil pour obtenir le rôle
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", data.user.id as any)
        .maybeSingle();

      // Pour les admins, rediriger directement vers le dashboard admin
      const profileData = profile as any;
      if (profileData?.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", origin));
      }

      // Pour les propriétaires, rediriger vers le dashboard propriétaire
      if (profileData?.role === "owner") {
        return NextResponse.redirect(new URL("/owner/dashboard", origin));
      }

      // Pour les locataires, rediriger vers le dashboard locataire
      if (profileData?.role === "tenant") {
        return NextResponse.redirect(new URL("/tenant/dashboard", origin));
      }

      // Pour les prestataires, rediriger vers le dashboard prestataire
      if (profileData?.role === "provider") {
        return NextResponse.redirect(new URL("/provider/dashboard", origin));
      }

      // Pour les autres, rediriger vers le dashboard qui gérera la checklist
      return NextResponse.redirect(new URL("/dashboard", origin));
    }
  }

  // Redirige vers le dashboard après authentification
  return NextResponse.redirect(new URL("/dashboard", origin));
}

