import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { OwnerAmendClient } from "./OwnerAmendClient";

export default async function OwnerAmendPage({
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

  // Fetch lease with property
  const { data: lease, error } = await serviceClient
    .from("leases")
    .select(`
      id,
      type_bail,
      statut,
      loyer,
      charges_forfaitaires,
      depot_de_garantie,
      date_debut,
      date_fin,
      properties!leases_property_id_fkey (
        id,
        owner_id,
        adresse_complete
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

  // Fetch existing amendments
  let amendments: any[] = [];
  try {
    const { data } = await serviceClient
      .from("lease_amendments")
      .select("*")
      .eq("lease_id", leaseId)
      .order("effective_date", { ascending: false });
    amendments = data || [];
  } catch {
    // Table may not exist yet
  }

  return (
    <OwnerAmendClient
      lease={{
        id: leaseData.id,
        type_bail: leaseData.type_bail,
        statut: leaseData.statut,
        loyer: leaseData.loyer,
        charges_forfaitaires: leaseData.charges_forfaitaires,
        property_address: leaseData.properties?.adresse_complete || "",
      }}
      existingAmendments={amendments}
    />
  );
}
