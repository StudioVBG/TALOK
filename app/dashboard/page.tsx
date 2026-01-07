import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Page /dashboard - Redirection intelligente vers le dashboard du rôle
 * 
 * Cette page détecte le rôle de l'utilisateur et le redirige vers
 * son dashboard spécifique.
 */
export default async function DashboardRedirectPage() {
  const supabase = await createClient();
  
  // Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect("/auth/signin");
  }
  
  // Récupérer le profil pour connaître le rôle
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  
  // Rediriger vers le bon dashboard selon le rôle
  const role = profile?.role;
  
  switch (role) {
    case "admin":
      redirect("/admin/dashboard");
    case "owner":
      redirect("/owner/dashboard");
    case "tenant":
      redirect("/tenant/dashboard");
    case "provider":
      redirect("/provider/dashboard");
    case "agency":
      redirect("/agency/dashboard");
    case "syndic":
      redirect("/syndic/dashboard");
    case "copro":
      redirect("/copro/dashboard");
    case "guarantor":
      redirect("/guarantor/dashboard");
    default:
      // Si rôle inconnu, rediriger vers l'accueil
      redirect("/");
  }
}

