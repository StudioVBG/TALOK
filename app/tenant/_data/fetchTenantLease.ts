import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { linkOrphanSigners, linkProfileToUser } from "@/features/tenant/services/tenant-linking.service";
import type { LeaseRow, PropertyRow, ProfileRow, LeaseSignerRow, DocumentRow } from "@/lib/supabase/database.types";

type LeaseSignerWithProfile = LeaseSignerRow & {
  profiles: Pick<ProfileRow, "id" | "prenom" | "nom" | "email" | "telephone" | "avatar_url"> | null;
};

type LeaseWithRelations = LeaseRow & {
  property: (PropertyRow & {
    owner: Pick<ProfileRow, "id" | "prenom" | "nom" | "email" | "telephone" | "avatar_url"> | null;
  }) | null;
  documents: DocumentRow[];
  lease_signers: LeaseSignerWithProfile[] | null;
};

type LeaseSignerWithUrl = LeaseSignerWithProfile & {
  signature_image: string | null;
};

type MappedLease = Omit<LeaseWithRelations, "lease_signers" | "property"> & {
  property: (PropertyRow & {
    ville: string;
    code_postal: string;
    adresse_complete: string;
    owner: Pick<ProfileRow, "id" | "prenom" | "nom" | "email" | "telephone" | "avatar_url"> & {
      name: string;
    } | null;
  }) | null;
  owner: (Pick<ProfileRow, "id" | "prenom" | "nom" | "email" | "telephone" | "avatar_url"> & {
    name: string;
  }) | null;
  lease_signers: LeaseSignerWithUrl[];
};

export async function fetchTenantLease(userId: string): Promise<MappedLease | null> {
  const supabase = await createClient();
  // UTILISER SERVICE CLIENT POUR BYPASS RLS
  const serviceClient = getServiceClient();

  // Récupérer le profil tenant par user_id avec SERVICE CLIENT
  let profile: Pick<ProfileRow, "id" | "email" | "user_id"> | null = null;
  
  const { data: profileByUserId, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, email, user_id")
    .eq("user_id", userId)
    .single() as { data: Pick<ProfileRow, "id" | "email" | "user_id"> | null; error: Error | null };

  if (!profileError && profileByUserId) {
    profile = { ...profileByUserId, user_id: profileByUserId.user_id ?? userId };
  } else {
    // Fallback: chercher l'email de l'utilisateur auth puis le profil
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      const { data: profileByEmail, error: emailError } = await serviceClient
        .from("profiles")
        .select("id, email, user_id")
        .eq("email", user.email)
        .maybeSingle() as { data: Pick<ProfileRow, "id" | "email" | "user_id"> | null; error: Error | null };

      if (profileByEmail) {
        profile = profileByEmail;

        // IMPORTANT: Lier ce profil au user_id pour les prochaines fois
        if (!profileByEmail.user_id) {
          await linkProfileToUser(profileByEmail.id, userId);
        }
      }
    }
  }

  if (!profile) {
    console.warn("[fetchTenantLease] ❌ Profil introuvable pour le user", userId);
    return null;
  }

  // Récupérer l'email de l'utilisateur pour la recherche par invited_email
  let userEmail = "";
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    userEmail = authUser?.email?.toLowerCase().trim() || "";
  } catch {
    console.warn("[fetchTenantLease] Impossible de récupérer l'email auth");
  }

  // Récupérer les baux via lease_signers par profile_id
  const { data: signersByProfile, error: signerError } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false }) as { data: Pick<LeaseSignerRow, "lease_id">[] | null; error: Error | null };

  if (signerError) {
    console.warn("[fetchTenantLease] Erreur lease_signers (profile):", signerError.message);
  }

  const leaseIdsByProfile = (signersByProfile || []).map(ls => ls.lease_id);

  // Recherche supplémentaire par invited_email (fallback)
  let leaseIdsByEmail: string[] = [];
  if (userEmail) {
    const { data: signersByEmail } = await serviceClient
      .from("lease_signers")
      .select("lease_id, id, profile_id")
      .ilike("invited_email", userEmail);

    if (signersByEmail && signersByEmail.length > 0) {
      leaseIdsByEmail = signersByEmail.map((s: { lease_id: string }) => s.lease_id);

      // Auto-heal: lier les signers orphelins trouvés par email (service centralisé)
      await linkOrphanSigners(profile.id, userEmail);
    }
  }

  // Union des lease_ids (profile_id + email)
  const leaseIds = [...new Set([...leaseIdsByProfile, ...leaseIdsByEmail])];

  if (leaseIds.length === 0) {
    return null;
  }


  // Récupérer tous les baux complets avec SERVICE CLIENT
  const { data: leases, error: leaseError } = await serviceClient
    .from("leases")
    .select(`
      *,
      property:properties (
        *,
        owner:profiles!owner_id (
          id,
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
        signature_image_path,
        proof_id,
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
    .in("id", leaseIds) as { data: LeaseWithRelations[] | null; error: Error | null };

  if (leaseError || !leases) {
    console.error("[fetchTenantLease] ❌ Baux introuvables:", leaseError?.message);
    return null;
  }

  // ✅ SOTA 2026: Générer des URLs signées pour les images de signature (bucket privé)
  const mappedLeases = await Promise.all(leases.map(async (l): Promise<MappedLease> => {
    // Générer les URLs signées pour chaque signataire
    const signersWithUrls = await Promise.all((l.lease_signers || []).map(async (s: LeaseSignerWithProfile): Promise<LeaseSignerWithUrl> => {
      let signatureImageUrl: string | null = null;
      
      if (s.signature_image_path) {
        try {
          const { data: signedUrlData } = await serviceClient.storage
            .from("documents")
            .createSignedUrl(s.signature_image_path, 3600);
          
          if (signedUrlData?.signedUrl) {
            signatureImageUrl = signedUrlData.signedUrl;
          }
        } catch (err) {
          console.error("[fetchTenantLease] Error generating signed URL:", err);
        }
      }
      
      return { ...s, signature_image: signatureImageUrl };
    }));
    
    const ownerWithName = l.property?.owner
      ? { ...l.property.owner, name: `${l.property.owner.prenom || ""} ${l.property.owner.nom || ""}`.trim() || "Propriétaire" }
      : null;
    return {
      ...l,
      property: l.property
        ? {
            ...l.property,
            ville: l.property.ville || "Ville inconnue",
            code_postal: l.property.code_postal || "00000",
            adresse_complete: l.property.adresse_complete || "Adresse non renseignée",
            owner: ownerWithName,
          }
        : null,
      owner: ownerWithName,
      lease_signers: signersWithUrls
    };
  }));

  
  return mappedLeases[0];
}
