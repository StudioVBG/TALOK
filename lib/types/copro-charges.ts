// =====================================================
// Types TypeScript pour les charges COPRO
// =====================================================

// =====================================================
// TYPES DE BASE
// =====================================================

export type ServiceType =
  | 'eau' | 'eau_chaude' | 'chauffage' | 'climatisation'
  | 'electricite_commune' | 'gaz_commun'
  | 'ascenseur' | 'interphone' | 'digicode' | 'videosurveillance'
  | 'menage' | 'gardiennage' | 'jardinage' | 'piscine'
  | 'ordures_menageres' | 'tout_a_legout'
  | 'assurance_immeuble' | 'assurance_rc'
  | 'honoraires_syndic' | 'frais_bancaires' | 'frais_juridiques'
  | 'entretien_equipements' | 'contrat_maintenance'
  | 'travaux_courants' | 'travaux_exceptionnels' | 'ravalement'
  | 'impots_taxes' | 'taxe_fonciere'
  | 'autre';

export type ServiceScopeType = 'site' | 'building' | 'unit_group' | 'unit_type';

export type AllocationMode =
  | 'tantieme_general'
  | 'tantieme_eau'
  | 'tantieme_chauffage'
  | 'tantieme_ascenseur'
  | 'per_unit'
  | 'surface_m2'
  | 'consommation'
  | 'custom';

export type RecurrencePeriod = 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly';

export type ContractStatus = 'draft' | 'active' | 'suspended' | 'terminated' | 'expired';
export type ContractRenewalType = 'manual' | 'auto_annual' | 'auto_tacit';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'on_demand';

export type ExpenseStatus = 'draft' | 'pending_validation' | 'validated' | 'allocated' | 'cancelled';
export type ExpensePaymentStatus = 'pending' | 'partial' | 'paid' | 'cancelled';

export type ChargeStatus = 'pending' | 'invoiced' | 'partial' | 'paid' | 'cancelled';

export type CallForFundsType = 'provision' | 'regularisation' | 'travaux' | 'exceptionnel';
export type CallForFundsStatus = 'draft' | 'validated' | 'sent' | 'partial' | 'closed' | 'cancelled';
export type CallItemStatus = 'pending' | 'sent' | 'partial' | 'paid' | 'cancelled';
export type CallSendMethod = 'email' | 'postal' | 'both';

export type CoproPaymentMethod = 'virement' | 'cheque' | 'prelevement' | 'cb' | 'especes' | 'autre';
export type CoproPaymentStatus = 'pending' | 'validated' | 'rejected' | 'cancelled';

// =====================================================
// SERVICES
// =====================================================

