// =====================================================
// Types TypeScript pour le Bridge COPRO ↔ LOCATIF
// =====================================================

import type { ServiceType } from './copro-charges';

// =====================================================
// TYPES DE BASE
// =====================================================

export type TenantChargeStatus = 'calculated' | 'validated' | 'invoiced' | 'cancelled';

export type RegularisationType = 'due_by_tenant' | 'refund_to_tenant' | 'balanced';

export type RegularisationStatus =
  | 'draft'      // Brouillon
  | 'validated'  // Validé par propriétaire
  | 'sent'       // Envoyé au locataire
  | 'accepted'   // Accepté par locataire
  | 'disputed'   // Contesté
  | 'paid'       // Réglé
  | 'cancelled'; // Annulé

// =====================================================
// RÈGLES DE RÉCUPÉRATION
// =====================================================

export interface LocativeChargeRule {
  id: string;
  site_id: string | null;
  service_id: string | null;
  service_type: ServiceType | null;
  is_recuperable: boolean;
  recuperable_ratio: number;
  legal_reference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// CHARGES LOCATIVES BASE
// =====================================================

export interface TenantChargeBase {
  id: string;
  lease_id: string;
  unit_id: string;
  charge_copro_id: string | null;
  service_id: string | null;
  period_start: string;
  period_end: string;
  fiscal_year: number;
  label: string;
  service_type: ServiceType | null;
  copro_amount: number;
  recuperable_ratio: number;
  prorata_days: number | null;
  total_period_days: number | null;
  prorata_ratio: number;
  recuperable_amount: number;
  status: TenantChargeStatus;
  validated_at: string | null;
  validated_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// RÉGULARISATIONS
// =====================================================

export interface TenantChargeRegularisation {
  id: string;
  lease_id: string;
  unit_id: string;
  period_start: string;
  period_end: string;
  fiscal_year: number;
  total_charges_recuperables: number;
  total_provisions_versees: number;
  regularisation_amount: number;
  regularisation_type: RegularisationType;
  details_by_service: RegularisationServiceDetail[];
  status: RegularisationStatus;
  calculated_at: string;
  validated_at: string | null;
  validated_by: string | null;
  sent_at: string | null;
  pdf_document_id: string | null;
  detail_document_id: string | null;
  notes: string | null;
  tenant_notes: string | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RegularisationServiceDetail {
  service_type: ServiceType;
  label: string;
  copro_amount: number;
  recuperable_amount: number;
}

// =====================================================
// VUES ENRICHIES
// =====================================================

export interface TenantChargesSummary {
  lease_id: string;
  property_id: string;
  unit_id: string;
  fiscal_year: number;
  charges_count: number;
  total_copro_amount: number;
  total_recuperable_amount: number;
  avg_prorata_ratio: number;
}

export interface RegularisationDetailed extends TenantChargeRegularisation {
  property_id: string;
  property_address: string;
  lot_number: string | null;
  tenant_first_name: string | null;
  tenant_last_name: string | null;
  tenant_email: string | null;
}

// =====================================================
// CALCULS
// =====================================================

export interface LeasePeriodDays {
  lease_start: string;
  lease_end: string;
  period_start: string;
  period_end: string;
  overlap_start: string;
  overlap_end: string;
  overlap_days: number;
  total_period_days: number;
  prorata_ratio: number;
}

export interface RegularisationCalculation {
  lease_id: string;
  fiscal_year: number;
  total_charges_recuperables: number;
  total_provisions_versees: number;
  regularisation_amount: number;
  regularisation_type: RegularisationType;
  details_by_service: RegularisationServiceDetail[];
}

// =====================================================
// FORMULAIRES & INPUT
// =====================================================

export interface CreateChargeRuleInput {
  site_id?: string;
  service_id?: string;
  service_type?: ServiceType;
  is_recuperable: boolean;
  recuperable_ratio?: number;
  legal_reference?: string;
  notes?: string;
}

export interface CalculateRegularisationInput {
  lease_id: string;
  fiscal_year: number;
}

export interface ValidateRegularisationInput {
  id: string;
  notes?: string;
}

export interface SendRegularisationInput {
  id: string;
  send_email?: boolean;
  send_postal?: boolean;
}

// =====================================================
// UI HELPERS
// =====================================================

export const REGULARISATION_STATUS_LABELS: Record<RegularisationStatus, string> = {
  draft: 'Brouillon',
  validated: 'Validé',
  sent: 'Envoyé',
  accepted: 'Accepté',
  disputed: 'Contesté',
  paid: 'Réglé',
  cancelled: 'Annulé',
};

export const REGULARISATION_STATUS_COLORS: Record<RegularisationStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  validated: 'bg-blue-100 text-blue-800',
  sent: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  disputed: 'bg-orange-100 text-orange-800',
  paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const REGULARISATION_TYPE_LABELS: Record<RegularisationType, string> = {
  due_by_tenant: 'Complément dû par le locataire',
  refund_to_tenant: 'Trop-perçu à rembourser',
  balanced: 'Équilibré',
};

export const REGULARISATION_TYPE_COLORS: Record<RegularisationType, string> = {
  due_by_tenant: 'text-red-600',
  refund_to_tenant: 'text-green-600',
  balanced: 'text-gray-600',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function formatRegularisationAmount(amount: number, type: RegularisationType): string {
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Math.abs(amount));

  switch (type) {
    case 'due_by_tenant':
      return `+${formatted} (à payer)`;
    case 'refund_to_tenant':
      return `-${formatted} (à rembourser)`;
    case 'balanced':
      return `${formatted} (équilibré)`;
    default:
      return formatted;
  }
}

export function calculateProrata(
  periodStart: Date,
  periodEnd: Date,
  leaseStart: Date,
  leaseEnd: Date
): number {
  const overlapStart = leaseStart > periodStart ? leaseStart : periodStart;
  const overlapEnd = leaseEnd < periodEnd ? leaseEnd : periodEnd;

  if (overlapStart > overlapEnd) return 0;

  const totalDays = Math.ceil(
    (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const overlapDays = Math.ceil(
    (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return Math.round((overlapDays / totalDays) * 10000) / 10000;
}

export function determineRegularisationType(
  chargesRecuperables: number,
  provisionsVersees: number
): RegularisationType {
  const diff = chargesRecuperables - provisionsVersees;
  if (diff > 0.01) return 'due_by_tenant';
  if (diff < -0.01) return 'refund_to_tenant';
  return 'balanced';
}

export function generateRegularisationPeriodLabel(fiscalYear: number): string {
  return `Régularisation des charges ${fiscalYear}`;
}

export function getRecuperableRatioForService(
  serviceType: ServiceType,
  rules: LocativeChargeRule[],
  siteId?: string
): number {
  // Chercher d'abord une règle spécifique au site
  const siteRule = rules.find(
    r => r.site_id === siteId && r.service_type === serviceType
  );
  if (siteRule) return siteRule.is_recuperable ? siteRule.recuperable_ratio : 0;

  // Sinon, chercher une règle globale
  const globalRule = rules.find(
    r => r.site_id === null && r.service_type === serviceType
  );
  if (globalRule) return globalRule.is_recuperable ? globalRule.recuperable_ratio : 0;

  // Par défaut, non récupérable
  return 0;
}

// =====================================================
// VALIDATION
// =====================================================

export function validateRegularisation(
  regularisation: TenantChargeRegularisation
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (regularisation.total_charges_recuperables < 0) {
    errors.push('Le total des charges récupérables ne peut pas être négatif');
  }

  if (regularisation.total_provisions_versees < 0) {
    errors.push('Le total des provisions ne peut pas être négatif');
  }

  if (regularisation.details_by_service.length === 0) {
    errors.push('Le détail par service est requis');
  }

  // Vérifier que la somme des détails correspond au total
  const sumDetails = regularisation.details_by_service.reduce(
    (sum, d) => sum + d.recuperable_amount,
    0
  );
  if (Math.abs(sumDetails - regularisation.total_charges_recuperables) > 0.01) {
    errors.push('La somme des détails ne correspond pas au total');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =====================================================
// DÉCRET 87-713 - CHARGES RÉCUPÉRABLES
// =====================================================

export const DECRET_87_713_CATEGORIES = {
  ascenseur: {
    title: 'I - Ascenseurs et monte-charges',
    items: [
      'Électricité',
      'Dépenses de combustible',
      'Fourniture de produits ou matériel d\'entretien',
      'Visite périodique',
      'Nettoyage et entretien des cabines',
      'Examen semestriel des câbles',
      'Menues réparations',
    ],
  },
  eau: {
    title: 'II - Eau froide, eau chaude et chauffage collectif',
    items: [
      'Eau froide et chaude des locataires ou occupants',
      'Eau nécessaire à l\'entretien courant des parties communes',
      'Combustible ou fourniture d\'énergie',
      'Fourniture de produits de traitement de l\'eau',
      'Réparation des fuites sur joints',
    ],
  },
  parties_communes: {
    title: 'III - Installations individuelles',
    subtitle: 'Chauffage et eau chaude',
    items: [
      'Contrat d\'entretien annuel',
      'Menues réparations des appareils',
    ],
  },
  entretien: {
    title: 'IV - Parties communes intérieures',
    items: [
      'Électricité',
      'Fournitures consommables',
      'Entretien de la minuterie',
      'Nettoyage et entretien',
      'Réparations des appareils de nettoyage',
    ],
  },
  espaces_verts: {
    title: 'V - Espaces extérieurs',
    items: [
      'Entretien des voies de circulation',
      'Entretien des aires de stationnement',
      'Entretien des espaces verts',
      'Entretien des aires et équipements de jeux',
      'Éclairage',
    ],
  },
  taxes: {
    title: 'VI - Taxes et redevances',
    items: [
      'Taxe d\'enlèvement des ordures ménagères',
      'Taxe de balayage',
    ],
  },
  autres: {
    title: 'VII - Autres charges',
    items: [
      'Ramonage des conduits de fumée',
      'Entretien des bouches d\'incendie',
      'Gardiennage (75%)',
    ],
  },
};

