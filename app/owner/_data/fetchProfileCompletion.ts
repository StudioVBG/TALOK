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

  // ✅ OPTIMISÉ: Toutes les requêtes en parallèle (6 → 1 batch)
  const [
    profileResult,
    ownerProfileResult,
    entitiesResult,
    propertiesResult,
    identityDocsResult,
  ] = await Promise.all([
    // Profil de base
    supabase
      .from("profiles")
      .select("id, prenom, nom, telephone, avatar_url, date_naissance")
      .eq("id", ownerId)
      .single(),
    // Profil propriétaire
    supabase
      .from("owner_profiles")
      .select("type, iban, adresse_facturation")
      .eq("profile_id", ownerId)
      .single(),
    // Entités juridiques actives
    supabase
      .from("legal_entities")
      .select("id", { count: "exact", head: true })
      .eq("owner_profile_id", ownerId)
      .eq("is_active", true),
    // Propriétés avec un flag bail actif
    supabase
      .from("properties")
      .select("id, leases!inner(id)", { count: "exact" })
      .eq("owner_id", ownerId),
    // Documents d'identité
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .in("type", ["piece_identite", "identite", "cni", "passeport"]),
  ]);

  const profile = profileResult.data;
  const ownerProfile = ownerProfileResult.data;
  const entitiesCount = entitiesResult.count;
  const propertiesCount = propertiesResult.count ?? (propertiesResult.data?.length || 0);
  const identityDocsCount = identityDocsResult.count;

  // Vérifier s'il y a au moins un bail actif (via les propriétés déjà chargées)
  let leasesCount = 0;
  const propertyIds = (propertiesResult.data || []).map((p: any) => p.id);
  if (propertyIds.length > 0) {
    const { count } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .neq("statut", "terminated");
    leasesCount = count || 0;
  }

  return {
    // Profile de base
    hasFirstName: !!profile?.prenom && profile.prenom.trim().length > 0,
    hasLastName: !!profile?.nom && profile.nom.trim().length > 0,
    hasPhone: !!profile?.telephone && profile.telephone.trim().length > 0,
    hasAvatar: !!profile?.avatar_url && profile.avatar_url.trim().length > 0,
    hasBirthDate: !!profile?.date_naissance,
    // Owner profile
    hasOwnerType: !!ownerProfile?.type,
    hasSiret: (entitiesCount || 0) > 0,
    hasIban: !!ownerProfile?.iban && ownerProfile.iban.trim().length > 0,
    hasBillingAddress: !!ownerProfile?.adresse_facturation && ownerProfile.adresse_facturation.trim().length > 0,
    // Documents
    hasIdentityDocument: (identityDocsCount || 0) > 0,
    // Propriétés
    hasProperty: (propertiesCount || 0) > 0,
    hasLease: leasesCount > 0,
    // Type de propriétaire
    ownerType: ownerProfile?.type as "particulier" | "societe" | null,
  };
}

