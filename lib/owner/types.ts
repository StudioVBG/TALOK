/**
 * Types centralisés pour le Compte Propriétaire
 */

export type OwnerModuleKey = "habitation" | "lcd" | "pro" | "parking";

export type PropertyStatus = "loue" | "en_preavis" | "vacant" | "a_completer";
export type LeaseStatus = "draft" | "pending_signature" | "active" | "terminated";
export type InvoiceStatus = "draft" | "sent" | "paid" | "late";
export type DocumentStatus = "active" | "expiring_soon" | "expired" | "archived";
export type TodoPriority = "high" | "medium" | "low";
export type RiskSeverity = "high" | "medium" | "low";

export interface OwnerPropertyPhoto {
  id: string;
  url: string;
  storage_path: string;
  is_main: boolean;
  tag: string | null;
  ordre: number;
  room_id?: string | null;
}

export interface OwnerProperty {
  id: string;
  owner_id: string;
  type: string;
  type_bien?: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
  surface?: number;
  nb_pieces?: number;
  nb_chambres?: number;
  etage?: number | null;
  ascenseur?: boolean;
  status: PropertyStatus;
  monthlyRent: number;
  cover_url?: string;
  
  // DPE & Diagnostics
  energie?: string | null;
  ges?: string | null;
  dpe_classe_energie?: string | null;
  dpe_classe_climat?: string | null;
  dpe_consommation?: number | null;
  dpe_emissions?: number | null;
  
  // Équipements
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;
  equipments?: string[] | null;
  
  // Chauffage
  chauffage_type?: string | null;
  chauffage_energie?: string | null;
  
  // Climatisation
  clim_presence?: string | null;
  clim_type?: string | null;
  
  // Eau chaude
  eau_chaude_type?: string | null;
  
  // Permis de louer
  permis_louer_requis?: boolean;
  permis_louer_numero?: string | null;
  permis_louer_date?: string | null;
  
  // Parking (si applicable)
  parking_type?: string | null;
  parking_numero?: string | null;
  parking_niveau?: string | null;
  parking_gabarit?: string | null;
  
  // Local commercial (si applicable)
  local_surface_totale?: number | null;
  local_type?: string | null;
  local_has_vitrine?: boolean;
  local_access_pmr?: boolean;
  local_clim?: boolean;
  local_fibre?: boolean;
  local_alarme?: boolean;
  
  // Photos
  photos?: OwnerPropertyPhoto[];
  
  // Bail actif
  currentLease?: {
    id: string;
    loyer: number;
    charges_forfaitaires: number;
    statut: LeaseStatus;
  };
  
  created_at: string;
  updated_at?: string;
}

export interface OwnerContract {
  id: string;
  property_id: string;
  property?: {
    id: string;
    adresse_complete: string;
    type: string;
  };
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  date_debut: string;
  date_fin?: string;
  statut: LeaseStatus;
  tenant?: {
    id: string;
    prenom: string;
    nom: string;
  };
  created_at: string;
}

export interface OwnerMoneySummary {
  total_due_current_month: number;
  total_collected_current_month: number;
  arrears_amount: number;
  chart_data: Array<{
    period: string;
    expected: number;
    collected: number;
  }>;
}

export interface OwnerMoneyInvoice {
  id: string;
  lease_id: string;
  property?: {
    id: string;
    adresse_complete: string;
  };
  tenant?: {
    id: string;
    prenom: string;
    nom: string;
  };
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: InvoiceStatus;
  days_overdue?: number;
  created_at: string;
}

export interface OwnerDocument {
  id: string;
  type: string;
  property_id?: string;
  property?: {
    id: string;
    adresse_complete: string;
  };
  lease_id?: string;
  lease?: {
    id: string;
    reference?: string;
  };
  title?: string;
  storage_path: string;
  statut: DocumentStatus;
  valid_until?: string;
  created_at: string;
}

export interface OwnerTodoItem {
  id: string;
  type: "rent_arrears" | "sign_contracts" | "indexation" | "lease_end" | "compliance";
  priority: TodoPriority;
  label: string;
  description?: string;
  count?: number;
  total_amount?: number;
  action_url: string;
}

export interface OwnerRiskItem {
  id: string;
  type: "dpe_expiring" | "lease_end" | "indexation_due" | "tax_declaration" | "compliance";
  severity: RiskSeverity;
  label: string;
  description?: string;
  property_id?: string;
  lease_id?: string;
  action_url: string;
}

export interface OwnerModuleStats {
  module: OwnerModuleKey;
  label: string;
  stats: {
    active_leases?: number;
    monthly_revenue?: number;
    occupancy_rate?: number;
    nights_sold?: number;
    revenue?: number;
    properties_count?: number;
  };
  action_url: string;
}

export interface OwnerDashboardData {
  zone1_tasks: OwnerTodoItem[];
  zone2_finances: {
    chart_data: Array<{
      period: string;
      expected: number;
      collected: number;
    }>;
    kpis: {
      revenue_current_month: {
        collected: number;
        expected: number;
        percentage: number;
      };
      revenue_last_month: {
        collected: number;
        expected: number;
        percentage: number;
      };
      arrears_amount: number;
    };
  };
  zone3_portfolio: {
    modules: OwnerModuleStats[];
    compliance: OwnerRiskItem[];
    performance?: {
      total_investment: number;
      total_monthly_revenue: number;
      annual_yield: number;
      roi: number;
    } | null;
  };
}

export interface OwnerIndexationDue {
  id: string;
  lease_id: string;
  lease: OwnerContract;
  index_type: "IRL" | "ILC" | "ILAT";
  last_indexation_date?: string;
  eligible_date: string;
  current_amount: number;
  estimated_new_amount: number;
}

export interface OwnerRegularizationDue {
  id: string;
  lease_id: string;
  lease: OwnerContract;
  period: string;
  provisions: number;
  actual_charges: number;
  difference: number;
}

