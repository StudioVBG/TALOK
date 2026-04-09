import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { TenantNoticeClient } from "./TenantNoticeClient";

export default async function TenantNoticePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const serviceClient = getServiceClient();

  // Find tenant's profile
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, prenom, nom, email")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/tenant/lease");

  // Find the active lease where this user is a tenant signer
  const { data: signerRows } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .in("role", [
      "locataire_principal",
      "locataire",
      "tenant",
      "colocataire",
    ]);

  const leaseIds = (signerRows || []).map((r: any) => r.lease_id);
  if (leaseIds.length === 0) redirect("/tenant/lease");

  // Fetch the active lease
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
    .in("id", leaseIds)
    .eq("statut", "active")
    .limit(1)
    .maybeSingle();

  if (error || !lease) redirect("/tenant/lease");

  const leaseData = lease as any;

  // Find owner info
  const ownerSigner = leaseData.lease_signers?.find(
    (s: any) => s.role === "proprietaire" || s.role === "owner" || s.role === "bailleur"
  );

  return (
    <TenantNoticeClient
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
      tenant={{
        prenom: profile.prenom,
        nom: profile.nom,
        email: profile.email,
      }}
      owner={
        ownerSigner?.profiles
          ? {
              prenom: ownerSigner.profiles.prenom,
              nom: ownerSigner.profiles.nom,
            }
          : null
      }
    />
  );
}
