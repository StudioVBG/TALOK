// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function fetchTenantLease(userId: string) {
  const supabase = await createClient();
  // UTILISER SERVICE CLIENT POUR BYPASS RLS
  const serviceClient = getServiceClient();

  console.log("[fetchTenantLease] 🔍 Recherche pour user_id:", userId);

  // Récupérer le profil tenant par user_id avec SERVICE CLIENT
  let profile: { id: string; email?: string } | null = null;
  
  const { data: profileByUserId, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, email")
    .eq("user_id", userId)
    .single();

  if (!profileError && profileByUserId) {
    profile = profileByUserId;
    console.log("[fetchTenantLease] ✅ Profil trouvé par user_id:", profile.id);
  } else {
    console.log("[fetchTenantLease] ⚠️ Profil non trouvé par user_id, recherche par email...");
    
    // Fallback: chercher l'email de l'utilisateur auth puis le profil
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      console.log("[fetchTenantLease] 🔍 Recherche profil par email:", user.email);
      
      const { data: profileByEmail, error: emailError } = await serviceClient
        .from("profiles")
        .select("id, email, user_id")
        .eq("email", user.email)
        .maybeSingle();
      
      if (emailError) {
        console.log("[fetchTenantLease] Erreur recherche email:", emailError.message);
      }
      
      if (profileByEmail) {
        profile = profileByEmail;
        console.log("[fetchTenantLease] ✅ Profil trouvé par email:", profile.id);
        
        // IMPORTANT: Lier ce profil au user_id pour les prochaines fois
        if (!profileByEmail.user_id) {
          const { error: updateError } = await serviceClient
            .from("profiles")
            .update({ user_id: userId })
            .eq("id", profile.id);
          
          if (updateError) {
            console.error("[fetchTenantLease] ❌ Erreur liaison user_id:", updateError.message);
          } else {
            console.log("[fetchTenantLease] 🔗 Profil lié au user_id:", userId);
          }
        }
      } else {
        console.log("[fetchTenantLease] ❌ Aucun profil trouvé avec email:", user.email);
      }
    }
  }

  if (!profile) {
    console.warn("[fetchTenantLease] ❌ Profil introuvable pour le user", userId);
    return null;
  }

  // Récupérer le bail lié à ce profil via lease_signers avec SERVICE CLIENT
  const { data: leaseSigner, error: signerError } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (signerError) {
    console.log("[fetchTenantLease] ❌ Erreur lease_signers:", signerError.message);
    return null;
  }
  
  if (!leaseSigner) {
    console.log("[fetchTenantLease] ❌ Aucun lease_signer trouvé pour profile:", profile.id);
    return null;
  }

  console.log("[fetchTenantLease] ✅ Bail trouvé:", leaseSigner.lease_id);

  // Récupérer le bail complet avec SERVICE CLIENT
  const { data: lease, error: leaseError } = await serviceClient
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
    console.error("[fetchTenantLease] ❌ Bail introuvable:", leaseError?.message);
    return null;
  }

  console.log("[fetchTenantLease] ✅ Bail chargé avec succès:", lease.id, "statut:", lease.statut);
  return lease;
}
