import { createClient } from "@/lib/supabase/server";

export interface AdminOwnerDetails {
  id: string;
  user_id: string;
  role: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  avatar_url: string | null;
  created_at: string;
  owner_profiles: {
    type: "particulier" | "societe";
    siret: string | null;
    adresse_facturation: string | null;
  } | null;
  properties: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface: number | null;
    nb_pieces: number | null;
    statut: string;
  }[];
  stats: {
    totalProperties: number;
    activeLeases: number;
  }
}

export async function fetchAdminOwnerDetails(ownerId: string): Promise<AdminOwnerDetails | null> {
  const supabase = await createClient();

  // Vérifier admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Récupérer le profil et owner_profile
  // On fait une requête principale
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(`
      *,
      owner_profiles (*),
      user:auth.users (email)
    `)
    .eq("id", ownerId)
    .single();

  if (error || !profile) {
    console.error("Error fetching owner details:", error);
    return null;
  }

  // Récupérer les propriétés
  const { data: properties } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville, code_postal, type, surface, nb_pieces, statut")
    .eq("owner_id", ownerId);

  // Récupérer quelques stats simples (ex: nombre de baux actifs)
  // On peut faire un count sur les leases liés aux propriétés de ce owner
  const { count: activeLeases } = await supabase
    .from("leases")
    .select("*", { count: "exact", head: true })
    .in("property_id", (properties || []).map(p => p.id))
    .eq("statut", "active");

  const profileData = profile as Record<string, any>;
  
  return {
    id: profileData.id,
    user_id: profileData.user_id,
    role: profileData.role,
    prenom: profileData.prenom,
    nom: profileData.nom,
    telephone: profileData.telephone,
    avatar_url: profileData.avatar_url,
    created_at: profileData.created_at,
    email: profileData.user?.email || null,
    owner_profiles: Array.isArray(profileData.owner_profiles) ? profileData.owner_profiles[0] : profileData.owner_profiles,
    properties: properties || [],
    stats: {
      totalProperties: (properties || []).length,
      activeLeases: activeLeases || 0
    }
  } as AdminOwnerDetails;
}

