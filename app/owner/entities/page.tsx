export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page /owner/entities — Liste des entités juridiques du propriétaire
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntitiesPageClient } from "./EntitiesPageClient";

export default async function EntitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/auth/signin");

  // Fetch owner_profile
  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  // Fetch entities
  let entities: Record<string, unknown>[] = [];
  if (ownerProfile?.id) {
    const { data } = await supabase
      .from("legal_entities")
      .select("*")
      .eq("owner_profile_id", ownerProfile.id)
      .eq("is_active", true)
      .order("nom");

    entities = (data || []) as Record<string, unknown>[];
  }

  return <EntitiesPageClient entities={entities} />;
}
