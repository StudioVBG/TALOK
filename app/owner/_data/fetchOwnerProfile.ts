// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function fetchOwnerProfile(userId: string) {
  const supabase = await createClient();

  // Récupérer le profil de base
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  // Récupérer le profil propriétaire étendu
  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("*")
    .eq("profile_id", profile.id)
    .single();

  return {
    profile,
    ownerProfile,
  };
}

