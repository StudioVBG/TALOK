export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { BuildingDetailClient } from "./BuildingDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  try {
    const { id } = await params;
    const serviceClient = getServiceClient();

    // Essayer par property_id d'abord
    let building = (await serviceClient
      .from("properties")
      .select("adresse_complete, ville")
      .eq("id", id)
      .eq("type", "immeuble")
      .maybeSingle()).data;

    // Fallback par building_id → property_id
    if (!building) {
      const { data: br } = await serviceClient
        .from("buildings")
        .select("property_id")
        .eq("id", id)
        .maybeSingle();
      if (br?.property_id) {
        building = (await serviceClient
          .from("properties")
          .select("adresse_complete, ville")
          .eq("id", br.property_id)
          .maybeSingle()).data;
      }
    }

    if (!building) {
      return { title: "Immeuble non trouvé | Talok" };
    }

    return {
      title: `${building.adresse_complete} | Talok`,
      description: `Gestion de l'immeuble situé à ${building.ville}`,
    };
  } catch {
    return { title: "Immeuble | Talok" };
  }
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

  // Fetch building — le param [id] peut être un property_id OU un building_id
  // Essayer d'abord par property_id (cas normal), sinon par building_id (fallback)
  let propertyId = id;

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
    .maybeSingle();

  if (!building) {
    // Fallback : peut-être que l'URL contient un building_id au lieu d'un property_id
    const { data: buildingRecord } = await serviceClient
      .from("buildings")
      .select("property_id")
      .eq("id", id)
      .maybeSingle();

    if (buildingRecord?.property_id) {
      // Rediriger vers l'URL canonique avec property_id
      redirect(`/owner/buildings/${buildingRecord.property_id}`);
    }

    console.error("[building-detail] Property not found:", { id, ownerId: profile.id, error });
    notFound();
  }

  propertyId = building.id;

  // Fetch building metadata
  const { data: buildingMeta } = await serviceClient
    .from("buildings")
    .select("*")
    .eq("property_id", propertyId)
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
      propertyId={propertyId}
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
