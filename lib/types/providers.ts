/**
 * Types pour le module Prestataires SOTA 2026
 * Tables: providers, owner_providers, work_orders (extended), provider_reviews
 */

// ============================================
// ENUMS / UNIONS
// ============================================

export type TradeCategory =
  | 'plomberie'
  | 'electricite'
  | 'serrurerie'
  | 'peinture'
  | 'menuiserie'
  | 'chauffage'
  | 'climatisation'
  | 'toiture'
  | 'maconnerie'
  | 'jardinage'
  | 'nettoyage'
  | 'demenagement'
  | 'diagnostic'
  | 'general';

export const TRADE_CATEGORY_LABELS: Record<TradeCategory, string> = {
  plomberie: 'Plomberie',
  electricite: 'Electricite',
  serrurerie: 'Serrurerie',
  peinture: 'Peinture',
  menuiserie: 'Menuiserie',
  chauffage: 'Chauffage',
  climatisation: 'Climatisation',
  toiture: 'Toiture',
  maconnerie: 'Maconnerie',
  jardinage: 'Jardinage',
  nettoyage: 'Nettoyage',
  demenagement: 'Demenagement',
  diagnostic: 'Diagnostic',
  general: 'General',
};

export type ProviderStatus = 'active' | 'suspended' | 'archived';

export type WorkOrderStatus =
  | 'draft'
  | 'quote_requested'
  | 'quote_received'
  | 'quote_approved'
  | 'quote_rejected'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'invoiced'
  | 'paid'
  | 'disputed'
  | 'cancelled';

export type WorkOrderUrgency = 'low' | 'normal' | 'urgent' | 'emergency';

export type PaymentMethod = 'bank_transfer' | 'check' | 'cash' | 'stripe';

export type DeductibleCategory = 'entretien' | 'reparation' | 'amelioration';

// ============================================
// STATUS LABELS & CONFIG
// ============================================

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Brouillon',
  quote_requested: 'Devis demande',
  quote_received: 'Devis recu',
  quote_approved: 'Devis approuve',
  quote_rejected: 'Devis refuse',
  scheduled: 'Planifie',
  in_progress: 'En cours',
  completed: 'Termine',
  invoiced: 'Facture',
  paid: 'Paye',
  disputed: 'Litige',
  cancelled: 'Annule',
};

export const WORK_ORDER_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  quote_requested: 'bg-blue-100 text-blue-700',
  quote_received: 'bg-indigo-100 text-indigo-700',
  quote_approved: 'bg-cyan-100 text-cyan-700',
  quote_rejected: 'bg-red-100 text-red-700',
  scheduled: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  invoiced: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-muted text-muted-foreground',
};

export const URGENCY_CONFIG: Record<WorkOrderUrgency, { label: string; color: string }> = {
  low: { label: 'Basse', color: 'bg-gray-100 text-gray-600' },
  normal: { label: 'Normale', color: 'bg-blue-100 text-blue-700' },
  urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-700' },
  emergency: { label: 'Urgence', color: 'bg-red-100 text-red-700' },
};

// ============================================
// STATE MACHINE — Valid transitions
// ============================================

export const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  draft: ['quote_requested', 'cancelled'],
  quote_requested: ['quote_received', 'cancelled'],
  quote_received: ['quote_approved', 'quote_rejected'],
  quote_approved: ['scheduled', 'cancelled'],
  quote_rejected: ['draft', 'cancelled'],
  scheduled: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['invoiced', 'disputed'],
  invoiced: ['paid', 'disputed'],
  paid: [],
  disputed: ['completed', 'cancelled'],
  cancelled: [],
};

// ============================================
// INTERFACES
// ============================================

