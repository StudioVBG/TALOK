// @ts-nocheck
import { createClient } from "@/lib/supabase/server";

export async function fetchTenantLease(userId: string) {
  const supabase = await createClient();

  // Récupérer le profil tenant
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    console.warn("[fetchTenantLease] Profil introuvable pour le user", userId);
    return null;
  }

  // Récupérer le bail lié à ce profil via lease_signers
  const { data: leaseSigner, error: signerError } = await supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (signerError || !leaseSigner) {
    return null;
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select(`
      *,
      property:properties (
        *,
        owner:profiles!owner_id (
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      ),
      documents (*),
      lease_signers(
        id,
        role,
        signature_status,
        signed_at,
        profiles (
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      )
    `)
    .eq("id", leaseSigner.lease_id)
    .single();

  if (leaseError || !lease) {
    console.error("[fetchTenantLease] Bail introuvable:", leaseError);
    return null;
  }

  return lease;
}
