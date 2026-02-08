export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page /owner/entities/[entityId] — Fiche détaillée d'une entité juridique
 */

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntityDetailClient } from "./EntityDetailClient";

interface PageProps {
  params: Promise<{ entityId: string }>;
}

export default async function EntityDetailPage({ params }: PageProps) {
  const { entityId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Fetch entity with associates
  const { data: entity, error } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("id", entityId)
    .single();

  if (error || !entity) notFound();

  // Fetch associates
  const { data: associates } = await supabase
    .from("entity_associates")
    .select("*")
    .eq("legal_entity_id", entityId)
    .eq("is_current", true)
    .order("pourcentage_capital", { ascending: false });

  // Fetch properties linked to this entity
  const { data: ownedProperties } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville, code_postal, type, surface, loyer_hc, legal_entity_id, detention_mode")
    .eq("legal_entity_id", entityId)
    .is("deleted_at", null)
    .order("adresse_complete");

  // Fetch unassigned properties (no entity, available for assignment)
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const { data: unassignedProperties } = profile
    ? await supabase
        .from("properties")
        .select("id, adresse_complete, ville, code_postal, type, surface, loyer_hc, legal_entity_id")
        .eq("owner_id", profile.id)
        .is("legal_entity_id", null)
        .is("deleted_at", null)
        .order("adresse_complete")
    : { data: [] };

  return (
    <EntityDetailClient
      entity={entity as Record<string, unknown>}
      associates={(associates || []) as Record<string, unknown>[]}
      properties={(ownedProperties || []) as Record<string, unknown>[]}
      unassignedProperties={(unassignedProperties || []) as Record<string, unknown>[]}
    />
  );
}
