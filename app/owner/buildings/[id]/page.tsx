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

    // Essayer par property_id d'abord (sans filtre type pour robustesse)
    let building = (await serviceClient
      .from("properties")
      .select("adresse_complete, ville")
      .eq("id", id)
      .is("deleted_at", null)
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
          .is("deleted_at", null)
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
  // Stratégie : query large (sans filtre type) puis vérification post-query
  let propertyId = id;

  // 1. Chercher la property par id + owner_id (sans filtre type pour robustesse)
  const { data: property, error } = await serviceClient
    .from("properties")
    .select(`
      id,
      type,
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
    .is("deleted_at", null)
    .maybeSingle();

  if (property) {
    // Property trouvée — vérifier que c'est bien un immeuble
    if (property.type !== "immeuble") {
      // Ce n'est pas un immeuble, rediriger vers la fiche bien classique
      redirect(`/owner/properties/${id}`);
    }
  }

  if (!property) {
    // 2. Fallback : peut-être que l'URL contient un building_id au lieu d'un property_id
    const { data: buildingRecord } = await serviceClient
      .from("buildings")
      .select("property_id")
      .eq("id", id)
      .maybeSingle();

    if (buildingRecord?.property_id) {
      // Rediriger vers l'URL canonique avec property_id
      redirect(`/owner/buildings/${buildingRecord.property_id}`);
    }

    // 3. Diagnostic : la property existe-t-elle sans filtre owner_id ?
    const { data: anyProperty } = await serviceClient
      .from("properties")
      .select("id, owner_id, type, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (anyProperty) {
      console.error("[building-detail] Property exists but access denied:", {
        id,
        requestedBy: profile.id,
        actualOwner: anyProperty.owner_id,
        ownerMatch: anyProperty.owner_id === profile.id,
        type: anyProperty.type,
        deleted_at: anyProperty.deleted_at,
      });
    } else {
      console.error("[building-detail] Property not found in DB at all:", { id, error });
    }

    notFound();
  }

  // À ce stade, property est non-null et de type immeuble
  const building = property;
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
