// =====================================================
// Service: Charges COPRO
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  CoproService,
  ServiceContract,
  ServiceExpense,
  ChargeCopro,
  CallForFunds,
  CallForFundsItem,
  CoproPayment,
  CreateServiceInput,
  CreateContractInput,
  CreateExpenseInput,
  CreateCallForFundsInput,
  CreatePaymentInput,
  AllocationPreview,
  AllocationPreviewItem,
  UnitBalance,
  ChargesSummary,
} from '@/lib/types/copro-charges';

// =====================================================
// SERVICES
// =====================================================

export async function getServicesBySite(siteId: string): Promise<CoproService[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_services')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .order('display_order');
  
  if (error) throw error;
  return (data as CoproService[]) || [];
}

export async function createService(input: CreateServiceInput): Promise<CoproService> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_services')
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  return data as CoproService;
}

export async function updateService(
  id: string, 
  data: Partial<CreateServiceInput>
): Promise<CoproService> {
  const supabase = createClient();
  
  const { data: service, error } = await supabase
    .from('copro_services')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return service as CoproService;
}

export async function deleteService(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('copro_services')
    .update({ is_active: false })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// CONTRACTS
// =====================================================

export async function getContractsBySite(siteId: string): Promise<ServiceContract[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('service_contracts')
    .select('*')
    .eq('site_id', siteId)
    .in('status', ['active', 'suspended'])
    .order('start_date', { ascending: false });
  
  if (error) throw error;
  return (data as ServiceContract[]) || [];
}

export async function createContract(input: CreateContractInput): Promise<ServiceContract> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('service_contracts')
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  return data as ServiceContract;
}

export async function updateContract(
  id: string, 
  data: Partial<CreateContractInput>
): Promise<ServiceContract> {
  const supabase = createClient();
  
  const { data: contract, error } = await supabase
    .from('service_contracts')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return contract as ServiceContract;
}

export async function terminateContract(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('service_contracts')
    .update({ status: 'terminated' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// EXPENSES
// =====================================================

export async function getExpensesBySite(
  siteId: string,
  fiscalYear?: number
): Promise<ServiceExpense[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('service_expenses')
    .select('*')
    .eq('site_id', siteId)
    .order('invoice_date', { ascending: false });
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data as ServiceExpense[]) || [];
}

export async function createExpense(input: CreateExpenseInput): Promise<ServiceExpense> {
  const supabase = createClient();
  
  // Calculer l'année fiscale
  const fiscalYear = new Date(input.period_start).getFullYear();
  
  const { data, error } = await supabase
    .from('service_expenses')
    .insert({
      ...input,
      fiscal_year: fiscalYear,
      amount_tva: input.amount_tva || 0,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as ServiceExpense;
}

export async function updateExpense(
  id: string, 
  data: Partial<CreateExpenseInput>
): Promise<ServiceExpense> {
  const supabase = createClient();
  
  const { data: expense, error } = await supabase
    .from('service_expenses')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return expense as ServiceExpense;
}

export async function validateExpense(id: string): Promise<ServiceExpense> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('service_expenses')
    .update({
      status: 'validated',
      validated_at: new Date().toISOString(),
      validated_by: user?.id,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as ServiceExpense;
}

export async function cancelExpense(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('service_expenses')
    .update({ status: 'cancelled' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// ALLOCATION
// =====================================================

export async function previewAllocation(
  expenseId: string
): Promise<AllocationPreview> {
  const supabase = createClient();
  
  // Récupérer la dépense
  const { data: expense, error: expenseError } = await supabase
    .from('service_expenses')
    .select('*')
    .eq('id', expenseId)
    .single();
  
  if (expenseError) throw expenseError;
  const typedExpense = expense as ServiceExpense;

  // Calculer la répartition
  const { data, error } = await supabase
    .rpc('calculate_expense_allocation', { p_expense_id: expenseId });
  
  if (error) throw error;
  
  const items: AllocationPreviewItem[] = (data as AllocationPreviewItem[]) || [];
  const totalAllocated = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    expense_id: expenseId,
    expense_amount: typedExpense.amount_ttc,
    allocation_mode: typedExpense.allocation_mode,
    items,
    total_allocated: totalAllocated,
    difference: Math.round((typedExpense.amount_ttc - totalAllocated) * 100) / 100,
  };
}

export async function allocateExpense(expenseId: string): Promise<number> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('allocate_expense', { p_expense_id: expenseId });
  
  if (error) throw error;
  return data as number;
}

export async function allocatePeriod(
  siteId: string,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  const supabase = createClient();
  
  // Récupérer toutes les dépenses validées non réparties de la période
  const { data: expenses, error: fetchError } = await supabase
    .from('service_expenses')
    .select('id')
    .eq('site_id', siteId)
    .eq('status', 'validated')
    .eq('is_allocated', false)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd);
  
  if (fetchError) throw fetchError;
  const typedExpenses = (expenses as Array<{ id: string }>) || [];

  let totalAllocated = 0;

  for (const exp of typedExpenses) {
    const count = await allocateExpense(exp.id);
    totalAllocated += count;
  }
  
  return totalAllocated;
}

// =====================================================
// CHARGES RÉPARTIES
// =====================================================

export async function getChargesByUnit(
  unitId: string,
  fiscalYear?: number
): Promise<ChargeCopro[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('charges_copro')
    .select('*')
    .eq('unit_id', unitId)
    .order('period_start', { ascending: false });
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data as ChargeCopro[]) || [];
}

export async function getUnitBalances(siteId: string): Promise<UnitBalance[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('v_unit_balance')
    .select('*')
    .eq('site_id', siteId)
    .order('lot_number');
  
  if (error) throw error;
  return (data as UnitBalance[]) || [];
}

export async function getChargesSummary(
  siteId: string,
  fiscalYear?: number
): Promise<ChargesSummary[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('v_charges_summary')
    .select('*')
    .eq('site_id', siteId);
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data as ChargesSummary[]) || [];
}

// =====================================================
// CALLS FOR FUNDS
// =====================================================

export async function getCallsBySite(
  siteId: string,
  fiscalYear?: number
): Promise<CallForFunds[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('calls_for_funds')
    .select('*')
    .eq('site_id', siteId)
    .order('period_start', { ascending: false });
  
  if (fiscalYear) {
    query = query.eq('fiscal_year', fiscalYear);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data as CallForFunds[]) || [];
}

export async function getCallById(id: string): Promise<CallForFunds | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('calls_for_funds')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return data as CallForFunds;
}

export async function getCallItems(callId: string): Promise<CallForFundsItem[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('call_for_funds_items')
    .select('*')
    .eq('call_id', callId)
    .order('lot_number');
  
  if (error) throw error;
  return (data as CallForFundsItem[]) || [];
}

export async function generateCallForFunds(
  input: CreateCallForFundsInput
): Promise<string> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .rpc('generate_call_for_funds', {
      p_site_id: input.site_id,
      p_call_type: input.call_type,
      p_period_label: input.period_label,
      p_period_start: input.period_start,
      p_period_end: input.period_end,
      p_due_date: input.due_date,
    });
  
  if (error) throw error;
  return data as string;
}

export async function validateCall(id: string): Promise<CallForFunds> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('calls_for_funds')
    .update({ status: 'validated' })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as CallForFunds;
}

