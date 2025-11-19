import { createClient } from "@/lib/supabase/server";

export interface LeaseDetails {
  lease: any; // TODO: Typage strict
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    cover_url: string | null;
  };
  signers: any[];
  payments: any[];
  documents: any[];
}

export async function fetchLeaseDetails(leaseId: string, ownerId: string): Promise<LeaseDetails | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("lease_details", {
    p_lease_id: leaseId,
    p_owner_id: ownerId,
  });

  if (error) {
    console.error("[fetchLeaseDetails] RPC Error:", error);
    throw new Error("Erreur lors du chargement des détails du bail");
  }

  if (!data) return null;

  return data as LeaseDetails;
}

