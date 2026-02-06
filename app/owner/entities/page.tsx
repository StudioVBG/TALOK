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

  // Fetch entities — profile.id is the FK value for legal_entities.owner_profile_id
  const { data } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("owner_profile_id", profile.id)
    .eq("is_active", true)
    .order("nom");

  const entities: Record<string, unknown>[] = (data || []) as Record<string, unknown>[];

  return <EntitiesPageClient entities={entities} />;
}
