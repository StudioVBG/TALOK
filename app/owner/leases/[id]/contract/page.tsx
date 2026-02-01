export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchLeaseDetails } from "../../../_data/fetchLeaseDetails";
import { ContractView } from "./ContractView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaseContractPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, email, telephone")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  const { data: ownerProfileData } = await supabase
    .from("owner_profiles")
    .select("adresse_facturation, adresse_siege, type, raison_sociale, forme_juridique, siret")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const ownerAddress = ownerProfileData?.adresse_facturation || ownerProfileData?.adresse_siege || "";

  const details = await fetchLeaseDetails(id, profile.id);
  if (!details) redirect("/owner/leases");

  return (
    <ContractView
      details={details}
      leaseId={id}
      ownerProfile={{
        id: profile.id,
        prenom: profile.prenom || "",
        nom: profile.nom || "",
        email: profile.email || "",
        telephone: profile.telephone || "",
        adresse: ownerAddress,
        type: ownerProfileData?.type || "particulier",
        raison_sociale: ownerProfileData?.raison_sociale || "",
        forme_juridique: ownerProfileData?.forme_juridique || "",
        siret: ownerProfileData?.siret || "",
      }}
    />
  );
}
