/**
 * Services de données pour le Compte Propriétaire
 * 
 * IMPORTANT: Ces fonctions sont utilisées dans les Server Components.
 * Elles utilisent directement Supabase côté serveur au lieu de passer par l'API HTTP
 * pour éviter les problèmes d'URLs relatives dans Node.js.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  OwnerDashboardData,
  OwnerProperty,
  OwnerContract,
  OwnerMoneySummary,
  OwnerMoneyInvoice,
  OwnerDocument,
  OwnerIndexationDue,
  OwnerRegularizationDue,
  PropertyStatus,
  LeaseStatus,
  InvoiceStatus,
  DocumentStatus,
  OwnerModuleKey,
} from "./types";

export interface FetchOwnerPropertiesFilters {
  module?: OwnerModuleKey;
  type?: string;
  status?: PropertyStatus;
  search?: string;
}

/**
 * Récupère les données du dashboard
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerDashboard(
  ownerId: string
): Promise<OwnerDashboardData> {
  const supabase = await createClient();
  
  // Récupérer les propriétés
  const { data: properties } = await supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId);
  
  // Récupérer les baux
  const { data: leases } = await supabase
    .from("leases")
    .select("*")
    .in("property_id", properties?.map(p => p.id) || []);
  
  // Récupérer les factures
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .in("lease_id", leases?.map(l => l.id) || []);
  
  // Calculer les KPIs pour le mois en cours
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const currentMonthInvoices = invoices?.filter(inv => {
    if (!inv.periode) return false;
    const [year, month] = inv.periode.split("-").map(Number);
    return year === currentYear && month === currentMonth + 1;
  }) || [];
  
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
  const lastMonthInvoices = invoices?.filter(inv => {
    if (!inv.periode) return false;
    const [year, month] = inv.periode.split("-").map(Number);
    return year === lastMonthYear && month === lastMonth + 1;
  }) || [];
  
  const currentMonthExpected = currentMonthInvoices.reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
  const currentMonthCollected = currentMonthInvoices.filter(inv => inv.statut === "paid").reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
  const currentMonthPercentage = currentMonthExpected > 0 ? (currentMonthCollected / currentMonthExpected) * 100 : 0;
  
  const lastMonthExpected = lastMonthInvoices.reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
  const lastMonthCollected = lastMonthInvoices.filter(inv => inv.statut === "paid").reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
  const lastMonthPercentage = lastMonthExpected > 0 ? (lastMonthCollected / lastMonthExpected) * 100 : 0;
  
  // Calculer les impayés (toutes les factures non payées)
  const unpaid = invoices?.filter(inv => inv.statut !== "paid").reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0) || 0;
  
  // Générer les données du graphique (6 derniers mois)
  const chartData: Array<{ period: string; expected: number; collected: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, "0")}`;
    
    const periodInvoices = invoices?.filter(inv => inv.periode === period) || [];
    const expected = periodInvoices.reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
    const collected = periodInvoices.filter(inv => inv.statut === "paid").reduce((sum, inv) => sum + (Number(inv.montant_total) || 0), 0);
    
    chartData.push({ period, expected, collected });
  }
  
  return {
    zone1_tasks: [],
    zone2_finances: {
      kpis: {
        revenue_current_month: {
          expected: currentMonthExpected,
          collected: currentMonthCollected,
          percentage: currentMonthPercentage,
        },
        revenue_last_month: {
          expected: lastMonthExpected,
          collected: lastMonthCollected,
          percentage: lastMonthPercentage,
        },
        arrears_amount: unpaid,
      },
      chart_data: chartData,
    },
    zone3_portfolio: {
      modules: [],
      compliance: [],
    },
  };
}

/**
 * Récupère toutes les propriétés d'un propriétaire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerProperties(
  ownerId: string,
  filters?: FetchOwnerPropertiesFilters
): Promise<OwnerProperty[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from("properties")
    .select("*")
    .eq("owner_id", ownerId);
  
  // Appliquer les filtres
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.status) {
    query = query.eq("etat", filters.status);
  }
  if (filters?.search) {
    query = query.or(`adresse_complete.ilike.%${filters.search}%,title.ilike.%${filters.search}%`);
  }
  
  const { data: properties, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("[fetchOwnerProperties] Error:", error);
    throw new Error(`Erreur lors de la récupération des propriétés: ${error.message}`);
  }
  
  // Récupérer les baux pour enrichir les propriétés
  const propertyIds = properties?.map(p => p.id) || [];
  const { data: leases } = await supabase
    .from("leases")
    .select("*")
    .in("property_id", propertyIds);
  
  // Transformer en OwnerProperty[]
  return (properties || []).map(property => {
    const propertyLeases = leases?.filter(l => l.property_id === property.id) || [];
    const activeLease = propertyLeases.find(l => l.statut === "active");
    
    return {
      id: property.id,
      owner_id: property.owner_id,
      type: property.type || "",
      adresse_complete: property.adresse_complete || "",
      code_postal: property.code_postal || "",
      ville: property.ville || "",
      departement: property.departement || "",
      surface: property.surface || 0,
      nb_pieces: property.nb_pieces || 0,
      nb_chambres: property.nb_chambres || 0,
      status: activeLease ? "loue" : property.etat === "draft" ? "a_completer" : "vacant",
      monthlyRent: activeLease ? Number(activeLease.loyer || 0) + Number(activeLease.charges_forfaitaires || 0) : 0,
      cover_url: property.photo_url || undefined,
      currentLease: activeLease ? {
        id: activeLease.id,
        loyer: Number(activeLease.loyer || 0),
        charges_forfaitaires: Number(activeLease.charges_forfaitaires || 0),
        statut: activeLease.statut as any,
      } : undefined,
      created_at: property.created_at || new Date().toISOString(),
      updated_at: property.updated_at || undefined,
    } as OwnerProperty;
  });
}

/**
 * Récupère une propriété par ID avec toutes ses informations
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerPropertyById(
  ownerId: string,
  propertyId: string
): Promise<OwnerProperty | null> {
  const supabase = await createClient();
  
  // Récupérer la propriété avec toutes les colonnes et les photos
  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      *,
      photos:photos(id, url, storage_path, is_main, tag, ordre, room_id)
    `)
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .single();
  
  if (error || !property) {
    return null;
  }
  
  // Récupérer les baux pour cette propriété
  const { data: leases } = await supabase
    .from("leases")
    .select("*")
    .eq("property_id", propertyId);
  
  const activeLease = leases?.find(l => l.statut === "active");
  
  // Trier les photos par ordre
  const photos = (property.photos || []).sort((a: any, b: any) => (a.ordre || 0) - (b.ordre || 0));
  
  // Trouver la photo principale ou la première photo
  const mainPhoto = photos.find((p: any) => p.is_main) || photos[0];
  
  return {
    id: property.id,
    owner_id: property.owner_id,
    type: property.type || "",
    type_bien: property.type_bien || undefined,
    adresse_complete: property.adresse_complete || "",
    code_postal: property.code_postal || "",
    ville: property.ville || "",
    departement: property.departement || "",
    surface: property.surface || 0,
    nb_pieces: property.nb_pieces || 0,
    nb_chambres: property.nb_chambres || 0,
    etage: property.etage || undefined,
    ascenseur: property.ascenseur || false,
    status: activeLease ? "loue" : property.etat === "draft" ? "a_completer" : "vacant",
    monthlyRent: activeLease ? Number(activeLease.loyer || 0) + Number(activeLease.charges_forfaitaires || 0) : 0,
    cover_url: mainPhoto?.url || property.photo_url || undefined,
    
    // DPE & Diagnostics
    energie: property.energie || undefined,
    ges: property.ges || undefined,
    dpe_classe_energie: property.dpe_classe_energie || undefined,
    dpe_classe_climat: property.dpe_classe_climat || undefined,
    dpe_consommation: property.dpe_consommation || undefined,
    dpe_emissions: property.dpe_emissions || undefined,
    
    // Équipements
    has_balcon: property.has_balcon || false,
    has_terrasse: property.has_terrasse || false,
    has_jardin: property.has_jardin || false,
    has_cave: property.has_cave || false,
    equipments: property.equipments || undefined,
    
    // Chauffage
    chauffage_type: property.chauffage_type || undefined,
    chauffage_energie: property.chauffage_energie || undefined,
    
    // Climatisation
    clim_presence: property.clim_presence || undefined,
    clim_type: property.clim_type || undefined,
    
    // Eau chaude
    eau_chaude_type: property.eau_chaude_type || undefined,
    
    // Permis de louer
    permis_louer_requis: property.permis_louer_requis || false,
    permis_louer_numero: property.permis_louer_numero || undefined,
    permis_louer_date: property.permis_louer_date || undefined,
    
    // Parking
    parking_type: property.parking_type || undefined,
    parking_numero: property.parking_numero || undefined,
    parking_niveau: property.parking_niveau || undefined,
    parking_gabarit: property.parking_gabarit || undefined,
    
    // Local commercial
    local_surface_totale: property.local_surface_totale || undefined,
    local_type: property.local_type || undefined,
    local_has_vitrine: property.local_has_vitrine || false,
    local_access_pmr: property.local_access_pmr || false,
    local_clim: property.local_clim || false,
    local_fibre: property.local_fibre || false,
    local_alarme: property.local_alarme || false,
    
    // Photos
    photos: photos.length > 0 ? photos.map((p: any) => ({
      id: p.id,
      url: p.url || "",
      storage_path: p.storage_path || "",
      is_main: p.is_main || false,
      tag: p.tag || null,
      ordre: p.ordre || 0,
      room_id: p.room_id || null,
    })) : undefined,
    
    // Bail actif
    currentLease: activeLease ? {
      id: activeLease.id,
      loyer: Number(activeLease.loyer || 0),
      charges_forfaitaires: Number(activeLease.charges_forfaitaires || 0),
      statut: activeLease.statut as any,
    } : undefined,
    
    created_at: property.created_at || new Date().toISOString(),
    updated_at: property.updated_at || undefined,
  } as OwnerProperty;
}

/**
 * Récupère tous les baux d'un propriétaire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerContracts(
  ownerId: string,
  filters?: {
    property_id?: string;
    status?: LeaseStatus;
    search?: string;
  }
): Promise<OwnerContract[]> {
  const supabase = await createClient();
  
  // Récupérer les propriétés du propriétaire pour filtrer les baux
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId);
  
  const propertyIds = properties?.map(p => p.id) || [];
  
  if (propertyIds.length === 0) {
    return [];
  }
  
  // Construire la requête pour les baux
  let query = supabase
    .from("leases")
    .select(`
      *,
      property:properties(id, adresse_complete, type)
    `)
    .in("property_id", propertyIds);
  
  // Appliquer les filtres
  if (filters?.property_id) {
    query = query.eq("property_id", filters.property_id);
  }
  if (filters?.status) {
    query = query.eq("statut", filters.status);
  }
  
  const { data: leases, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("[fetchOwnerContracts] Error:", error);
    throw new Error(`Erreur lors de la récupération des baux: ${error.message}`);
  }
  
  if (!leases || leases.length === 0) {
    return [];
  }
  
  // Récupérer les signataires (locataires) pour chaque bail
  const leaseIds = leases.map(l => l.id);
  const { data: signers } = await supabase
    .from("lease_signers")
    .select(`
      lease_id,
      role,
      profile:profiles(id, prenom, nom)
    `)
    .in("lease_id", leaseIds)
    .eq("role", "locataire_principal");
  
  // Créer un map pour accéder rapidement aux signataires
  const signersMap = new Map<string, any>();
  signers?.forEach(s => {
    if (s.lease_id && !signersMap.has(s.lease_id)) {
      signersMap.set(s.lease_id, s.profile);
    }
  });
  
  // Transformer en OwnerContract[]
  return leases.map(lease => {
    const tenantProfile = signersMap.get(lease.id);
    
    return {
      id: lease.id,
      property_id: lease.property_id || "",
      property: lease.property ? {
        id: lease.property.id,
        adresse_complete: lease.property.adresse_complete || "",
        type: lease.property.type || "",
      } : undefined,
      type_bail: lease.type_bail || "",
      loyer: Number(lease.loyer || 0),
      charges_forfaitaires: Number(lease.charges_forfaitaires || 0),
      date_debut: lease.date_debut || "",
      date_fin: lease.date_fin || undefined,
      statut: lease.statut as LeaseStatus,
      tenant: tenantProfile ? {
        id: tenantProfile.id,
        prenom: tenantProfile.prenom || "",
        nom: tenantProfile.nom || "",
      } : undefined,
      created_at: lease.created_at || new Date().toISOString(),
    } as OwnerContract;
  });
}

/**
 * Récupère un bail par ID
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerContractById(
  ownerId: string,
  contractId: string
): Promise<OwnerContract | null> {
  const supabase = await createClient();
  
  // Vérifier que le bail appartient à une propriété du propriétaire
  const { data: lease, error } = await supabase
    .from("leases")
    .select(`
      *,
      property:properties!inner(id, adresse_complete, type, owner_id)
    `)
    .eq("id", contractId)
    .eq("property.owner_id", ownerId)
    .single();
  
  if (error || !lease) {
    return null;
  }
  
  // Récupérer le locataire principal
  const { data: signer } = await supabase
    .from("lease_signers")
    .select(`
      profile:profiles(id, prenom, nom)
    `)
    .eq("lease_id", contractId)
    .eq("role", "locataire_principal")
    .single();
  
  return {
    id: lease.id,
    property_id: lease.property_id || "",
    property: lease.property ? {
      id: lease.property.id,
      adresse_complete: lease.property.adresse_complete || "",
      type: lease.property.type || "",
    } : undefined,
    type_bail: lease.type_bail || "",
    loyer: Number(lease.loyer || 0),
    charges_forfaitaires: Number(lease.charges_forfaitaires || 0),
    date_debut: lease.date_debut || "",
    date_fin: lease.date_fin || undefined,
    statut: lease.statut as LeaseStatus,
    tenant: signer?.profile ? {
      id: signer.profile.id,
      prenom: signer.profile.prenom || "",
      nom: signer.profile.nom || "",
    } : undefined,
    created_at: lease.created_at || new Date().toISOString(),
  } as OwnerContract;
}

/**
 * Récupère le résumé financier
 */
