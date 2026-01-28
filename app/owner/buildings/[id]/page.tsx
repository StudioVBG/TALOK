import type { Metadata, ResolvingMetadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuildingDetailClient } from "./BuildingDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: building } = await supabase
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Fetch building with units
  const { data: building, error } = await supabase
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
  const { data: buildingMeta } = await supabase
    .from("buildings")
    .select("*")
    .eq("property_id", id)
    .single();

  // Fetch units
  const { data: units } = await supabase
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
      current_lease_id,
      notes
    `)
    .eq("property_id", id)
    .order("floor", { ascending: true })
    .order("position", { ascending: true });

  return (
    <BuildingDetailClient
      building={building}
      buildingMeta={buildingMeta}
      units={units || []}
    />
  );
}
