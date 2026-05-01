import { requireRoleServer } from "@/lib/auth/require-role-server";
import { getServiceClient } from "@/lib/supabase/service-client";
import TenantGuarantorClient from "./TenantGuarantorClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /tenant/guarantor — Hub locataire pour inviter et suivre son garant
 *
 * Le locataire peut :
 *  - Voir son ou ses bail(s) actif(s)
 *  - Voir le statut de son garant si déjà invité (pending / accepted / declined)
 *  - Inviter un garant (si pas encore fait)
 */
export default async function TenantGuarantorPage() {
  const profile = await requireRoleServer(["tenant"]);

  const supabase = getServiceClient();

  // Baux actifs du locataire (via lease_signers)
  const { data: signerRows } = await supabase
    .from("lease_signers")
    .select(
      `
      id,
      lease_id,
      role,
      lease:leases(
        id,
        loyer,
        date_debut,
        date_fin,
        statut,
        property:properties(adresse_complete, ville)
      )
    `,
    )
    .eq("profile_id", profile.id)
    .in("role", ["locataire_principal", "colocataire"]);

  const leases =
    (signerRows ?? [])
      .map((row: any) => row.lease)
      .filter((l: any) => l && l.statut === "active") || [];

  // Invitations envoyées par ce locataire
  const leaseIds = leases.map((l: any) => l.id);
  const { data: invitations } =
    leaseIds.length > 0
      ? await supabase
          .from("guarantor_invitations")
          .select(
            "id, lease_id, guarantor_name, guarantor_email, guarantor_type, status, created_at, accepted_at",
          )
          .in("lease_id", leaseIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <TenantGuarantorClient
      profileId={profile.id}
      leases={leases}
      invitations={invitations ?? []}
    />
  );
}