export async function fetchOwnerMoneySummary(
  ownerId: string
): Promise<OwnerMoneySummary> {
  // TODO: Créer API /api/owner/money/summary
  // Pour l'instant, utiliser les données du dashboard
  const dashboard = await fetchOwnerDashboard(ownerId);
  return {
    total_due_current_month: dashboard.zone2_finances.kpis.revenue_current_month.expected,
    total_collected_current_month: dashboard.zone2_finances.kpis.revenue_current_month.collected,
    arrears_amount: dashboard.zone2_finances.kpis.arrears_amount,
    chart_data: dashboard.zone2_finances.chart_data,
  };
}

/**
 * Récupère les factures d'un propriétaire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerMoneyInvoices(
  ownerId: string,
  filters?: {
    module?: OwnerModuleKey;
    status?: InvoiceStatus;
    search?: string;
  }
): Promise<OwnerMoneyInvoice[]> {
  const supabase = await createClient();
  
  // Récupérer les propriétés du propriétaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id, type")
    .eq("owner_id", ownerId);
  
  const propertyIds = properties?.map(p => p.id) || [];
  
  if (propertyIds.length === 0) {
    return [];
  }
  
  // Récupérer les baux de ces propriétés
  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id")
    .in("property_id", propertyIds);
  
  const leaseIds = leases?.map(l => l.id) || [];
  
  if (leaseIds.length === 0) {
    return [];
  }
  
  // Construire la requête pour les factures
  let query = supabase
    .from("invoices")
    .select(`
      *,
      lease:leases!inner(
        id,
        property:properties!inner(id, adresse_complete, type, owner_id)
      )
    `)
    .in("lease_id", leaseIds)
    .eq("lease.property.owner_id", ownerId);
  
  // Appliquer les filtres
  if (filters?.status) {
    query = query.eq("statut", filters.status);
  }
  if (filters?.module) {
    // Filtrer par type de propriété
    const modulePropertyTypes: Record<OwnerModuleKey, string[]> = {
      habitation: ["appartement", "maison"],
      lcd: ["local_commercial"],
      pro: ["bureau", "local_professionnel"],
      parking: ["parking", "box"],
    };
    const types = modulePropertyTypes[filters.module] || [];
    if (types.length > 0) {
      query = query.in("lease.property.type", types);
    }
  }
  
  const { data: invoices, error } = await query.order("periode", { ascending: false });
  
  if (error) {
    console.error("[fetchOwnerMoneyInvoices] Error:", error);
    throw new Error(`Erreur lors de la récupération des factures: ${error.message}`);
  }
  
  if (!invoices || invoices.length === 0) {
    return [];
  }
  
  // Récupérer les locataires pour chaque bail
  const invoiceLeaseIds = invoices.map(inv => inv.lease_id).filter(Boolean) as string[];
  const { data: signers } = await supabase
    .from("lease_signers")
    .select(`
      lease_id,
      profile:profiles(id, prenom, nom)
    `)
    .in("lease_id", invoiceLeaseIds)
    .eq("role", "locataire_principal");
  
  const signersMap = new Map<string, any>();
  signers?.forEach(s => {
    if (s.lease_id && !signersMap.has(s.lease_id)) {
      signersMap.set(s.lease_id, s.profile);
    }
  });
  
  // Calculer les jours de retard pour les factures en retard
  const now = new Date();
  
  // Transformer en OwnerMoneyInvoice[]
  return invoices.map(invoice => {
    const lease = invoice.lease as any;
    const property = lease?.property;
    const tenant = signersMap.get(invoice.lease_id);
    
    // Calculer les jours de retard si la facture est en retard
    let daysOverdue: number | undefined;
    if (invoice.statut === "late" && invoice.periode) {
      const [year, month] = invoice.periode.split("-").map(Number);
      const dueDate = new Date(year, month, 1); // Premier jour du mois suivant
      daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    }
    
    return {
      id: invoice.id,
      lease_id: invoice.lease_id || "",
      property: property ? {
        id: property.id,
        adresse_complete: property.adresse_complete || "",
      } : undefined,
      tenant: tenant ? {
        id: tenant.id,
        prenom: tenant.prenom || "",
        nom: tenant.nom || "",
      } : undefined,
      periode: invoice.periode || "",
      montant_total: Number(invoice.montant_total || 0),
      montant_loyer: Number(invoice.montant_loyer || 0),
      montant_charges: Number(invoice.montant_charges || 0),
      statut: invoice.statut as InvoiceStatus,
      days_overdue: daysOverdue,
      created_at: invoice.created_at || new Date().toISOString(),
    } as OwnerMoneyInvoice;
  });
}

/**
 * Récupère les indexations à faire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerIndexationsDue(
  ownerId: string
): Promise<OwnerIndexationDue[]> {
  const supabase = await createClient();
  
  // Récupérer les propriétés du propriétaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId);
  
  const propertyIds = properties?.map(p => p.id) || [];
  
  if (propertyIds.length === 0) {
    return [];
  }
  
  // Récupérer les baux actifs de ces propriétés
  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, date_debut, loyer")
    .in("property_id", propertyIds)
    .eq("statut", "active");
  
  if (!leases || leases.length === 0) {
    return [];
  }
  
  // TODO: Implémenter la logique complète d'indexation
  // Pour l'instant, retourner un tableau vide car la logique d'indexation
  // nécessite de connaître le type d'indexation (IRL, ILC, ILAT) et
  // la date de dernière indexation, ce qui n'est pas encore dans le schéma
  
  return [];
}

/**
 * Récupère les régularisations de charges à faire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerRegularizationsDue(
  ownerId: string
): Promise<OwnerRegularizationDue[]> {
  const supabase = await createClient();
  
  // Récupérer les propriétés du propriétaire
  const { data: properties } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId);
  
  const propertyIds = properties?.map(p => p.id) || [];
  
  if (propertyIds.length === 0) {
    return [];
  }
  
  // Récupérer les baux actifs de ces propriétés
  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, date_debut, charges_forfaitaires")
    .in("property_id", propertyIds)
    .eq("statut", "active");
  
  if (!leases || leases.length === 0) {
    return [];
  }
  
  // TODO: Implémenter la logique complète de régularisation de charges
  // Pour l'instant, retourner un tableau vide car la logique nécessite
  // de connaître les charges réelles vs provisions, ce qui nécessite
  // une table charges ou un système de suivi des charges réelles
  
  return [];
}

/**
 * Récupère tous les documents d'un propriétaire
 * Utilise directement Supabase côté serveur
 */
