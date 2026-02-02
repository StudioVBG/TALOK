export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GedClient } from "./GedClient";

export default async function GedPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; lease_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Récupérer les propriétés pour le sélecteur d'upload
  const { data: properties } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville")
    .eq("owner_id", profile.id)
    .order("adresse_complete", { ascending: true });

  return (
    <GedClient
      properties={
        properties?.map((p) => ({
          id: p.id,
          adresse_complete: p.adresse_complete || "",
          ville: p.ville || "",
        })) || []
      }
    />
  );
}
