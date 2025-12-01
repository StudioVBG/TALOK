/**
 * Types TypeScript pour le Module Fin de Bail + Rénovation
 * SOTA 2025 - Module premium différenciant
 */

// ============================================
// STATUTS & ENUMS
// ============================================

export type LeaseEndProcessStatus =
  | 'pending'           // En attente de déclenchement
  | 'triggered'         // Déclenché automatiquement
  | 'edl_scheduled'     // EDL sortie planifié
  | 'edl_in_progress'   // EDL en cours
  | 'edl_completed'     // EDL terminé
  | 'damages_assessed'  // Dommages évalués
  | 'dg_calculated'     // DG calculée
  | 'renovation_planned' // Rénovation planifiée
  | 'renovation_in_progress' // Travaux en cours
  | 'ready_to_rent'     // Prêt à relouer
  | 'completed'         // Processus terminé
  | 'cancelled';        // Annulé

export type InspectionCategory =
  | 'murs'
  | 'sols'
  | 'salle_de_bain'
  | 'cuisine'
  | 'fenetres_portes'
  | 'electricite_plomberie'
  | 'meubles';

export type InspectionStatus = 'pending' | 'ok' | 'problem';

export type DamageType =
  | 'tenant_damage'          // Dommage locataire
  | 'normal_wear'            // Usure normale (vétusté)
  | 'recommended_renovation'; // Rénovation conseillée

export type RenovationWorkType =
  | 'peinture'
  | 'sol'
  | 'plomberie'
  | 'electricite'
  | 'menuiserie'
  | 'nettoyage'
  | 'salle_de_bain'
  | 'cuisine'
  | 'autres';

export type RenovationPayer = 'tenant' | 'owner' | 'shared';

export type RenovationItemStatus =
  | 'pending'
  | 'quote_requested'
  | 'quote_received'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type QuoteStatus = 'pending' | 'received' | 'accepted' | 'rejected' | 'expired';

export type TimelineActionType =
  | 'dg_retention'
  | 'request_quotes'
  | 'select_quote'
  | 'start_renovation'
  | 'take_photos'
  | 'mark_ready'
  | 'create_listing'
  | 'custom';

export type PropertyRentalStatus = 'vacant' | 'end_of_lease' | 'renovation' | 'ready_to_rent' | 'occupied';

// ============================================
// INTERFACES PRINCIPALES
// ============================================

export interface LeaseEndProcess {
  id: string;
  lease_id: string;
  property_id: string;
  status: LeaseEndProcessStatus;
  
  // Dates clés
  lease_end_date: string;
  trigger_date: string;
  edl_scheduled_date?: string | null;
  edl_completed_date?: string | null;
  renovation_start_date?: string | null;
  renovation_end_date?: string | null;
  ready_to_rent_date?: string | null;
  
  // EDL Sortie
  edl_sortie_id?: string | null;
  
  // Montants calculés
  dg_amount: number;
  dg_retention_amount: number;
  dg_refund_amount: number;
  tenant_damage_cost: number;
  vetusty_cost: number;
  renovation_cost: number;
  total_budget: number;
  
  // Progression
  progress_percentage: number;
  current_step: number;
  
  // Métadonnées
  notes?: string | null;
  metadata?: Record<string, unknown>;
  
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  
  // Relations (pour les jointures)
  property?: PropertySummary;
  lease?: LeaseSummary;
  inspection_items?: EDLInspectionItem[];
  renovation_items?: RenovationItem[];
  timeline?: LeaseEndTimelineItem[];
}

export interface PropertySummary {
  id: string;
  adresse_complete: string;
  ville: string;
  type: string;
  surface?: number;
}

export interface LeaseSummary {
  id: string;
  type_bail: string;
  loyer: number;
  date_debut: string;
  date_fin?: string | null;
}

