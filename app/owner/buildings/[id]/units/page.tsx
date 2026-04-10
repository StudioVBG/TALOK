export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { UnitsManagementClient } from "./UnitsManagementClient";

export const metadata: Metadata = {
  title: "Gestion des lots | Talok",
  description: "Ajoutez et gérez les lots de votre immeuble.",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function UnitsPage({ params }: PageProps) {
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

  // Verify building ownership (sans filtre type pour robustesse)
  const { data: building, error } = await serviceClient
    .from("properties")
    .select("id, type, adresse_complete, ville")
    .eq("id", id)
    .eq("owner_id", profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!building) {
    console.error("[units-page] Property not found:", { id, ownerId: profile.id, error });
    notFound();
  }

  // Si ce n'est pas un immeuble, rediriger vers la fiche bien
  if (building.type !== "immeuble") {
    redirect(`/owner/properties/${id}`);
  }

  // Fetch building metadata (from buildings table linked to this property)
  const { data: buildingRecord } = await serviceClient
    .from("buildings")
    .select("id, floors, has_ascenseur, has_gardien, has_interphone, has_digicode, has_local_velo, has_local_poubelles")
    .eq("property_id", id)
    .maybeSingle();

  // Fetch existing units via building_id (relation principale) avec fallback property_id
  const { data: units } = buildingRecord?.id
    ? await serviceClient
        .from("building_units")
        .select("*")
        .eq("building_id", buildingRecord.id)
        .order("floor", { ascending: true })
        .order("position", { ascending: true })
    : await serviceClient
        .from("building_units")
        .select("*")
        .eq("property_id", id)
        .order("floor", { ascending: true })
        .order("position", { ascending: true });

  return (
    <UnitsManagementClient
      propertyId={id}
      buildingName={building.adresse_complete}
      buildingCity={building.ville}
      existingUnits={units || []}
      buildingMeta={buildingRecord ? {
        floors: buildingRecord.floors ?? undefined,
        has_ascenseur: buildingRecord.has_ascenseur ?? undefined,
        has_gardien: buildingRecord.has_gardien ?? undefined,
        has_interphone: buildingRecord.has_interphone ?? undefined,
        has_digicode: buildingRecord.has_digicode ?? undefined,
        has_local_velo: buildingRecord.has_local_velo ?? undefined,
        has_local_poubelles: buildingRecord.has_local_poubelles ?? undefined,
      } : null}
    />
  );
}
