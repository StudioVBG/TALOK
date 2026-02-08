import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

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
      rental_status: string | null;
    }[];
  stats: {
    totalProperties: number;
    activeLeases: number;
  };
  // Subscription data
  subscription: {
    id: string;
    plan_slug: string;
    plan_name: string;
    status: string;
    billing_cycle: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_end: string | null;
    cancel_at_period_end: boolean;
    properties_count: number;
    leases_count: number;
    max_properties: number;
    max_leases: number;
    max_tenants: number;
    price_monthly: number;
    price_yearly: number;
    created_at: string;
  } | null;
}

/**
 * Récupère les détails d'un propriétaire pour l'admin
 * Utilise le service role client pour bypasser RLS (admin only)
 */
export async function fetchAdminOwnerDetails(ownerId: string): Promise<AdminOwnerDetails | null> {
  const supabase = await createClient();

  // Vérifier que l'utilisateur est connecté et est admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!adminProfile || adminProfile.role !== "admin") {
    console.error("[fetchAdminOwnerDetails] User is not admin");
    return null;
  }

  // Utiliser service role pour bypasser RLS
  const serviceClient = createServiceRoleClient();

  // 1. Récupérer le profil de base
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("id", ownerId)
    .single();

  if (profileError || !profile) {
    console.error("[fetchAdminOwnerDetails] Profile not found:", profileError?.message, "ownerId:", ownerId);
    return null;
  }

  // 2. Récupérer owner_profiles séparément
  const { data: ownerProfileData } = await serviceClient
    .from("owner_profiles")
    .select("*")
    .eq("profile_id", ownerId)
    .maybeSingle();

  // 3. Récupérer les propriétés séparément
  console.log(`[fetchAdminOwnerDetails] Recherche propriétés pour profile.id=${ownerId}, user_id=${profile.user_id}`);
  
  let { data: propertiesData, error: propError } = await serviceClient
    .from("properties")
    .select("id, adresse_complete, ville, code_postal, type, surface, nb_pieces, rental_status, owner_id")
    .eq("owner_id", ownerId);

  console.log(`[fetchAdminOwnerDetails] Résultat avec profile.id: ${propertiesData?.length || 0} propriétés`, propError?.message || '');

  // Si aucune propriété trouvée, essayer avec user_id comme owner_id (compatibilité anciennes données)
  if ((!propertiesData || propertiesData.length === 0) && profile.user_id) {
    const { data: propertiesByUserId, error: propError2 } = await serviceClient
      .from("properties")
      .select("id, adresse_complete, ville, code_postal, type, surface, nb_pieces, rental_status, owner_id")
      .eq("owner_id", profile.user_id);
    
    console.log(`[fetchAdminOwnerDetails] Résultat avec user_id: ${propertiesByUserId?.length || 0} propriétés`, propError2?.message || '');
    
    if (propertiesByUserId && propertiesByUserId.length > 0) {
      propertiesData = propertiesByUserId;
    }
  }

  // Diagnostic si toujours pas de propriétés
  if (!propertiesData || propertiesData.length === 0) {
    const { data: allProps } = await serviceClient
      .from("properties")
      .select("id, owner_id, adresse_complete")
      .limit(10);
    console.log(`[fetchAdminOwnerDetails] DIAGNOSTIC - Échantillon de propriétés existantes:`, allProps?.map(p => ({ id: p.id, owner_id: p.owner_id, addr: p.adresse_complete?.substring(0, 30) })));
  }

  const properties = propertiesData || [];

  // 4. Compter les baux actifs
  let activeLeases = 0;
  if (properties.length > 0) {
    const propertyIds = properties.map((p) => p.id);
    const { count } = await serviceClient
      .from("leases")
      .select("*", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .eq("statut", "active");
    activeLeases = count || 0;
  }

  // 5. Récupérer l'email depuis auth.users
  const profileData = profile as Record<string, unknown>;
  let email: string | null = null;
  if (profileData.user_id) {
    const { data: authUserData } = await serviceClient.auth.admin.getUserById(
      profileData.user_id as string
    );
    email = authUserData?.user?.email || null;
  }

  // 6. Récupérer l'abonnement
  const { data: subscriptionData } = await serviceClient
    .from("subscriptions")
    .select(`
      id, 
      status, 
      billing_cycle, 
      current_period_start,
      current_period_end, 
      trial_end,
      cancel_at_period_end,
      properties_count, 
      leases_count,
      created_at,
      plan:subscription_plans(
        slug, 
        name, 
        price_monthly, 
        price_yearly,
        max_properties, 
        max_leases,
        max_tenants
      )
    `)
    .eq("owner_id", ownerId)
    .maybeSingle();

  const ownerProfiles = ownerProfileData;

  return {
    id: profileData.id as string,
    user_id: profileData.user_id as string,
    role: profileData.role as string,
    prenom: profileData.prenom as string | null,
    nom: profileData.nom as string | null,
    telephone: profileData.telephone as string | null,
    avatar_url: profileData.avatar_url as string | null,
    created_at: profileData.created_at as string,
    email,
    owner_profiles: Array.isArray(ownerProfiles) 
      ? (ownerProfiles[0] as AdminOwnerDetails["owner_profiles"])
      : (ownerProfiles as AdminOwnerDetails["owner_profiles"]),
    properties: properties as AdminOwnerDetails['properties'],
    stats: {
      totalProperties: properties.length,
      activeLeases
    },
    // Subscription
    subscription: subscriptionData ? ({
      id: subscriptionData.id,
      plan_slug: subscriptionData.plan?.slug || "starter",
      plan_name: subscriptionData.plan?.name || "Starter",
      status: subscriptionData.status,
      billing_cycle: subscriptionData.billing_cycle,
      current_period_start: subscriptionData.current_period_start,
      current_period_end: subscriptionData.current_period_end,
      trial_end: subscriptionData.trial_end,
      cancel_at_period_end: subscriptionData.cancel_at_period_end || false,
      properties_count: subscriptionData.properties_count || 0,
      leases_count: subscriptionData.leases_count || 0,
      max_properties: subscriptionData.plan?.max_properties || 3,
      max_leases: subscriptionData.plan?.max_leases || 5,
      max_tenants: subscriptionData.plan?.max_tenants || 10,
      price_monthly: subscriptionData.plan?.price_monthly || 0,
      price_yearly: subscriptionData.plan?.price_yearly || 0,
      created_at: subscriptionData.created_at,
    } as AdminOwnerDetails['subscription']) : null,
  };
}
