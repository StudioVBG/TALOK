// @ts-nocheck
/**
 * Data fetching pour la complétion du profil (Owner)
 * Server-side uniquement
 */

import { createClient as createServerClient } from "@supabase/supabase-js";
import type { ProfileCompletionData } from "@/components/owner/dashboard/profile-completion-card";

/**
 * Récupère les données de complétion du profil pour un propriétaire
 * Utilise le service role pour contourner les RLS
 */
export async function fetchProfileCompletion(
  ownerId: string
): Promise<ProfileCompletionData> {
  // Utiliser le service role pour éviter les problèmes RLS
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Récupérer le profil de base
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, telephone, avatar_url, date_naissance")
    .eq("id", ownerId)
    .single();

  // Récupérer le profil propriétaire
  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("type, siret, iban, adresse_facturation, adresse_siege, raison_sociale")
    .eq("profile_id", ownerId)
    .single();

  // Compter les propriétés
  const { count: propertiesCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  // Compter les baux (en vérifiant via les propriétés du propriétaire)
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId);

  let leasesCount = 0;
  if (properties && properties.length > 0) {
    const propertyIds = properties.map((p) => p.id);
    const { count } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .neq("statut", "terminated");
    leasesCount = count || 0;
  }

  // Vérifier si un document d'identité existe
  const { count: identityDocsCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .in("type", ["piece_identite", "identite", "cni", "passeport"]);

  return {
    // Profile de base
    hasFirstName: !!profile?.prenom && profile.prenom.trim().length > 0,
    hasLastName: !!profile?.nom && profile.nom.trim().length > 0,
    hasPhone: !!profile?.telephone && profile.telephone.trim().length > 0,
    hasAvatar: !!profile?.avatar_url && profile.avatar_url.trim().length > 0,
    hasBirthDate: !!profile?.date_naissance,
    // Owner profile
    hasOwnerType: !!ownerProfile?.type,
    hasSiret: !!ownerProfile?.siret && ownerProfile.siret.trim().length > 0,
    hasIban: !!ownerProfile?.iban && ownerProfile.iban.trim().length > 0,
    hasBillingAddress: (!!ownerProfile?.adresse_facturation && ownerProfile.adresse_facturation.trim().length > 0) || 
                       (!!ownerProfile?.adresse_siege && ownerProfile.adresse_siege.trim().length > 0),
    // Documents
    hasIdentityDocument: (identityDocsCount || 0) > 0,
    // Propriétés
    hasProperty: (propertiesCount || 0) > 0,
    hasLease: leasesCount > 0,
    // Type de propriétaire
    ownerType: ownerProfile?.type as "particulier" | "societe" | null,
  };
}