export interface Provider {
  id: string;
  profile_id: string | null;
  company_name: string;
  siret: string | null;
  contact_name: string;
  email: string;
  phone: string;
  trade_categories: TradeCategory[];
  description: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  department: string | null;
  service_radius_km: number;
  certifications: string[];
  insurance_number: string | null;
  insurance_expiry: string | null;
  decennale_number: string | null;
  decennale_expiry: string | null;
  avg_rating: number;
  total_reviews: number;
  total_interventions: number;
  is_available: boolean;
  response_time_hours: number;
  emergency_available: boolean;
  added_by_owner_id: string | null;
  is_marketplace: boolean;
  is_verified: boolean;
  status: ProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface OwnerProvider {
  id: string;
  owner_id: string;
  provider_id: string;
  nickname: string | null;
  notes: string | null;
  is_favorite: boolean;
  created_at: string;
  provider?: Provider;
}

export interface InterventionPhoto {
  url: string;
  caption?: string;
  taken_at?: string;
}

export interface WorkOrderExtended {
  id: string;
  property_id: string | null;
  lease_id: string | null;
  ticket_id: string | null;
  provider_id: string | null;
  owner_id: string | null;
  entity_id: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  urgency: WorkOrderUrgency;
  status: WorkOrderStatus;
  requested_at: string;
  quote_received_at: string | null;
  approved_at: string | null;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  started_at: string | null;
  completed_at: string | null;
  quote_amount_cents: number | null;
  quote_document_id: string | null;
  invoice_amount_cents: number | null;
  invoice_document_id: string | null;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  intervention_report: string | null;
  intervention_photos: InterventionPhoto[];
  tenant_signature_url: string | null;
  accounting_entry_id: string | null;
  is_deductible: boolean;
  deductible_category: DeductibleCategory | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Legacy fields
  statut?: string;
  cout_estime?: number | null;
  cout_final?: number | null;
  // Joined relations
  provider?: Provider;
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  ticket?: {
    id: string;
    titre: string;
    priorite: string;
  };
}

export interface ProviderReviewCriteria {
  ponctualite?: number;
  qualite?: number;
  prix?: number;
  communication?: number;
}

export interface ProviderReview {
  id: string;
  provider_profile_id: string;
  reviewer_profile_id: string;
  work_order_id: string | null;
  property_id: string | null;
  rating_overall: number;
  rating_punctuality: number | null;
  rating_quality: number | null;
  rating_communication: number | null;
  rating_value: number | null;
  title: string | null;
  comment: string | null;
  would_recommend: boolean;
  provider_response: string | null;
  provider_response_at: string | null;
  is_published: boolean;
  created_at: string;
  reviewer?: {
    prenom: string;
    nom: string;
  };
}

// ============================================
// FEATURE GATING
// ============================================

export interface ProviderFeatureGates {
  canManageProviders: boolean;
  maxProviders: number;
  hasMarketplace: boolean;
  hasWorkOrders: boolean;
  hasAutoAccounting: boolean;
  hasProviderAPI?: boolean;
}

export const PROVIDER_GATES: Record<string, ProviderFeatureGates> = {
  gratuit: {
    canManageProviders: false,
    maxProviders: 0,
    hasMarketplace: false,
    hasWorkOrders: false,
    hasAutoAccounting: false,
  },
  starter: {
    canManageProviders: false,
    maxProviders: 0,
    hasMarketplace: false,
    hasWorkOrders: false,
    hasAutoAccounting: false,
  },
  confort: {
    canManageProviders: true,
    maxProviders: 10,
    hasMarketplace: false,
    hasWorkOrders: true,
    hasAutoAccounting: true,
  },
  pro: {
    canManageProviders: true,
    maxProviders: Infinity,
    hasMarketplace: true,
    hasWorkOrders: true,
    hasAutoAccounting: true,
    hasProviderAPI: true,
  },
  enterprise: {
    canManageProviders: true,
    maxProviders: Infinity,
    hasMarketplace: true,
    hasWorkOrders: true,
    hasAutoAccounting: true,
    hasProviderAPI: true,
  },
};
