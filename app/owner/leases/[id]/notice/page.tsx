import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { OwnerNoticeClient } from "./OwnerNoticeClient";

export default async function OwnerNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leaseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const serviceClient = getServiceClient();

  // Fetch lease with property and signers
  const { data: lease, error } = await serviceClient
    .from("leases")
    .select(`
      id,
      type_bail,
      statut,
      date_debut,
      date_fin,
      loyer,
      charges_forfaitaires,
      depot_de_garantie,
      properties!leases_property_id_fkey (
        id,
        owner_id,
        adresse_complete,
        ville,
        code_postal,
        zone_tendue
      ),
      lease_signers (
        id,
        role,
        profile_id,
        profiles (id, prenom, nom, email)
      )
    `)
    .eq("id", leaseId)
    .single();

  if (error || !lease) redirect("/owner/leases");

  const leaseData = lease as any;

  // Verify ownership
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (
    !profile ||
    (profile.role !== "admin" && leaseData.properties?.owner_id !== profile.id)
  ) {
    redirect("/owner/leases");
  }

  // Extract tenant info
  const tenantSigner = leaseData.lease_signers?.find(
    (s: any) =>
      s.role === "locataire_principal" ||
      s.role === "locataire" ||
      s.role === "tenant"
  );

  return (
    <OwnerNoticeClient
      lease={{
        id: leaseData.id,
        type_bail: leaseData.type_bail,
        statut: leaseData.statut,
        date_debut: leaseData.date_debut,
        date_fin: leaseData.date_fin,
        loyer: leaseData.loyer,
        charges: leaseData.charges_forfaitaires,
        depot_garantie: leaseData.depot_de_garantie,
      }}
      property={{
        adresse: leaseData.properties?.adresse_complete || "",
        ville: leaseData.properties?.ville || "",
        code_postal: leaseData.properties?.code_postal || "",
        zone_tendue: leaseData.properties?.zone_tendue || false,
      }}
      tenant={
        tenantSigner?.profiles
          ? {
              prenom: tenantSigner.profiles.prenom,
              nom: tenantSigner.profiles.nom,
              email: tenantSigner.profiles.email,
            }
          : null
      }
    />
  );
}
