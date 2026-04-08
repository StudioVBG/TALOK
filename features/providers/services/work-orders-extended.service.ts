/**
 * Work Orders Extended Service — SOTA 2026
 * Full state machine: draft→quote→intervention→facture→paiement
 * Coexists with legacy work_orders.service.ts for backward compat.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkOrderExtended, WorkOrderStatus } from '@/lib/types/providers';
import { WORK_ORDER_TRANSITIONS } from '@/lib/types/providers';
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  SubmitQuoteInput,
  ScheduleWorkOrderInput,
  CompleteWorkOrderInput,
  SubmitInvoiceInput,
  MarkPaidInput,
  CreateReviewInput,
} from '@/lib/validations/providers';

const WORK_ORDER_SELECT = `
  *,
  provider:providers!work_orders_provider_id_fkey(id, company_name, contact_name, email, phone, trade_categories, avg_rating, is_verified),
  property:properties!work_orders_property_id_fkey(id, adresse_complete, ville, code_postal)
`;

// ============================================
// Helpers
// ============================================

function assertTransition(current: WorkOrderStatus, target: WorkOrderStatus) {
  const allowed = WORK_ORDER_TRANSITIONS[current];
  if (!allowed?.includes(target)) {
    throw new Error(
      `Transition invalide: ${current} → ${target}. Transitions autorisees: ${allowed?.join(', ') || 'aucune'}`
    );
  }
}

// ============================================
// CRUD
// ============================================

/** List work orders for an owner (with filters) */
export async function listWorkOrders(
  supabase: SupabaseClient,
  ownerId: string,
  filters?: {
    status?: WorkOrderStatus;
    property_id?: string;
    provider_id?: string;
    limit?: number;
    offset?: number;
  }
) {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  let query = supabase
    .from('work_orders')
    .select(WORK_ORDER_SELECT, { count: 'exact' })
    .eq('owner_id', ownerId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.property_id) {
    query = query.eq('property_id', filters.property_id);
  }
  if (filters?.provider_id) {
    query = query.eq('provider_id', filters.provider_id);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { workOrders: data ?? [], total: count ?? 0 };
}

/** List work orders for a provider */
export async function listProviderWorkOrders(
  supabase: SupabaseClient,
  providerProfileId: string,
  filters?: { status?: WorkOrderStatus; limit?: number; offset?: number }
) {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  let query = supabase
    .from('work_orders')
    .select(WORK_ORDER_SELECT, { count: 'exact' })
    .eq('provider_id', providerProfileId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { workOrders: data ?? [], total: count ?? 0 };
}

/** List work orders for a tenant (read-only: interventions on their property) */
export async function listTenantWorkOrders(
  supabase: SupabaseClient,
  tenantProfileId: string
) {
  // Find leases where the tenant is a signer
  const { data: signers } = await supabase
    .from('lease_signers')
    .select('lease_id')
    .eq('profile_id', tenantProfileId);

  const leaseIds = (signers ?? []).map((s) => s.lease_id);
  if (leaseIds.length === 0) return { workOrders: [], total: 0 };

  // Find properties from those leases
  const { data: leases } = await supabase
    .from('leases')
    .select('property_id')
    .in('id', leaseIds);

  const propertyIds = [...new Set((leases ?? []).map((l) => l.property_id).filter(Boolean))];
  if (propertyIds.length === 0) return { workOrders: [], total: 0 };

  const { data, error, count } = await supabase
    .from('work_orders')
    .select(
      `
      id, title, description, category, urgency, status,
      scheduled_date, scheduled_time_slot, started_at, completed_at,
      property:properties!work_orders_property_id_fkey(id, adresse_complete, ville)
    `,
      { count: 'exact' }
    )
    .in('property_id', propertyIds)
    .in('status', ['scheduled', 'in_progress', 'completed'])
    .order('scheduled_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return { workOrders: data ?? [], total: count ?? 0 };
}

/** Get a single work order by ID */
export async function getWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<WorkOrderExtended> {
  const { data, error } = await supabase
    .from('work_orders')
    .select(WORK_ORDER_SELECT)
    .eq('id', workOrderId)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Create a new work order */
export async function createWorkOrder(
  supabase: SupabaseClient,
  ownerId: string,
  input: CreateWorkOrderInput
): Promise<WorkOrderExtended> {
  const { data, error } = await supabase
    .from('work_orders')
    .insert({
      ...input,
      owner_id: ownerId,
      status: 'draft',
      statut: 'assigned', // legacy compat
      requested_at: new Date().toISOString(),
    })
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;

  // If created from a ticket, update ticket status
  if (input.ticket_id) {
    await supabase
      .from('tickets')
      .update({ statut: 'in_progress' })
      .eq('id', input.ticket_id);
  }

  return data as WorkOrderExtended;
}

/** Update work order metadata (non-status fields) */
export async function updateWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string,
  input: UpdateWorkOrderInput
): Promise<WorkOrderExtended> {
  const { data, error } = await supabase
    .from('work_orders')
    .update(input)
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

// ============================================
// State Machine Transitions
// ============================================

/** Request a quote from a provider */
export async function requestQuote(
  supabase: SupabaseClient,
  workOrderId: string,
  providerId?: string
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'quote_requested');

  const updates: Record<string, unknown> = {
    status: 'quote_requested',
    requested_at: new Date().toISOString(),
  };

  if (providerId) {
    updates.provider_id = providerId;
  }

  const { data, error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Provider submits a quote */
export async function submitQuote(
  supabase: SupabaseClient,
  workOrderId: string,
  input: SubmitQuoteInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'quote_received');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'quote_received',
      quote_amount_cents: input.quote_amount_cents,
      quote_document_id: input.quote_document_id ?? null,
      quote_received_at: new Date().toISOString(),
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Owner approves the quote */
export async function approveQuote(
  supabase: SupabaseClient,
  workOrderId: string
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'quote_approved');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'quote_approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Owner rejects the quote */
export async function rejectQuote(
  supabase: SupabaseClient,
  workOrderId: string
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'quote_rejected');

  const { data, error } = await supabase
    .from('work_orders')
    .update({ status: 'quote_rejected' })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Schedule the intervention */
export async function scheduleIntervention(
  supabase: SupabaseClient,
  workOrderId: string,
  input: ScheduleWorkOrderInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'scheduled');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'scheduled',
      statut: 'scheduled', // legacy compat
      scheduled_date: input.scheduled_date,
      scheduled_time_slot: input.scheduled_time_slot ?? null,
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Start the intervention */
export async function startIntervention(
  supabase: SupabaseClient,
  workOrderId: string
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'in_progress');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'in_progress',
      statut: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Complete the intervention with a report */
export async function completeIntervention(
  supabase: SupabaseClient,
  workOrderId: string,
  input: CompleteWorkOrderInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'completed');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'completed',
      statut: 'done', // legacy compat
      completed_at: new Date().toISOString(),
      intervention_report: input.intervention_report,
      intervention_photos: input.intervention_photos,
      tenant_signature_url: input.tenant_signature_url ?? null,
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Provider submits an invoice */
export async function submitInvoice(
  supabase: SupabaseClient,
  workOrderId: string,
  input: SubmitInvoiceInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'invoiced');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'invoiced',
      invoice_amount_cents: input.invoice_amount_cents,
      invoice_document_id: input.invoice_document_id ?? null,
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Owner marks the work order as paid */
export async function markAsPaid(
  supabase: SupabaseClient,
  workOrderId: string,
  input: MarkPaidInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'paid');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'paid',
      payment_method: input.payment_method,
      paid_at: new Date().toISOString(),
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

/** Cancel a work order */
export async function cancelWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'cancelled');

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'cancelled',
      statut: 'cancelled',
    })
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;
  return data as WorkOrderExtended;
}

// ============================================
// Reviews (post-payment)
// ============================================

/** Owner leaves a review after payment */
export async function createReview(
  supabase: SupabaseClient,
  reviewerId: string,
  input: CreateReviewInput
) {
  const { data, error } = await supabase
    .from('provider_reviews')
    .insert({
      provider_profile_id: input.provider_profile_id,
      reviewer_profile_id: reviewerId,
      work_order_id: input.work_order_id,
      rating_overall: input.rating_overall,
      rating_punctuality: input.rating_punctuality ?? null,
      rating_quality: input.rating_quality ?? null,
      rating_communication: input.rating_communication ?? null,
      rating_value: input.rating_value ?? null,
      title: input.title ?? null,
      comment: input.comment ?? null,
      would_recommend: input.would_recommend ?? true,
      is_published: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
