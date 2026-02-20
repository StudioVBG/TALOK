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
    surface_habitable_m2?: number;
    nb_pieces?: number;
    etage?: number;
    ascenseur?: boolean;
    annee_construction?: number;
    parking_numero?: string;
    cave_numero?: string;
    num_lot?: string;
    digicode?: string;
    interphone?: string;
    // DPE / Diagnostics complets
    energie?: string;
    ges?: string;
    dpe_classe_energie?: string;
    dpe_classe_climat?: string;
    dpe_consommation?: number;
    dpe_emissions?: number;
    dpe_date?: string;
    dpe_date_validite?: string;
    cover_url?: string;
    owner_id?: string;
    // Caractéristiques logement
    chauffage_type?: string;
    chauffage_energie?: string;
    eau_chaude_type?: string;
    regime?: string;
    loyer_hc?: number;
    charges_mensuelles?: number;
    // Annexes
    has_balcon?: boolean;
    has_terrasse?: boolean;
    has_jardin?: boolean;
    has_cave?: boolean;
    clim_presence?: boolean | string;
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
    [key: string]: unknown;
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
 * Fallback: requêtes directes quand la RPC tenant_dashboard n'est pas disponible.
 * Utilise le service role client pour bypasser les RLS — l'auth est déjà vérifiée en amont.
 *
 * v4: Ajoute recherche par email, meters, keys (EDL), insurance check
 */