export async function sendCall(id: string): Promise<CallForFunds> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('calls_for_funds')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: user?.id,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // Mettre à jour les items
  await supabase
    .from('call_for_funds_items')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('call_id', id);
  
  // TODO: Envoyer les emails

  return data as CallForFunds;
}

export async function cancelCall(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('calls_for_funds')
    .update({ status: 'cancelled' })
    .eq('id', id);
  
  if (error) throw error;
  
  await supabase
    .from('call_for_funds_items')
    .update({ status: 'cancelled' })
    .eq('call_id', id);
}

// =====================================================
// PAYMENTS
// =====================================================

export async function getPaymentsByUnit(
  unitId: string,
  limit?: number
): Promise<CoproPayment[]> {
  const supabase = createClient();
  
  let query = supabase
    .from('copro_payments')
    .select('*')
    .eq('unit_id', unitId)
    .order('payment_date', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return (data as CoproPayment[]) || [];
}

export async function createPayment(input: CreatePaymentInput): Promise<CoproPayment> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('copro_payments')
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  
  // Mettre à jour les montants payés si lié à un appel
  if (input.call_item_id) {
    await supabase.rpc('update_call_item_payment', {
      p_call_item_id: input.call_item_id,
    });
  }
  
  return data as CoproPayment;
}

export async function validatePayment(id: string): Promise<CoproPayment> {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('copro_payments')
    .update({
      status: 'validated',
      validated_at: new Date().toISOString(),
      validated_by: user?.id,
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as CoproPayment;
}

export async function rejectPayment(id: string): Promise<void> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('copro_payments')
    .update({ status: 'rejected' })
    .eq('id', id);
  
  if (error) throw error;
}

// =====================================================
// EXPORT
// =====================================================

export const chargesService = {
  // Services
  getServicesBySite,
  createService,
  updateService,
  deleteService,
  
  // Contracts
  getContractsBySite,
  createContract,
  updateContract,
  terminateContract,
  
  // Expenses
  getExpensesBySite,
  createExpense,
  updateExpense,
  validateExpense,
  cancelExpense,
  
  // Allocation
  previewAllocation,
  allocateExpense,
  allocatePeriod,
  
  // Charges
  getChargesByUnit,
  getUnitBalances,
  getChargesSummary,
  
  // Calls for funds
  getCallsBySite,
  getCallById,
  getCallItems,
  generateCallForFunds,
  validateCall,
  sendCall,
  cancelCall,
  
  // Payments
  getPaymentsByUnit,
  createPayment,
  validatePayment,
  rejectPayment,
};

export default chargesService;

