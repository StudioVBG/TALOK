export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page /owner/entities — Liste des entités juridiques du propriétaire
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { EntitiesPageClient } from "./EntitiesPageClient";

export default async function EntitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/auth/signin");

  // Fetch entities — profile.id is the FK value for legal_entities.owner_profile_id
  let { data } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("owner_profile_id", profile.id)
    .eq("is_active", true)
    .order("nom");

  // Fallback : si aucune entité, auto-provisionner via service client (bypass RLS)
  if (!data || data.length === 0) {
    const serviceClient = getServiceClient();

    // Garantir owner_profiles
    const { data: op } = await serviceClient
      .from("owner_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!op) {
      const { error: opError } = await serviceClient
        .from("owner_profiles")
        .insert({ profile_id: profile.id, type: "particulier" });
      if (opError) {
        console.error("[EntitiesPage] Failed to create owner_profiles:", opError.message);
      }
    }

    // Créer l'entité par défaut
    const nom =
      [profile.prenom, profile.nom].filter(Boolean).join(" ") || "Patrimoine personnel";

    const { data: newEntity, error: leError } = await serviceClient
      .from("legal_entities")
      .insert({
        owner_profile_id: profile.id,
        entity_type: "particulier",
        nom,
        regime_fiscal: "ir",
        is_active: true,
      })
      .select()
      .single();

    if (leError) {
      console.error("[EntitiesPage] Failed to create legal_entity:", leError.message);
    } else if (newEntity) {
      // Lier les propriétés orphelines
      const { error: linkError } = await serviceClient
        .from("properties")
        .update({ legal_entity_id: newEntity.id })
        .eq("owner_id", profile.id)
        .is("legal_entity_id", null)
        .is("deleted_at", null);

      if (linkError) {
        console.error("[EntitiesPage] Failed to link orphan properties:", linkError.message);
      }

      // Re-fetch avec le client user (RLS) pour obtenir les données fraîches
      const { data: refreshed } = await supabase
        .from("legal_entities")
        .select("*")
        .eq("owner_profile_id", profile.id)
        .eq("is_active", true)
        .order("nom");

      data = refreshed;
    }
  }

  const entities: Record<string, unknown>[] = (data || []) as Record<string, unknown>[];

  return <EntitiesPageClient entities={entities} />;
}
