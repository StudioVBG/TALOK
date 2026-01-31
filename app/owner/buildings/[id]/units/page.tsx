import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Verify building ownership
  const { data: building, error } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville")
    .eq("id", id)
    .eq("owner_id", profile.id)
    .eq("type", "immeuble")
    .is("deleted_at", null)
    .single();

  if (error || !building) {
    notFound();
  }

  // Fetch existing units
  const { data: units } = await supabase
    .from("building_units")
    .select("*")
    .eq("property_id", id)
    .order("floor", { ascending: true })
    .order("position", { ascending: true });

  return (
    <UnitsManagementClient
      buildingId={id}
      buildingName={building.adresse_complete}
      buildingCity={building.ville}
      existingUnits={units || []}
    />
  );
}
