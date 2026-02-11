import { createClient } from "@/lib/supabase/server";

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
  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, kyc_status")
    .eq("user_id", userId)
    .single();

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

  // Récupérer les factures
  let invoices: TenantInvoice[] = [];
  if (leaseIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("id, lease_id, periode, montant_total, montant_loyer, montant_charges, statut, due_date")
      .in("lease_id", leaseIds)
      .order("periode", { ascending: false })
      .limit(20);
    invoices = (invoicesData || []).map((i: any) => ({
      ...i,
      property_type: "",
      property_address: "",
    })) as TenantInvoice[];
  }

  const unpaidInvoices = invoices.filter((i) => i.statut === "sent" || i.statut === "late");

  return {
    profile_id: profile.id,
    kyc_status: (profile as any).kyc_status || "pending",
    tenant: { prenom: profile.prenom, nom: profile.nom },
    leases: leases as any[],
    properties: [],
    lease: leases.length > 0 ? leases[0] as any : null,
    property: null,
    invoices,
    tickets: [],
    notifications: [],
    pending_edls: [],
    insurance: { has_insurance: false },
    stats: {
      unpaid_amount: unpaidInvoices.reduce((sum, i) => sum + Number(i.montant_total || 0), 0),
      unpaid_count: unpaidInvoices.length,
      total_monthly_rent: leases.reduce((sum, l) => sum + Number(l.loyer || 0), 0),
      active_leases_count: leases.filter((l) => l.statut === "active").length,
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
    return fetchTenantDashboardDirect(supabase, userId);
  }

  if (!data) return null;

  // Récupérer les infos du profil pour le message de bienvenue
  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", userId)
    .single();

  // Nettoyage des données pour éviter les "undefined" et assurer la cohérence
  const cleanData = data as any;
  cleanData.tenant = profile;
  
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

