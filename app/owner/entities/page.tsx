export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntitiesClient } from "./EntitiesClient";

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

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  // Check owner_profile exists
  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("profile_id, type, raison_sociale, forme_juridique, siret")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // Fetch legal entities
  const { data: entities } = await supabase
    .from("legal_entities")
    .select("id, entity_type, nom, nom_commercial, siren, siret, ville_siege, forme_juridique, capital_social, regime_fiscal, is_active, created_at")
    .eq("owner_profile_id", profile.id)
    .order("created_at", { ascending: false });

  // For each entity, get property count
  const entityIds = (entities || []).map((e) => e.id);
  let propertyStats: Record<string, { count: number; totalRent: number }> = {};

  if (entityIds.length > 0) {
    const { data: ownerships } = await supabase
      .from("property_ownerships")
      .select("legal_entity_id, property:properties(id, loyer_hc)")
      .in("legal_entity_id", entityIds)
      .eq("is_current", true);

    if (ownerships) {
      for (const o of ownerships) {
        const eid = o.legal_entity_id;
        if (!propertyStats[eid]) propertyStats[eid] = { count: 0, totalRent: 0 };
        propertyStats[eid].count++;
        propertyStats[eid].totalRent += (o.property as any)?.loyer_hc || 0;
      }
    }
  }

  const entitiesWithStats = (entities || []).map((e) => ({
    ...e,
    properties_count: propertyStats[e.id]?.count || 0,
    monthly_rent: propertyStats[e.id]?.totalRent || 0,
  }));

  return (
    <EntitiesClient
      entities={entitiesWithStats}
      ownerType={ownerProfile?.type || "particulier"}
    />
  );
}
