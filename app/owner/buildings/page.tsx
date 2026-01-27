import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuildingsListClient } from "./BuildingsListClient";

export const metadata: Metadata = {
  title: "Mes Immeubles | Talok",
  description: "Gérez vos immeubles et leurs lots : appartements, locaux commerciaux, parkings.",
  robots: { index: false, follow: false },
};

export default async function BuildingsPage() {
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

  // Fetch buildings with unit counts
  const { data: buildings, error } = await supabase
    .from("properties")
    .select(`
      id,
      adresse_complete,
      ville,
      code_postal,
      surface,
      cover_url,
      created_at,
      building_floors:buildings(floors),
      units_count:building_units(count)
    `)
    .eq("owner_id", profile.id)
    .eq("type", "immeuble")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BuildingsPage] Error fetching buildings:", error);
  }

  return <BuildingsListClient buildings={buildings || []} />;
}
