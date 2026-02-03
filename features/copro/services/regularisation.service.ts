// =====================================================
// Service: Régularisation Charges Locatives
// Bridge COPRO → LOCATIF
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  TenantChargeBase,
  TenantChargeRegularisation,
  RegularisationDetailed,
  TenantChargesSummary,
  LocativeChargeRule,
} from '@/lib/types/copro-locatif';

// =====================================================
// RÈGLES DE RÉCUPÉRATION
// =====================================================

export async function getChargeRules(siteId?: string): Promise<LocativeChargeRule[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('locative_charge_rules')
    .select('*')
    .order('service_type');
  
  if (siteId) {
    query = query.or(`site_id.is.null,site_id.eq.${siteId}`);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as LocativeChargeRule[];
}

export async function updateChargeRule(
  id: string,
  data: Partial<LocativeChargeRule>
): Promise<LocativeChargeRule> {
  const supabase = createClient();
  
  const { data: rule, error } = await supabase
    .from('locative_charge_rules')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return rule as unknown as LocativeChargeRule;
}

// =====================================================
// CHARGES LOCATIVES DE BASE
// =====================================================

export async function getTenantCharges(
  leaseId: string,
  fiscalYear?: number
): Promise<TenantChargeBase[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('tenant_charges_base')
    .select(`
      *,
      service:copro_services(label, service_type)
    `)
    .eq('lease_id', leaseId)
    .order('period_start', { ascending: false });
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as TenantChargeBase[];
}

export async function getTenantChargesSummary(
  leaseId: string
): Promise<TenantChargesSummary[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_tenant_charges_summary')
    .select('*')
    .eq('lease_id', leaseId)
    .order('fiscal_year', { ascending: false });
  
  if (error) throw error;
  return (data || []) as unknown as TenantChargesSummary[];
}

// =====================================================
// TRANSFORMATION COPRO → LOCATIF
// =====================================================

export async function transformCoproCharges(
  unitId: string,
  fiscalYear: number
): Promise<number> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('transform_copro_to_tenant_charges', {
      p_unit_id: unitId,
      p_fiscal_year: fiscalYear,
    });
  
  if (error) throw error;
  return data as unknown as number;
}

// =====================================================
// RÉGULARISATIONS
// =====================================================

export async function getRegularisations(
  leaseId?: string,
  unitId?: string
): Promise<RegularisationDetailed[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('v_regularisations_detailed')
    .select('*')
    .order('fiscal_year', { ascending: false });
  
  if (leaseId) {
    query = query.eq('lease_id', leaseId);
  }
  
  if (unitId) {
    query = query.eq('unit_id', unitId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as RegularisationDetailed[];
}

export async function getRegularisationById(
  id: string
): Promise<RegularisationDetailed | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_regularisations_detailed')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as unknown as RegularisationDetailed;
}

export async function calculateRegularisation(
  leaseId: string,
  fiscalYear: number
): Promise<string> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('calculate_lease_regularisation', {
      p_lease_id: leaseId,
      p_fiscal_year: fiscalYear,
    });
  
  if (error) throw error;
  return data as unknown as string;
}

export async function validateRegularisation(
  id: string,
  notes?: string
): Promise<TenantChargeRegularisation> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('tenant_charge_regularisations')
    .update({
      status: 'validated',
      validated_at: new Date().toISOString(),
      validated_by: user?.id,
      notes: notes || null,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as TenantChargeRegularisation;
}

export async function sendRegularisation(
  id: string,
  options: { sendEmail?: boolean; sendPostal?: boolean } = {}
): Promise<TenantChargeRegularisation> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tenant_charge_regularisations')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // TODO: Envoyer email/postal
  if (options.sendEmail) {
    // await sendRegularisationEmail(data);
  }

  return data as unknown as TenantChargeRegularisation;
}

export async function markRegularisationPaid(
  id: string,
  paymentData: {
    payment_date: string;
    payment_method?: string;
    payment_reference?: string;
  }
): Promise<TenantChargeRegularisation> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tenant_charge_regularisations')
    .update({
      status: 'paid',
      ...paymentData,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as TenantChargeRegularisation;
}

export async function disputeRegularisation(
  id: string,
  tenantNotes: string
): Promise<TenantChargeRegularisation> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('tenant_charge_regularisations')
    .update({
      status: 'disputed',
      tenant_notes: tenantNotes,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as TenantChargeRegularisation;
}

// =====================================================
// RÉCUPÉRATION DES BAUX LIÉS À UN LOT COPRO
// =====================================================

export async function getLeasesForCoproUnit(
  unitId: string
): Promise<Array<{
  id: string;
  tenant_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  property_id: string;
}>> {
  const supabase = createClient();
  
  // Récupérer le lot copro pour avoir la propriété liée
  const { data: unit, error: unitError } = await supabase
    .from('copro_units')
    .select('linked_property_id')
    .eq('id', unitId)
    .single();
  
  if (unitError) throw unitError;
  if (!(unit as any)?.linked_property_id) return [];
  
  // Récupérer les baux
  const { data: leases, error: leasesError } = await supabase
    .from('leases')
    .select(`
      id,
      start_date,
      end_date,
      status,
      property_id,
      tenant:profiles!leases_tenant_id_fkey(first_name, last_name)
    `)
    .eq('property_id', (unit as any).linked_property_id)
    .in('status', ['active', 'terminated'])
    .order('start_date', { ascending: false });
  
  if (leasesError) throw leasesError;
  
  return (leases || []).map((lease: any) => ({
    id: lease.id,
    tenant_name: lease.tenant 
      ? `${lease.tenant.first_name} ${lease.tenant.last_name}`
      : 'Locataire inconnu',
    start_date: lease.start_date,
    end_date: lease.end_date,
    status: lease.status,
    property_id: lease.property_id,
  }));
}

// =====================================================
// STATISTIQUES
// =====================================================

export interface RegularisationStats {
  total_regularisations: number;
  pending_validation: number;
  sent: number;
  paid: number;
  disputed: number;
  total_amount_due: number;
  total_amount_refund: number;
}

export async function getRegularisationStats(
  fiscalYear?: number
): Promise<RegularisationStats> {
  const supabase = createClient();
  
  let query = supabase
    .from('tenant_charge_regularisations')
    .select('status, regularisation_amount, regularisation_type');
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  const regularisations = (data || []) as any[];
  
  return {
    total_regularisations: regularisations.length,
    pending_validation: regularisations.filter(r => r.status === 'draft').length,
    sent: regularisations.filter(r => r.status === 'sent').length,
    paid: regularisations.filter(r => r.status === 'paid').length,
    disputed: regularisations.filter(r => r.status === 'disputed').length,
    total_amount_due: regularisations
      .filter(r => r.regularisation_type === 'due_by_tenant')
      .reduce((sum, r) => sum + r.regularisation_amount, 0),
    total_amount_refund: regularisations
      .filter(r => r.regularisation_type === 'refund_to_tenant')
      .reduce((sum, r) => sum + Math.abs(r.regularisation_amount), 0),
  };
}

// =====================================================
// EXPORT
// =====================================================

export const regularisationService = {
  // Rules
  getChargeRules,
  updateChargeRule,
  
  // Tenant Charges
  getTenantCharges,
  getTenantChargesSummary,
  transformCoproCharges,
  
  // Regularisations
  getRegularisations,
  getRegularisationById,
  calculateRegularisation,
  validateRegularisation,
  sendRegularisation,
  markRegularisationPaid,
  disputeRegularisation,
  
  // Leases
  getLeasesForCoproUnit,
  
  // Stats
  getRegularisationStats,
};

export default regularisationService;

