export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Page /owner/entities/[entityId]/edit — Modification d'une entité juridique
 */

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EntityEditForm } from "./EntityEditForm";

interface PageProps {
  params: Promise<{ entityId: string }>;
}

export default async function EntityEditPage({ params }: PageProps) {
  const { entityId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: entity, error } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("id", entityId)
    .single();

  if (error || !entity) notFound();

  return <EntityEditForm entity={entity as Record<string, unknown>} />;
}
