export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";

/**
 * Server Component - Charge les données supplémentaires non couvertes par le layout
 * Les données principales sont dans le Context via TenantDataProvider
 */
export default async function TenantDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let pendingEDLs: Array<{
    id: string;
    type: string;
    status: string;
    scheduled_at: string;
    invitation_token: string;
    property_address: string;
  }> = [];

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      const { data: edls } = await supabase
        .from("edl_signatures")
        .select(`
          id, invitation_token, signed_at, signature_image_path,
          edl:edl_id(id, type, status, scheduled_at, property:property_id(adresse_complete))
        `)
        .eq("signer_profile_id", profile.id)
        .is("signature_image_path", null);

      if (edls && edls.length > 0) {
        pendingEDLs = edls
          .filter((sig: any) => sig.edl && sig.edl.status !== 'draft')
          .map((sig: any) => ({
            id: sig.edl.id,
            type: sig.edl.type,
            status: sig.edl.status,
            scheduled_at: sig.edl.scheduled_at,
            invitation_token: sig.invitation_token,
            property_address: sig.edl.property?.adresse_complete || 'Adresse non renseignée'
          }));
      }
    }
  }

  return <DashboardClient serverPendingEDLs={pendingEDLs} />;
}
