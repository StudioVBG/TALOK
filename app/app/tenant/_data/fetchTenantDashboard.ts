// @ts-nocheck
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
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface?: number;
    nb_pieces?: number;
    parking_numero?: string;
    cover_url?: string;
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

export interface TenantDashboardData {
  profile_id: string;
  // NOUVEAU : Support multi-baux
  leases: TenantLease[];
  properties: any[];
  // RÉTRO-COMPATIBILITÉ : Premier bail/propriété
  lease: TenantLease | null;
  property: any | null;
  // Données communes
  invoices: TenantInvoice[];
  tickets: TenantTicket[];
  stats: {
    unpaid_amount: number;
    unpaid_count: number;
    total_monthly_rent: number;
    active_leases_count: number;
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
    console.error("[fetchTenantDashboard] RPC Error:", error);
    throw new Error("Erreur lors du chargement du dashboard locataire");
  }

  if (!data) return null;

  return data as TenantDashboardData;
}

