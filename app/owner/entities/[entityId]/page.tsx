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

  return (
    <EntityDetailClient
      entity={entity as Record<string, unknown>}
      associates={(associates || []) as Record<string, unknown>[]}
    />
  );
}
