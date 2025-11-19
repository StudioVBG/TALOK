import { createClient } from "@/lib/supabase/server";

export async function fetchTenantLease(userId: string) {
  const supabase = await createClient();

  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) return null;

  // Récupérer le bail actif
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      *,
      property:properties (
        *,
        owner:profiles!owner_id (
          prenom,
          nom,
          email,
          telephone
        )
      ),
      documents (*)
    `)
    .eq("statut", "active") // Ou pending_signature
    // TODO: Filtrer par lease_signers pour être sûr que c'est le bon locataire
    // Pour l'instant on suppose une relation simple ou on utilise une vue
    .limit(1)
    .maybeSingle();
    
  // Correction: La relation directe leases -> profile n'existe pas, il faut passer par lease_signers
  // Mais pour simplifier ici, on va utiliser une approche plus robuste :
  
  const { data: leaseSigner } = await supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .eq("signature_status", "signed") // ou pending
    .limit(1)
    .maybeSingle();

  if (!leaseSigner) return null;

  const { data: fullLease } = await supabase
    .from("leases")
    .select(`
      *,
      property:properties (
        *,
        owner:profiles!owner_id (
          prenom,
          nom,
          email,
          telephone
        )
      ),
      documents (*)
    `)
    .eq("id", leaseSigner.lease_id)
    .single();

  return fullLease;
}
