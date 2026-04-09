import type { Metadata, ResolvingMetadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { BuildingDetailClient } from "./BuildingDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const serviceClient = getServiceClient();

  const { data: building } = await serviceClient
    .from("properties")
    .select("adresse_complete, ville")
    .eq("id", id)
    .eq("type", "immeuble")
    .single();

  if (!building) {
    return { title: "Immeuble non trouvé | Talok" };
  }

  return {
    title: `${building.adresse_complete} | Talok`,
    description: `Gestion de l'immeuble situé à ${building.ville}`,
  };
}

export default async function BuildingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Service client pour bypasser RLS (évite récursion user_profile_id())
  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Fetch building with units — adminClient avec vérification manuelle owner_id
  const { data: building, error } = await serviceClient
    .from("properties")
    .select(`
      id,
      adresse_complete,
      ville,
      code_postal,
      departement,
      surface,
      cover_url,
      annee_construction,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .eq("owner_id", profile.id)
    .eq("type", "immeuble")
    .is("deleted_at", null)
    .single();

  if (error || !building) {
    notFound();
  }

  // Fetch building metadata
  const { data: buildingMeta } = await serviceClient
    .from("buildings")
    .select("*")
    .eq("property_id", id)
    .single();

  // Fetch units via building_id (pas property_id qui pointe vers le lot individuel)
  const units = buildingMeta?.id
    ? (await serviceClient
        .from("building_units")
        .select(`
          id,
          floor,
          position,
          type,
          template,
          surface,
          nb_pieces,
          loyer_hc,
          charges,
          depot_garantie,
          status,
          property_id,
          current_lease_id,
          notes
        `)
        .eq("building_id", buildingMeta.id)
        .order("floor", { ascending: true })
        .order("position", { ascending: true })).data
    : null;

  return (
    <BuildingDetailClient
      propertyId={id}
      buildingId={buildingMeta?.id ?? null}
      building={{
        ...building,
        cover_url: building.cover_url ?? null,
        annee_construction: building.annee_construction ?? null,
      }}
      buildingMeta={buildingMeta ?? null}
      units={units || []}
    />
  );
}
