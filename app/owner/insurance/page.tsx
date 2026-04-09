export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OwnerInsuranceClient } from "./OwnerInsuranceClient";

export default async function OwnerInsurancePage() {
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

  // Recuperer les proprietes pour le formulaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id, adresse_complete")
    .eq("owner_id", profile.id)
    .order("adresse_complete", { ascending: true });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <OwnerInsuranceClient
        profileId={profile.id}
        properties={
          properties?.map((p: { id: string; adresse_complete: string | null }) => ({
            id: p.id,
            adresse_complete: p.adresse_complete || "",
          })) || []
        }
      />
    </div>
  );
}
