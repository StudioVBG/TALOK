export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TenantSettingsClient } from "./TenantSettingsClient";

export default async function TenantSettingsPage() {
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // 2. Récupérer le profil complet
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id,
      user_id,
      role,
      prenom,
      nom,
      email,
      telephone,
      avatar_url,
      date_naissance,
      lieu_naissance,
      nationalite,
      adresse
    `)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle
  if (profile.role !== "tenant") {
    redirect("/owner/dashboard");
  }

  // 4. Récupérer les données spécifiques locataire
  const { data: tenantProfile } = await supabase
    .from("tenant_profiles")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  return (
    <TenantSettingsClient 
      profile={profile} 
      tenantProfile={tenantProfile}
      userEmail={user.email || ""}
    />
  );
}