async function fetchTenantDashboardDirect(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TenantDashboardData | null> {
  const supabase = getServiceClient();

  // Récupérer le profil + email de l'utilisateur
  const { data: profileRaw, error: profileError } = await supabase
    .from("profiles")
    .select("id, prenom, nom, kyc_status, user_id")
    .eq("user_id", userId)
    .single();

  if (profileError) {
    console.error("[fetchTenantDashboardDirect] Erreur profil:", profileError.message);
  }

  const profile = profileRaw as { id: string; prenom: string | null; nom: string | null; kyc_status?: string | null; user_id: string } | null;
  if (!profile) {
    console.warn("[fetchTenantDashboardDirect] Profil introuvable pour user_id:", userId, "— retour dashboard vide");
    // Return a minimal dashboard instead of null so the UI shows a proper "no lease" state
    // instead of an infinite "loading" message
    return {
      profile_id: "",
      kyc_status: "pending",
      tenant: undefined,
      leases: [],
      properties: [],
      lease: null,
      property: null,
      invoices: [],
      tickets: [],
      notifications: [],
      pending_edls: [],
      insurance: { has_insurance: false },
      stats: { unpaid_amount: 0, unpaid_count: 0, total_monthly_rent: 0, active_leases_count: 0 },
    };
  }

  // Récupérer l'email de l'utilisateur pour la recherche par invited_email
  let userEmail = "";
  try {
    const { data: { user: authUser } } = await _supabase.auth.getUser();
    userEmail = authUser?.email?.toLowerCase() || "";
  } catch {
    console.warn("[fetchTenantDashboardDirect] Impossible de récupérer l'email");
  }

  // Récupérer les baux via lease_signers (par profile_id OU invited_email)
  let signerFilter = supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profile.id);

  const { data: signersByProfile } = await signerFilter;
  let leaseIdsByProfile = (signersByProfile || []).map((s: { lease_id: string }) => s.lease_id);

  // Recherche supplémentaire par email si disponible
  let leaseIdsByEmail: string[] = [];
  if (userEmail) {
    const { data: signersByEmail } = await supabase
      .from("lease_signers")
      .select("lease_id")
      .ilike("invited_email", userEmail);
    leaseIdsByEmail = (signersByEmail || []).map((s: { lease_id: string }) => s.lease_id);
  }

  // Union des lease_ids
  const leaseIds = [...new Set([...leaseIdsByProfile, ...leaseIdsByEmail])];

  let leases: any[] = [];
  if (leaseIds.length > 0) {
    const { data: leasesData } = await supabase
      .from("leases")
      .select("id, property_id, type_bail, loyer, charges_forfaitaires, depot_de_garantie, date_debut, date_fin, statut, created_at")
      .in("id", leaseIds)
      .in("statut", ["draft", "active", "pending_signature", "fully_signed", "terminated"]);
    leases = leasesData || [];
  }

  // Signataires complets avec profils
  let allLeaseSigners: any[] = [];
  if (leaseIds.length > 0) {
    const { data: leaseSignersData } = await supabase
      .from("lease_signers")
      .select(`
        id,
        lease_id,
        profile_id,
        role,
        signature_status,
        signed_at,
        invited_email,
        invited_name,
        profiles (
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url
        )
      `)
      .in("lease_id", leaseIds);
    allLeaseSigners = (leaseSignersData || []).map((s: any) => {
      const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return {
        id: s.id,
        profile_id: s.profile_id || p?.id,
        role: s.role,
        signature_status: s.signature_status,
        signed_at: s.signed_at,
        lease_id: s.lease_id,
        invited_email: s.invited_email,
        invited_name: s.invited_name,
        prenom: p?.prenom || s.invited_name?.split(" ")[0] || "",
        nom: p?.nom || s.invited_name?.split(" ").slice(1).join(" ") || "",
        avatar_url: p?.avatar_url || null,
      };
    });
  }

  const propertyIds = leases.map((l: any) => l.property_id).filter(Boolean);

  // Charger les données en parallèle : propriétés, propriétaires, factures, tickets, EDL, meters, keys EDL, insurance
  const [
    propertiesResult,
    ownersResult,
    invoicesResult,
    ticketsResult,
    edlResult,
    metersResult,
    edlKeysResult,
    insuranceResult,
  ] = await Promise.allSettled([
    // Propriétés complètes (select *)
    propertyIds.length > 0
      ? supabase.from("properties").select("*").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
    // Propriétaires
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
    // Tickets
    supabase
      .from("tickets")
      .select("id, titre, description, priorite, statut, created_at, property_id")
      .eq("created_by_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
    // EDL en attente
    propertyIds.length > 0
      ? supabase
          .from("edl")
          .select("id, type, statut, scheduled_at, invitation_token, property_id")
          .in("property_id", propertyIds)
          .in("statut", ["scheduled", "in_progress"])
      : Promise.resolve({ data: [] }),
    // Compteurs actifs avec dernière lecture
    propertyIds.length > 0
      ? supabase
          .from("meters")
          .select("id, property_id, type, serial_number, unit, is_active")
          .in("property_id", propertyIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] }),
    // Clés depuis le dernier EDL signé/complété par propriété
    propertyIds.length > 0
      ? supabase
          .from("edl")
          .select("property_id, keys, completed_date, created_at")
          .in("property_id", propertyIds)
          .in("status", ["signed", "completed"])
          .not("keys", "is", null)
          .order("completed_date", { ascending: false, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    // Assurance : attestation non archivée et non expirée
    supabase
      .from("documents")
      .select("id, expiry_date")
      .eq("tenant_id", profile.id)
      .eq("type", "attestation_assurance")
      .eq("is_archived", false)
      .order("expiry_date", { ascending: false })
      .limit(1),
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
  const metersData = getData<Record<string, unknown>>(metersResult);
  const edlKeysData = getData<Record<string, unknown>>(edlKeysResult);
  const insuranceData = getData<Record<string, unknown>>(insuranceResult);

  // Index des propriétés par ID
  const propertyMap = new Map<string, PropertyRecord>();
  for (const p of propertiesData) {
    propertyMap.set(p.id, p);
  }

  // Index des propriétaires par property_id
  const ownerMap = new Map<string, OwnerRecord["owner"]>();
  for (const o of ownersData) {
    if (o.owner) {
      ownerMap.set(o.id, o.owner);
    }
  }

  // Récupérer les dernières lectures des compteurs
  const metersByProperty = new Map<string, any[]>();
  for (const m of metersData) {
    const propId = (m as any).property_id;
    if (!metersByProperty.has(propId)) metersByProperty.set(propId, []);
    metersByProperty.get(propId)!.push(m);
  }

  // Récupérer les lectures les plus récentes pour chaque compteur
  const meterIds = metersData.map((m: any) => m.id).filter(Boolean);
  let meterReadingsMap = new Map<string, { value: number; date: string }>();
  if (meterIds.length > 0) {
    const { data: readings } = await supabase
      .from("meter_readings")
      .select("meter_id, reading_value, reading_date")
      .in("meter_id", meterIds)
      .order("reading_date", { ascending: false });
    if (readings) {
      for (const r of readings) {
        if (!meterReadingsMap.has(r.meter_id)) {
          meterReadingsMap.set(r.meter_id, {
            value: r.reading_value,
            date: r.reading_date,
          });
        }
      }
    }
  }

  // Index des clés EDL par property_id (uniquement le plus récent)
  const keysMap = new Map<string, any[]>();
  for (const edlRow of edlKeysData) {
    const propId = (edlRow as any).property_id;
    if (!keysMap.has(propId) && (edlRow as any).keys) {
      const rawKeys = (edlRow as any).keys;
      const mappedKeys = Array.isArray(rawKeys)
        ? rawKeys.map((k: any) => ({
            label: k.type || k.label || "Clé",
            count_info: k.quantite ? `${k.quantite} unité(s)` : k.count_info || "—",
          }))
        : [];
      keysMap.set(propId, mappedKeys);
    }
  }

  // Assurance
  const insuranceDoc = insuranceData.length > 0 ? (insuranceData[0] as any) : null;
  const hasInsurance = insuranceDoc
    ? (!insuranceDoc.expiry_date || new Date(insuranceDoc.expiry_date) > new Date())
    : false;

  // Helper
  const getPropertyForLease = (leaseId: string) => {
    const lease = leases.find((l: any) => l.id === leaseId);
    return lease ? propertyMap.get(lease.property_id) : undefined;
  };

  // Enrichir les baux avec propriété (+ meters + keys), propriétaire ET signataires
  const enrichedLeases = leases.map((l: any) => {
    const prop = propertyMap.get(l.property_id);
    const ownerProfile = ownerMap.get(l.property_id);
    const leaseSignersForLease = allLeaseSigners.filter((s: any) => s.lease_id === l.id);
    const propId = l.property_id;

    // Enrichir les meters avec les lectures
    const meters = (metersByProperty.get(propId) || []).map((m: any) => {
      const reading = meterReadingsMap.get(m.id);
      return {
        id: m.id,
        type: m.type,
        serial_number: m.serial_number,
        unit: m.unit,
        last_reading_value: reading?.value ?? null,
        last_reading_date: reading?.date ?? null,
      };
    });

    const keys = keysMap.get(propId) || [];

    return {
      ...l,
      lease_signers: leaseSignersForLease,
      property: prop
        ? { ...prop, meters, keys }
        : null,
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
    insurance: {
      has_insurance: hasInsurance,
      last_expiry_date: insuranceDoc?.expiry_date || undefined,
    },
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

  // Vérifier l'authentification avec le client cookie-based
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.id !== userId) {
    throw new Error("Accès non autorisé");
  }

  // Utiliser le service role pour la RPC et les requêtes de données
  // L'auth est vérifiée ci-dessus, le service role bypasse les RLS
  // ce qui évite les blocages si les policies ne sont pas correctement appliquées
  const serviceClient = getServiceClient();

  const { data, error } = await serviceClient.rpc("tenant_dashboard", {
    p_tenant_user_id: userId,
  });

  if (error) {
    console.warn("[fetchTenantDashboard] RPC failed, using direct queries fallback:", error.message);
    return fetchTenantDashboardDirect(supabase, userId);
  }

  if (!data) {
    // RPC returned null — profile not found as tenant.
    // Fall back to direct queries which don't require role='tenant' in the profile lookup.
    console.warn("[fetchTenantDashboard] RPC returned null, falling back to direct queries");
    return fetchTenantDashboardDirect(supabase, userId);
  }

  // Récupérer les infos du profil pour le message de bienvenue (service role)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", userId)
    .single();

  // Nettoyage des données pour éviter les "undefined" et assurer la cohérence
  const cleanData = data as TenantDashboardData;
  cleanData.tenant = profile ? { prenom: profile.prenom ?? "", nom: profile.nom ?? "" } : undefined;
  
  if (cleanData.leases) {
    cleanData.leases = cleanData.leases.map((l: any) => ({
      ...l,
      // La RPC renvoie "signers", l'interface attend "lease_signers" — on unifie
      lease_signers: l.lease_signers || l.signers || [],
      property: l.property ? {
        ...l.property,
        ville: l.property.ville || "Ville inconnue",
        code_postal: l.property.code_postal || "00000",
        adresse_complete: l.property.adresse_complete || "Adresse non renseignée",
        // S'assurer que meters et keys sont des tableaux
        meters: l.property.meters || [],
        keys: l.property.keys || [],
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

