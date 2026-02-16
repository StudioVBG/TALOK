import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

// Interface pour un bail avec propriété jointe
export interface TenantLease {
  id: string;
  property_id: string;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin?: string;
  statut: string;
  created_at: string;
  lease_signers: Array<{
    id: string;
    profile_id: string;
    role: string;
    signature_status: string;
    signed_at?: string;
    prenom: string;
    nom: string;
    avatar_url?: string;
  }>;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface?: number;
    nb_pieces?: number;
    etage?: number;
    ascenseur?: boolean;
    annee_construction?: number;
    parking_numero?: string;
    cave_numero?: string;
    num_lot?: string;
    digicode?: string;
    interphone?: string;
    dpe_classe_energie?: string;
    dpe_classe_climat?: string;
    cover_url?: string;
    meters?: Array<{
      id: string;
      type: string;
      serial_number: string;
      unit: string;
      last_reading_value?: number;
      last_reading_date?: string;
    }>;
    keys?: Array<{
      label: string;
      count_info: string;
    }>;
  };
  owner: {
    id: string;
    name: string;
    email?: string;
    telephone?: string;
    avatar_url?: string;
  };
}

// Interface pour une facture avec info propriété
export interface TenantInvoice {
  id: string;
  lease_id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: string;
  due_date?: string;
  property_type: string;
  property_address: string;
}

// Interface pour un ticket avec info propriété
export interface TenantTicket {
  id: string;
  titre: string;
  description?: string;
  priorite: string;
  statut: string;
  created_at: string;
  property_id: string;
  property_address: string;
  property_type: string;
}

export interface PendingEDL {
  id: string;
  type: "entree" | "sortie";
  scheduled_at: string;
  invitation_token: string;
  property_address: string;
  property_type: string;
}

export interface TenantDashboardData {
  profile_id: string;
  kyc_status: 'pending' | 'processing' | 'verified' | 'rejected';
  tenant?: {
    prenom: string;
    nom: string;
  };
  // NOUVEAU : Support multi-baux
  leases: TenantLease[];
  properties: any[];
  // RÉTRO-COMPATIBILITÉ : Premier bail/propriété
  lease: TenantLease | null;
  property: any | null;
  // Données communes
  invoices: TenantInvoice[];
  tickets: TenantTicket[];
  notifications: any[];
  pending_edls: PendingEDL[];
  insurance: {
    has_insurance: boolean;
    last_expiry_date?: string;
  };
  stats: {
    unpaid_amount: number;
    unpaid_count: number;
    total_monthly_rent: number;
    active_leases_count: number;
  };
}

/**
 * Fallback: requêtes directes quand la RPC tenant_dashboard n'est pas disponible
 */