export interface CoproService {
  id: string;
  site_id: string;
  label: string;
  code: string | null;
  service_type: ServiceType;
  scope_type: ServiceScopeType;
  scope_building_id: string | null;
  scope_unit_ids: string[];
  scope_unit_types: string[];
  default_allocation_mode: AllocationMode;
  is_recurring: boolean;
  recurrence_period: RecurrencePeriod | null;
  budget_annual: number;
  budget_monthly: number;
  is_recuperable_locatif: boolean;
  recuperable_ratio_default: number;
  compte_comptable: string | null;
  tva_applicable: boolean;
  tva_rate: number;
  is_active: boolean;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// CONTRATS
// =====================================================

export interface ServiceContract {
  id: string;
  service_id: string;
  site_id: string;
  provider_name: string;
  provider_siret: string | null;
  provider_address: string | null;
  provider_phone: string | null;
  provider_email: string | null;
  provider_profile_id: string | null;
  contract_reference: string | null;
  contract_label: string | null;
  description: string | null;
  start_date: string;
  end_date: string | null;
  renewal_type: ContractRenewalType;
  notice_period_days: number;
  next_renewal_date: string | null;
  amount_annual: number;
  amount_monthly: number;
  payment_frequency: PaymentFrequency;
  is_tva_included: boolean;
  tva_rate: number;
  contract_document_id: string | null;
  status: ContractStatus;
  alert_before_end_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// FACTURES / DÉPENSES
// =====================================================

export interface ServiceExpense {
  id: string;
  site_id: string;
  service_id: string | null;
  contract_id: string | null;
  expense_number: string | null;
  invoice_number: string | null;
  invoice_date: string;
  provider_name: string | null;
  provider_siret: string | null;
  period_start: string;
  period_end: string;
  fiscal_year: number;
  label: string;
  description: string | null;
  amount_ht: number;
  amount_tva: number;
  amount_ttc: number;
  allocation_mode: AllocationMode;
  is_allocated: boolean;
  allocated_at: string | null;
  allocated_by: string | null;
  recuperable_amount: number;
  non_recuperable_amount: number;
  payment_status: ExpensePaymentStatus;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  invoice_document_id: string | null;
  status: ExpenseStatus;
  validated_at: string | null;
  validated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// CHARGES RÉPARTIES
// =====================================================

export interface ChargeCopro {
  id: string;
  expense_id: string;
  unit_id: string;
  service_id: string | null;
  period_start: string;
  period_end: string;
  fiscal_year: number;
  allocation_mode: AllocationMode;
  base_value: number;
  total_base: number;
  percentage: number;
  amount: number;
  amount_recuperable: number;
  amount_non_recuperable: number;
  is_paid: boolean;
  paid_amount: number;
  remaining_amount: number;
  status: ChargeStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// APPELS DE FONDS
// =====================================================

export interface CallForFunds {
  id: string;
  site_id: string;
  call_number: string;
  label: string;
  call_type: CallForFundsType;
  period_label: string;
  period_start: string;
  period_end: string;
  fiscal_year: number;
  due_date: string;
  total_amount: number;
  created_date: string;
  sent_at: string | null;
  sent_by: string | null;
  status: CallForFundsStatus;
  pdf_document_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CallForFundsItem {
  id: string;
  call_id: string;
  unit_id: string;
  owner_profile_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  lot_number: string;
  tantieme_general: number;
  amount: number;
  previous_balance: number;
  total_due: number;
  paid_amount: number;
  remaining_amount: number;
  status: CallItemStatus;
  sent_at: string | null;
  sent_method: CallSendMethod | null;
  email_sent: boolean;
  postal_sent: boolean;
  reminder_count: number;
  last_reminder_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// PAIEMENTS
// =====================================================

export interface CoproPayment {
  id: string;
  site_id: string;
  unit_id: string;
  call_item_id: string | null;
  charge_id: string | null;
  payer_profile_id: string | null;
  payer_name: string | null;
  amount: number;
  payment_date: string;
  payment_method: CoproPaymentMethod;
  reference: string | null;
  bank_reference: string | null;
  check_number: string | null;
  status: CoproPaymentStatus;
  validated_at: string | null;
  validated_by: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// VUES
// =====================================================

export interface UnitBalance {
  unit_id: string;
  lot_number: string;
  site_id: string;
  site_name: string;
  tantieme_general: number;
  owner_name: string;
  total_charges: number;
  total_paid: number;
  balance_due: number;
}

export interface ChargesSummary {
  service_id: string;
  service_label: string;
  service_type: ServiceType;
  fiscal_year: number;
  site_id: string;
  expenses_count: number;
  total_expenses: number;
  total_allocated: number;
  total_paid: number;
  total_due: number;
}

// =====================================================
// ALLOCATION PREVIEW
// =====================================================

export interface AllocationPreviewItem {
  unit_id: string;
  lot_number: string;
  base_value: number;
  total_base: number;
  percentage: number;
  amount: number;
  recuperable_amount: number;
}

export interface AllocationPreview {
  expense_id: string;
  expense_amount: number;
  allocation_mode: AllocationMode;
  items: AllocationPreviewItem[];
  total_allocated: number;
  difference: number;
}

// =====================================================
// FORMULAIRES & INPUT
// =====================================================

export interface CreateServiceInput {
  site_id: string;
  label: string;
  code?: string;
  service_type: ServiceType;
  scope_type?: ServiceScopeType;
  scope_building_id?: string;
  scope_unit_ids?: string[];
  default_allocation_mode?: AllocationMode;
  is_recurring?: boolean;
  recurrence_period?: RecurrencePeriod;
  budget_annual?: number;
  is_recuperable_locatif?: boolean;
  recuperable_ratio_default?: number;
  compte_comptable?: string;
  tva_applicable?: boolean;
  tva_rate?: number;
}

export interface CreateContractInput {
  service_id: string;
  site_id: string;
  provider_name: string;
  provider_siret?: string;
  provider_address?: string;
  provider_phone?: string;
  provider_email?: string;
  contract_reference?: string;
  contract_label?: string;
  description?: string;
  start_date: string;
  end_date?: string;
  renewal_type?: ContractRenewalType;
  notice_period_days?: number;
  amount_annual: number;
  payment_frequency?: PaymentFrequency;
  is_tva_included?: boolean;
  tva_rate?: number;
}

export interface CreateExpenseInput {
  site_id: string;
  service_id?: string;
  contract_id?: string;
  invoice_number?: string;
  invoice_date: string;
  provider_name?: string;
  period_start: string;
  period_end: string;
  label: string;
  description?: string;
  amount_ht: number;
  amount_tva?: number;
  amount_ttc: number;
  allocation_mode?: AllocationMode;
}

export interface CreateCallForFundsInput {
  site_id: string;
  call_type: CallForFundsType;
  period_label: string;
  period_start: string;
  period_end: string;
  due_date: string;
}

export interface CreatePaymentInput {
  site_id: string;
  unit_id: string;
  call_item_id?: string;
  charge_id?: string;
  payer_name?: string;
  amount: number;
  payment_date: string;
  payment_method: CoproPaymentMethod;
  reference?: string;
  bank_reference?: string;
  check_number?: string;
  notes?: string;
}

// =====================================================
// UI HELPERS
// =====================================================

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  eau: 'Eau froide',
  eau_chaude: 'Eau chaude',
  chauffage: 'Chauffage',
  climatisation: 'Climatisation',
  electricite_commune: 'Électricité commune',
  gaz_commun: 'Gaz commun',
  ascenseur: 'Ascenseur',
  interphone: 'Interphone',
  digicode: 'Digicode',
  videosurveillance: 'Vidéosurveillance',
  menage: 'Ménage / Nettoyage',
  gardiennage: 'Gardiennage',
  jardinage: 'Jardinage / Espaces verts',
  piscine: 'Piscine',
  ordures_menageres: 'Ordures ménagères',
  tout_a_legout: 'Tout-à-l\'égout',
  assurance_immeuble: 'Assurance immeuble',
  assurance_rc: 'Assurance RC',
  honoraires_syndic: 'Honoraires syndic',
  frais_bancaires: 'Frais bancaires',
  frais_juridiques: 'Frais juridiques',
  entretien_equipements: 'Entretien équipements',
  contrat_maintenance: 'Contrat de maintenance',
  travaux_courants: 'Travaux courants',
  travaux_exceptionnels: 'Travaux exceptionnels',
  ravalement: 'Ravalement',
  impots_taxes: 'Impôts et taxes',
  taxe_fonciere: 'Taxe foncière',
  autre: 'Autre',
};

export const ALLOCATION_MODE_LABELS: Record<AllocationMode, string> = {
  tantieme_general: 'Tantièmes généraux',
  tantieme_eau: 'Tantièmes eau',
  tantieme_chauffage: 'Tantièmes chauffage',
  tantieme_ascenseur: 'Tantièmes ascenseur',
  per_unit: 'Par lot (égalitaire)',
  surface_m2: 'Au prorata des surfaces',
  consommation: 'Selon consommation',
  custom: 'Répartition personnalisée',
};

export const CALL_TYPE_LABELS: Record<CallForFundsType, string> = {
  provision: 'Appel de provisions',
  regularisation: 'Régularisation annuelle',
  travaux: 'Appel travaux',
  exceptionnel: 'Appel exceptionnel',
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: 'Brouillon',
  pending_validation: 'En attente de validation',
  validated: 'Validé',
  allocated: 'Réparti',
  cancelled: 'Annulé',
};

export const CALL_STATUS_LABELS: Record<CallForFundsStatus, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  sent: 'Envoyé',
  partial: 'Partiellement payé',
  closed: 'Clôturé',
  cancelled: 'Annulé',
};

export const PAYMENT_METHOD_LABELS: Record<CoproPaymentMethod, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  prelevement: 'Prélèvement',
  cb: 'Carte bancaire',
  especes: 'Espèces',
  autre: 'Autre',
};

// =====================================================
// RÉCUPÉRABILITÉ PAR DÉFAUT (Décret 87-713)
// =====================================================

export const DEFAULT_RECUPERABLE_SERVICES: Record<ServiceType, { recuperable: boolean; ratio: number }> = {
  eau: { recuperable: true, ratio: 1.0 },
  eau_chaude: { recuperable: true, ratio: 1.0 },
  chauffage: { recuperable: true, ratio: 1.0 },
  climatisation: { recuperable: true, ratio: 1.0 },
  electricite_commune: { recuperable: true, ratio: 1.0 },
  gaz_commun: { recuperable: true, ratio: 1.0 },
  ascenseur: { recuperable: true, ratio: 1.0 },
  interphone: { recuperable: true, ratio: 1.0 },
  digicode: { recuperable: true, ratio: 1.0 },
  videosurveillance: { recuperable: true, ratio: 1.0 },
  menage: { recuperable: true, ratio: 1.0 },
  gardiennage: { recuperable: true, ratio: 0.75 },
  jardinage: { recuperable: true, ratio: 1.0 },
  piscine: { recuperable: true, ratio: 1.0 },
  ordures_menageres: { recuperable: true, ratio: 1.0 },
  tout_a_legout: { recuperable: true, ratio: 1.0 },
  assurance_immeuble: { recuperable: false, ratio: 0 },
  assurance_rc: { recuperable: false, ratio: 0 },
  honoraires_syndic: { recuperable: false, ratio: 0 },
  frais_bancaires: { recuperable: false, ratio: 0 },
  frais_juridiques: { recuperable: false, ratio: 0 },
  entretien_equipements: { recuperable: true, ratio: 0.5 },
  contrat_maintenance: { recuperable: true, ratio: 1.0 },
  travaux_courants: { recuperable: true, ratio: 0.5 },
  travaux_exceptionnels: { recuperable: false, ratio: 0 },
  ravalement: { recuperable: false, ratio: 0 },
  impots_taxes: { recuperable: false, ratio: 0 },
  taxe_fonciere: { recuperable: false, ratio: 0 },
  autre: { recuperable: false, ratio: 0 },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function getQuarterLabel(date: Date): string {
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  const year = date.getFullYear();
  return `${quarter}${quarter === 1 ? 'er' : 'ème'} trimestre ${year}`;
}

export function getFiscalYearLabel(fiscalYear: number, startMonth: number = 1): string {
  if (startMonth === 1) {
    return `Exercice ${fiscalYear}`;
  }
  return `Exercice ${fiscalYear}/${fiscalYear + 1}`;
}