export async function fetchOwnerDocuments(
  ownerId: string,
  filters?: {
    type?: string;
    status?: DocumentStatus;
    property_id?: string;
    lease_id?: string;
    search?: string;
  }
): Promise<OwnerDocument[]> {
  const supabase = await createClient();
  
  // Construire la requête pour les documents
  let query = supabase
    .from("documents")
    .select(`
      *,
      property:properties(id, adresse_complete, owner_id),
      lease:leases(id, property_id)
    `)
    .eq("owner_id", ownerId);
  
  // Appliquer les filtres
  if (filters?.property_id) {
    query = query.eq("property_id", filters.property_id);
  }
  if (filters?.lease_id) {
    query = query.eq("lease_id", filters.lease_id);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  // Note: Le filtre status sera appliqué après le calcul du statut basé sur valid_until
  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,storage_path.ilike.%${filters.search}%`);
  }
  
  const { data: documents, error } = await query.order("created_at", { ascending: false });
  
  if (error) {
    console.error("[fetchOwnerDocuments] Error:", error);
    throw new Error(`Erreur lors de la récupération des documents: ${error.message}`);
  }
  
  if (!documents || documents.length === 0) {
    return [];
  }
  
  // Calculer le statut pour chaque document basé sur valid_until
  const now = new Date();
  
  // Transformer en OwnerDocument[] et appliquer le filtre status si nécessaire
  return documents
    .map(doc => {
      const property = doc.property as any;
      const lease = doc.lease as any;
      
      // Déterminer le statut du document
      let statut: DocumentStatus = "active";
      if (doc.valid_until) {
        const validUntil = new Date(doc.valid_until);
        const daysUntilExpiry = Math.floor((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          statut = "expired";
        } else if (daysUntilExpiry <= 30) {
          statut = "expiring_soon";
        }
      }
      
      return {
        id: doc.id,
        type: doc.type || "",
        property_id: doc.property_id || undefined,
        property: property ? {
          id: property.id,
          adresse_complete: property.adresse_complete || "",
        } : undefined,
        lease_id: doc.lease_id || undefined,
        lease: lease ? {
          id: lease.id,
          reference: undefined, // TODO: Ajouter référence si disponible
        } : undefined,
        title: doc.title || undefined,
        storage_path: doc.storage_path || "",
        statut: statut,
        valid_until: doc.valid_until || undefined,
        created_at: doc.created_at || new Date().toISOString(),
      } as OwnerDocument;
    })
    .filter(doc => {
      // Appliquer le filtre status après calcul
      if (filters?.status) {
        return doc.statut === filters.status;
      }
      return true;
    });
}