async function fetchTenantDashboardDirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TenantDashboardData | null> {
  // Récupérer le profil — avec fallback service role en cas de blocage RLS
  let profileRaw: Record<string, unknown> | null = null;

  const { data: directProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, prenom, nom, kyc_status")
    .eq("user_id", userId)
    .single();

  if (!profileError && directProfile) {
    profileRaw = directProfile;
  } else {
    // Fallback: utiliser le service role pour contourner les politiques RLS
    console.warn("[fetchTenantDashboardDirect] Profile not found via direct query, using service role fallback. Error:", profileError?.message);
    try {
      const serviceClient = getServiceClient();
      const { data: serviceProfile } = await serviceClient
        .from("profiles")
        .select("id, prenom, nom, kyc_status")
        .eq("user_id", userId)
        .single();
      profileRaw = serviceProfile;
    } catch (e) {
      console.error("[fetchTenantDashboardDirect] Service role fallback failed:", e);
    }
  }

  // Cast nécessaire car kyc_status n'existe pas dans les types générés Supabase
  const profile = profileRaw as { id: string; prenom: string | null; nom: string | null; kyc_status?: string | null } | null;

  if (!profile) return null;

  // Récupérer les baux via lease_signers
  const { data: signers } = await supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id);

  const leaseIds = (signers || []).map((s: { lease_id: string }) => s.lease_id);

  let leases: any[] = [];
  if (leaseIds.length > 0) {
    const { data: leasesData } = await supabase
      .from("leases")
      .select("id, property_id, type_bail, loyer, charges_forfaitaires, depot_de_garantie, date_debut, date_fin, statut, created_at")
      .in("id", leaseIds);
    leases = leasesData || [];
  }

  // Récupérer les propriétés liées aux baux pour enrichir les données
  const propertyIds = leases.map((l: any) => l.property_id).filter(Boolean);

  // Charger les propriétés + propriétaires en parallèle pour enrichir factures/tickets/EDL
  const [propertiesResult, ownersResult, invoicesResult, ticketsResult, edlResult] = await Promise.allSettled([
    // Propriétés liées aux baux (avec owner_id)
    propertyIds.length > 0
      ? supabase
          .from("properties")
          .select("id, type, adresse_complete, ville, code_postal, surface, nb_pieces, etage, ascenseur, dpe_classe_energie, dpe_classe_climat, cover_url, digicode, interphone, owner_id")
          .in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    // Propriétaires des biens
    propertyIds.length > 0
      ? supabase
          .from("properties")
          .select("id, owner_id, owner:profiles!owner_id(id, prenom, nom, email, telephone, avatar_url)")
          .in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    // Factures
    leaseIds.length > 0
      ? supabase
          .from("invoices")
          .select("id, lease_id, periode, montant_total, montant_loyer, montant_charges, statut, due_date, created_at")
          .in("lease_id", leaseIds)
          .order("periode", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    // Tickets créés par ce locataire
    supabase
      .from("tickets")
      .select("id, titre, description, priorite, statut, created_at, property_id")
      .eq("created_by_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
    // EDL en attente pour les propriétés du locataire
    propertyIds.length > 0
      ? supabase
          .from("edl")
          .select("id, type, statut, scheduled_at, invitation_token, property_id")
          .in("property_id", propertyIds)
          .in("statut", ["scheduled", "in_progress"])
      : Promise.resolve({ data: [] }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getData = <T>(result: PromiseSettledResult<any>): T[] =>
    result.status === "fulfilled" && result.value?.data ? (result.value.data as T[]) : [];

  interface PropertyRecord {
    id: string;
    adresse_complete?: string;
    code_postal?: string;
    ville?: string;
    type?: string;
    [key: string]: unknown;
  }
  interface OwnerRecord {
    id: string;
    owner?: { id: string; prenom?: string; nom?: string; email?: string; telephone?: string; avatar_url?: string };
    [key: string]: unknown;
  }

  const propertiesData = getData<PropertyRecord>(propertiesResult);
  const ownersData = getData<OwnerRecord>(ownersResult);
  const invoicesData = getData<Record<string, unknown>>(invoicesResult);
  const ticketsData = getData<Record<string, unknown>>(ticketsResult);
  const edlData = getData<Record<string, unknown>>(edlResult);

  // Créer un index rapide des propriétés par ID
  const propertyMap = new Map<string, PropertyRecord>();
  for (const p of propertiesData) {
    propertyMap.set(p.id, p);
  }

  // Créer un index des propriétaires par property_id
  const ownerMap = new Map<string, OwnerRecord["owner"]>();
  for (const o of ownersData) {
    if (o.owner) {
      ownerMap.set(o.id, o.owner);
    }
  }

  // Helper pour retrouver la propriété d'un bail
  const getPropertyForLease = (leaseId: string) => {
    const lease = leases.find((l: any) => l.id === leaseId);
    return lease ? propertyMap.get(lease.property_id) : undefined;
  };

  // Enrichir les baux avec propriété et propriétaire
  const enrichedLeases = leases.map((l: any) => {
    const prop = propertyMap.get(l.property_id);
    const ownerProfile = ownerMap.get(l.property_id);
    return {
      ...l,
      property: prop || null,
      owner: ownerProfile
        ? {
            id: ownerProfile.id,
            name: `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire",
            email: ownerProfile.email,
            telephone: ownerProfile.telephone,
            avatar_url: ownerProfile.avatar_url,
          }
        : { id: "", name: "Propriétaire", email: undefined },
    };
  });

  const invoices: TenantInvoice[] = invoicesData.map((i: any) => {
    const prop = getPropertyForLease(i.lease_id);
    return {
      ...i,
      property_type: prop?.type || "",
      property_address: prop ? `${prop.adresse_complete}, ${prop.code_postal} ${prop.ville}` : "",
    };
  });

  const tickets: TenantTicket[] = ticketsData.map((t: any) => {
    const prop = t.property_id ? propertyMap.get(t.property_id) : undefined;
    return {
      ...t,
      property_address: prop ? `${prop.adresse_complete}, ${prop.code_postal} ${prop.ville}` : "",
      property_type: prop?.type || "",
    };
  });

  const pending_edls: PendingEDL[] = edlData.map((e: any) => {
    const prop = e.property_id ? propertyMap.get(e.property_id) : undefined;
    return {
      id: e.id,
      type: e.type || "entree",
      scheduled_at: e.scheduled_at || "",
      invitation_token: e.invitation_token || "",
      property_address: prop ? `${prop.adresse_complete}, ${prop.code_postal} ${prop.ville}` : "",
      property_type: prop?.type || "",
    };
  });

  const unpaidInvoices = invoices.filter((i) => i.statut === "sent" || i.statut === "late");

  const profileKyc = "kyc_status" in profile ? (profile as { kyc_status?: string }).kyc_status : undefined;

  return {
    profile_id: profile.id,
    kyc_status: (profileKyc as TenantDashboardData["kyc_status"]) || "pending",
    tenant: { prenom: profile.prenom ?? "", nom: profile.nom ?? "" },
    leases: enrichedLeases as any[],
    properties: propertiesData,
    lease: enrichedLeases.length > 0 ? enrichedLeases[0] as any : null,
    property: enrichedLeases.length > 0 ? enrichedLeases[0].property : null,
    invoices,
    tickets,
    notifications: [],
    pending_edls,
    insurance: { has_insurance: false },
    stats: {
      unpaid_amount: unpaidInvoices.reduce((sum, i) => sum + Number(i.montant_total || 0), 0),
      unpaid_count: unpaidInvoices.length,
      total_monthly_rent: enrichedLeases.reduce((sum: number, l: any) => sum + Number(l.loyer || 0), 0),
      active_leases_count: enrichedLeases.filter((l: any) => l.statut === "active").length,
    },
  };
}

export async function fetchTenantDashboard(userId: string): Promise<TenantDashboardData | null> {
  const supabase = await createClient();

  // On passe directement le user_id à la RPC qui est sécurisée (SECURITY DEFINER)
  // mais on vérifie quand même que c'est bien le user connecté
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) {
    throw new Error("Accès non autorisé");
  }

  const { data, error } = await supabase.rpc("tenant_dashboard", {
    p_tenant_user_id: userId,
  });

  if (error) {
    console.warn("[fetchTenantDashboard] RPC failed, using direct queries fallback:", error.message);
    // Passer le service role client pour le fallback en cas de blocage RLS
    return fetchTenantDashboardDirect(supabase, userId);
  }

  if (!data) return null;

  // Récupérer les infos du profil pour le message de bienvenue
  // Avec fallback service role en cas de blocage RLS
  let profile: { prenom: string | null; nom: string | null } | null = null;
  const { data: directProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", userId)
    .single();

  if (!profileErr && directProfile) {
    profile = directProfile;
  } else {
    try {
      const serviceClient = getServiceClient();
      const { data: serviceProfile } = await serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("user_id", userId)
        .single();
      profile = serviceProfile;
    } catch (e) {
      console.warn("[fetchTenantDashboard] Profile lookup fallback failed:", e);
    }
  }

  // Nettoyage des données pour éviter les "undefined" et assurer la cohérence
  const cleanData = data as TenantDashboardData;
  cleanData.tenant = profile ? { prenom: profile.prenom ?? "", nom: profile.nom ?? "" } : undefined;
  
  if (cleanData.leases) {
    cleanData.leases = cleanData.leases.map((l: any) => ({
      ...l,
      property: l.property ? {
        ...l.property,
        ville: l.property.ville || "Ville inconnue",
        code_postal: l.property.code_postal || "00000",
        adresse_complete: l.property.adresse_complete || "Adresse non renseignée"
      } : l.property,
      owner: l.owner ? {
        ...l.owner,
        name: l.owner.name && !l.owner.name.includes('undefined') ? l.owner.name : "Propriétaire"
      } : l.owner
    }));
    
    // Mettre à jour les raccourcis
    if (cleanData.leases.length > 0) {
      cleanData.lease = cleanData.leases[0];
      cleanData.property = cleanData.leases[0].property;
    }
  }

  return cleanData;
}

