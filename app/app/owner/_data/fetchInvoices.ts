// @ts-nocheck
/**
 * Data fetching pour les factures (Owner)
 * Server-side uniquement
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface InvoiceRow {
  id: string;
  lease_id: string;
  owner_id: string;
  tenant_id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: "draft" | "sent" | "paid" | "late";
  created_at: string;
  updated_at: string;
  // Relations
  lease?: {
    property?: {
      adresse_complete: string;
      ville: string;
    }
  }
}

export interface FetchInvoicesOptions {
  ownerId: string;
  leaseId?: string;
  status?: string;
  periode?: string;
  limit?: number;
  offset?: number;
}

export interface InvoicesWithPagination {
  invoices: InvoiceRow[];
  total: number;
  page: number;
  limit: number;
  stats: {
    totalDue: number;
    totalCollected: number;
    totalUnpaid: number;
  };
}

/**
 * Récupère les factures d'un propriétaire avec jointures
 */
export async function fetchInvoices(
  options: FetchInvoicesOptions
): Promise<InvoicesWithPagination> {
  const supabase = await createClient();

  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Vérifier les permissions
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== options.ownerId) {
    throw new Error("Accès non autorisé");
  }

  // Construire la requête principale SANS jointure nested pour éviter la récursion RLS
  // On récupère les factures d'abord, puis les données associées séparément si nécessaire
  let query = supabase
    .from("invoices")
    .select(`
      *,
      lease_id
    `, { count: "exact" })
    .eq("owner_id", options.ownerId)
    .order("periode", { ascending: false });

  // Filtrer par bail si spécifié
  if (options.leaseId) {
    query = query.eq("lease_id", options.leaseId);
  }

  // Filtrer par statut si spécifié
  if (options.status) {
    query = query.eq("statut", options.status);
  }

  // Filtrer par période si spécifié
  if (options.periode) {
    query = query.eq("periode", options.periode);
  }

  // Pagination
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data: invoices, error, count } = await query;

  if (error) {
    // Gérer l'erreur de récursion RLS gracieusement
    if (error.message.includes("infinite recursion")) {
      console.warn("[fetchInvoices] Recursion RLS détectée, fallback sans jointures");
      // Retourner des données vides plutôt que de crasher
      return {
        invoices: [],
        total: 0,
        page: 1,
        limit: options.limit || 50,
        stats: { totalDue: 0, totalCollected: 0, totalUnpaid: 0 }
      };
    }
    throw new Error(`Erreur lors de la récupération des factures: ${error.message}`);
  }

  // Récupérer les informations des propriétés séparément pour éviter la récursion RLS
  const leaseIds = [...new Set((invoices || []).map((inv: any) => inv.lease_id).filter(Boolean))];
  
  let propertyMap: Record<string, { adresse_complete: string; ville: string }> = {};
  
  if (leaseIds.length > 0) {
    const { data: leasesData } = await supabase
      .from("leases")
      .select("id, property_id")
      .in("id", leaseIds);

    if (leasesData && leasesData.length > 0) {
      const propertyIds = [...new Set(leasesData.map((l: any) => l.property_id).filter(Boolean))];
      
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, adresse_complete, ville, code_postal")
        .in("id", propertyIds);

      if (propertiesData) {
        // Créer un map lease_id -> property info
        const propById = Object.fromEntries(propertiesData.map((p: any) => [p.id, p]));
        const leaseToProperty = Object.fromEntries(
          leasesData.map((l: any) => [l.id, propById[l.property_id]])
        );
        
        // Enrichir les factures avec les infos de propriété
        (invoices as any[]).forEach((inv: any) => {
          const prop = leaseToProperty[inv.lease_id];
          if (prop) {
            inv.lease = {
              property: {
                adresse_complete: prop.adresse_complete,
                ville: prop.ville,
                code_postal: prop.code_postal
              }
            };
          }
        });
      }
    }
  }

  // Calculer les stats (KPIs) - idéalement via une RPC séparée pour ne pas tout charger,
  // mais ici on peut faire une approximation sur les données chargées ou faire une 2ème requête légère.
  // Pour être précis, faisons une requête d'agrégation rapide.
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Requête pour les stats globales (mois courant)
  const { data: statsData } = await supabase
    .from("invoices")
    .select("montant_total, statut, periode")
    .eq("owner_id", options.ownerId)
    // On limite aux factures récentes ou mois courant pour les stats "live"
    // Pour l'UI "Total dû ce mois-ci", on filtre sur periode = currentMonth
    .eq("periode", currentMonth);

  let totalDue = 0;
  let totalCollected = 0;
  let totalUnpaid = 0;

  if (statsData) {
    totalDue = statsData.reduce((sum, inv) => sum + (inv.montant_total || 0), 0);
    
    totalCollected = statsData
      .filter(inv => inv.statut === "paid")
      .reduce((sum, inv) => sum + (inv.montant_total || 0), 0);
      
    totalUnpaid = statsData
      .filter(inv => ["sent", "draft", "late"].includes(inv.statut))
      .reduce((sum, inv) => sum + (inv.montant_total || 0), 0);
  }

  return {
    invoices: (invoices as any[]) || [],
    total: count || 0,
    page: Math.floor(offset / limit) + 1,
    limit,
    stats: {
      totalDue,
      totalCollected,
      totalUnpaid
    }
  };
}

/**
 * Récupère une facture par ID
 */
export async function fetchInvoice(
  invoiceId: string,
  ownerId: string
): Promise<InvoiceRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner" || profile.id !== ownerId) {
    throw new Error("Accès non autorisé");
  }

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("owner_id", ownerId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Erreur facture: ${error.message}`);
  }

  // Récupérer les informations de propriété séparément
  if (invoice?.lease_id) {
    const { data: leaseData } = await supabase
      .from("leases")
      .select("property_id")
      .eq("id", invoice.lease_id)
      .single();

    if (leaseData?.property_id) {
      const { data: propertyData } = await supabase
        .from("properties")
        .select("adresse_complete, ville")
        .eq("id", leaseData.property_id)
        .single();

      if (propertyData) {
        (invoice as any).lease = {
          property: propertyData
        };
      }
    }
  }

  return invoice as any;
}