export interface EDLInspectionItem {
  id: string;
  lease_end_process_id: string;
  category: InspectionCategory;
  status: InspectionStatus;
  problem_description?: string | null;
  photos: string[];
  entry_condition?: string | null;
  entry_photos: string[];
  damage_type?: DamageType | null;
  estimated_cost: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RenovationItem {
  id: string;
  lease_end_process_id: string;
  work_type: RenovationWorkType;
  title: string;
  description?: string | null;
  payer: RenovationPayer;
  estimated_cost: number;
  actual_cost?: number | null;
  tenant_share: number;
  owner_share: number;
  status: RenovationItemStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduled_date?: string | null;
  completed_date?: string | null;
  provider_id?: string | null;
  created_at: string;
  updated_at: string;
  quotes?: RenovationQuote[];
}

export interface RenovationQuote {
  id: string;
  renovation_item_id: string;
  lease_end_process_id: string;
  provider_id?: string | null;
  provider_name?: string | null;
  provider_email?: string | null;
  provider_phone?: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  description?: string | null;
  validity_date?: string | null;
  estimated_duration?: number | null;
  status: QuoteStatus;
  document_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaseEndTimelineItem {
  id: string;
  lease_end_process_id: string;
  day_offset: number;
  action_type: TimelineActionType;
  title: string;
  description?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  scheduled_date?: string | null;
  completed_date?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// GRILLES DE RÉFÉRENCE
// ============================================

export interface VetustyGridItem {
  id: string;
  category: string;
  item: string;
  lifespan_years: number;
  yearly_depreciation: number;
  min_residual_value: number;
  is_active: boolean;
}

export interface RepairCostGridItem {
  id: string;
  work_type: string;
  description: string;
  unit: 'm2' | 'ml' | 'unite' | 'forfait';
  cost_min: number;
  cost_max: number;
  cost_avg: number;
  zone_coefficient: number;
  reference_year: number;
  bt01_index?: number | null;
  is_active: boolean;
}

// ============================================
// DTOs POUR LES APIs
// ============================================

export interface CreateLeaseEndProcessDTO {
  lease_id: string;
  property_id: string;
  lease_end_date: string;
  notes?: string;
}

export interface StartEDLSortieDTO {
  lease_end_process_id: string;
  scheduled_date?: string;
}

export interface SubmitInspectionItemDTO {
  lease_end_process_id: string;
  category: InspectionCategory;
  status: InspectionStatus;
  problem_description?: string;
  photos?: string[];
  notes?: string;
}

export interface CompareEDLDTO {
  lease_end_process_id: string;
  edl_entree_id: string;
}

export interface EDLComparisonResult {
  items: Array<{
    category: InspectionCategory;
    entry_status: InspectionStatus;
    exit_status: InspectionStatus;
    has_degradation: boolean;
    damage_type?: DamageType;
    estimated_cost: number;
    photos_comparison: {
      entry: string[];
      exit: string[];
    };
  }>;
  summary: {
    total_items: number;
    items_degraded: number;
    tenant_damage_count: number;
    normal_wear_count: number;
    tenant_damage_cost: number;
    vetusty_cost: number;
  };
}

export interface EstimateRenovationDTO {
  lease_end_process_id: string;
  items: Array<{
    work_type: RenovationWorkType;
    surface_or_quantity: number;
    description?: string;
  }>;
  zone?: string; // paris, idf, lyon, marseille, drom, france
}

export interface RenovationEstimateResult {
  items: Array<{
    work_type: RenovationWorkType;
    description: string;
    unit: string;
    quantity: number;
    cost_min: number;
    cost_max: number;
    cost_avg: number;
  }>;
  totals: {
    tenant_responsibility: number;   // À charge locataire (retenue DG)
    owner_responsibility: number;    // À charge propriétaire
    recommended_renovation: number;  // Conseillé (optionnel)
    total_budget: number;
  };
}

export interface CalculateDGRetentionDTO {
  lease_end_process_id: string;
  damages: Array<{
    category: string;
    item: string;
    original_cost: number;
    age_years: number;
    damage_cost: number;
  }>;
}

export interface DGRetentionResult {
  dg_amount: number;
  retention_details: Array<{
    category: string;
    item: string;
    damage_cost: number;
    vetusty_rate: number;
    tenant_share: number;
    owner_share: number;
  }>;
  total_retention: number;
  total_refund: number;
  pdf_url?: string;
}

export interface GenerateTimelineDTO {
  lease_end_process_id: string;
  start_date: string;
  renovation_items_count: number;
}

export interface TimelineResult {
  items: LeaseEndTimelineItem[];
  estimated_ready_date: string;
  total_days: number;
}

export interface RequestQuotesDTO {
  renovation_item_id: string;
  providers: Array<{
    provider_id?: string;
    name: string;
    email: string;
    phone?: string;
  }>;
  message?: string;
}

export interface UpdatePropertyStatusDTO {
  property_id: string;
  rental_status: PropertyRentalStatus;
}

// ============================================
// CONSTANTES
// ============================================

export const INSPECTION_CATEGORIES: Array<{
  id: InspectionCategory;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: 'murs', label: 'Murs', icon: '🧱', description: 'Peinture, papier peint, trous' },
  { id: 'sols', label: 'Sols', icon: '🪵', description: 'Parquet, carrelage, moquette' },
  { id: 'salle_de_bain', label: 'Salle de bain', icon: '🚿', description: 'Sanitaires, joints, robinetterie' },
  { id: 'cuisine', label: 'Cuisine', icon: '🍳', description: 'Équipements, plan de travail' },
  { id: 'fenetres_portes', label: 'Fenêtres & Portes', icon: '🚪', description: 'Menuiseries, serrures, vitres' },
  { id: 'electricite_plomberie', label: 'Électricité & Plomberie', icon: '⚡', description: 'Prises, robinets, canalisations' },
  { id: 'meubles', label: 'Meubles', icon: '🪑', description: 'Mobilier (location meublée)' },
];

export const DAMAGE_TYPE_LABELS: Record<DamageType, { label: string; color: string; description: string }> = {
  tenant_damage: {
    label: 'Dommage locataire',
    color: 'red',
    description: 'Retenue sur dépôt de garantie',
  },
  normal_wear: {
    label: 'Usure normale',
    color: 'yellow',
    description: 'À charge du propriétaire (vétusté)',
  },
  recommended_renovation: {
    label: 'Rénovation conseillée',
    color: 'blue',
    description: 'Optionnel - augmente la valeur locative',
  },
};

export const PROCESS_STEPS: Array<{
  status: LeaseEndProcessStatus;
  label: string;
  description: string;
}> = [
  { status: 'triggered', label: 'Démarrage', description: 'Processus déclenché' },
  { status: 'edl_scheduled', label: 'EDL planifié', description: 'État des lieux de sortie planifié' },
  { status: 'edl_in_progress', label: 'EDL en cours', description: 'Inspection en cours' },
  { status: 'edl_completed', label: 'EDL terminé', description: 'Inspection terminée' },
  { status: 'damages_assessed', label: 'Dommages évalués', description: 'Comparaison entrée/sortie effectuée' },
  { status: 'dg_calculated', label: 'DG calculée', description: 'Retenue sur dépôt calculée' },
  { status: 'renovation_planned', label: 'Travaux planifiés', description: 'Devis demandés et validés' },
  { status: 'renovation_in_progress', label: 'Travaux en cours', description: 'Rénovation en cours' },
  { status: 'ready_to_rent', label: 'Prêt à louer', description: 'Logement prêt pour nouveau locataire' },
  { status: 'completed', label: 'Terminé', description: 'Processus complet' },
];

export const RENTAL_STATUS_LABELS: Record<PropertyRentalStatus, { label: string; color: string; icon: string }> = {
  vacant: { label: 'Vacant', color: 'gray', icon: '⬛' },
  end_of_lease: { label: 'Fin de bail → travaux', color: 'orange', icon: '🟧' },
  renovation: { label: 'En rénovation', color: 'orange', icon: '🟧' },
  ready_to_rent: { label: 'Prêt à louer', color: 'green', icon: '🟩' },
  occupied: { label: 'Occupé', color: 'blue', icon: '🟦' },
};

// Délais de déclenchement par type de bail (en jours avant fin)
export const LEASE_END_TRIGGER_DAYS: Record<string, number> = {
  nu: 90,           // Location nue : 3 mois
  meuble: 30,       // Meublé : 1 mois
  colocation: 30,   // Colocation : 1 mois
  saisonnier: 0,    // Saisonnier : pas de préavis
  mobilite: 15,     // Mobilité : 15 jours
  etudiant: 30,     // Étudiant : 1 mois
  commercial: 180,  // Commercial : 6 mois
};

