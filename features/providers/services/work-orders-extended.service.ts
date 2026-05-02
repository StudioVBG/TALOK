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

/** Provider submits a quote.
 *
 *  Si `input.items` est fourni, un `provider_quote` détaillé est créé
 *  (lignes, mentions légales, PDF généré à la volée) et son id est
 *  posé sur `work_orders.accepted_quote_id` à titre provisoire — il
 *  sera promu en `status='accepted'` lors de approveQuote(). Sans
 *  items[], on retombe sur le flux historique avec juste un montant
 *  total dans `quote_amount_cents`.
 */
export async function submitQuote(
  supabase: SupabaseClient,
  workOrderId: string,
  input: SubmitQuoteInput
) {
  const wo = await getWorkOrder(supabase, workOrderId);
  assertTransition(wo.status, 'quote_received');

  let providerQuoteId: string | null = null;

  if (input.items && input.items.length > 0 && wo.provider_id) {
    // Résoudre l'owner_profile_id via la propriété
    let ownerProfileId: string | null = null;
    if (wo.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('owner_id')
        .eq('id', wo.property_id)
        .maybeSingle();
      ownerProfileId = (prop as { owner_id: string } | null)?.owner_id ?? null;
    }

    const subtotal = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unit_price,
      0
    );
    const taxAmount = input.items.reduce(
      (sum, it) => sum + it.quantity * it.unit_price * (it.tax_rate ?? 20) / 100,
      0
    );
    const total = subtotal + taxAmount;
    // Tax rate moyen pondéré pour la colonne tax_rate du quote
    const avgTaxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 20;

    const { data: providerProfile } = await supabase
      .from('providers')
      .select('id')
      .eq('profile_id', wo.provider_id)
      .maybeSingle();
    void providerProfile;

    const { data: insertedQuote, error: quoteError } = await supabase
      .from('provider_quotes')
      .insert({
        provider_profile_id: wo.provider_id,
        owner_profile_id: ownerProfileId,
        property_id: wo.property_id ?? null,
        ticket_id: wo.ticket_id ?? null,
        title: input.title || wo.title || 'Devis intervention',
        description: input.description || wo.description || null,
        subtotal,
        tax_rate: Math.round(avgTaxRate * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total_amount: Math.round(total * 100) / 100,
        valid_until: input.valid_until || null,
        terms_and_conditions: input.terms_and_conditions || null,
        status: 'sent',
        sent_at: new Date().toISOString(),
      } as never)
      .select('id')
      .single();

    if (quoteError) throw quoteError;
    providerQuoteId = (insertedQuote as { id: string }).id;

    const itemsRows = input.items.map((item, idx) => ({
      quote_id: providerQuoteId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? 'unité',
      unit_price: item.unit_price,
      tax_rate: item.tax_rate ?? 20,
      sort_order: idx,
    }));

    const { error: itemsError } = await supabase
      .from('provider_quote_items')
      .insert(itemsRows as never);

    if (itemsError) {
      // Rollback : supprimer le quote orphelin
      await supabase.from('provider_quotes').delete().eq('id', providerQuoteId);
      throw itemsError;
    }
  }

  const updates: Record<string, unknown> = {
    status: 'quote_received',
    quote_amount_cents: input.quote_amount_cents,
    quote_document_id: input.quote_document_id ?? null,
    quote_received_at: new Date().toISOString(),
  };
  if (providerQuoteId) {
    updates.accepted_quote_id = providerQuoteId;
  }

  const { data, error } = await supabase
    .from('work_orders')
    .update(updates)
    .eq('id', workOrderId)
    .select(WORK_ORDER_SELECT)
    .single();

  if (error) throw error;

  // Email proprio avec le PDF du devis en pièce jointe (fire-and-forget).
  // Idempotent côté Resend via la clé `quote-received/<quoteId>`.
  if (providerQuoteId) {
    void (async () => {
      try {
        const { sendQuotePdfEmailToOwner } = await import(
          '@/lib/work-orders/quote-email'
        );
        await sendQuotePdfEmailToOwner(supabase, providerQuoteId);
      } catch (err) {
        console.error('[submitQuote] sendQuotePdfEmailToOwner failed:', err);
      }
    })();
  }

  return data as WorkOrderExtended;
}

/** Owner approves the quote.
 *  Si un provider_quote détaillé est lié (accepted_quote_id), il est
 *  promu de 'sent' à 'accepted' pour figer le contrat — c'est ce
 *  document qui servira de base à la facture auto-générée après
 *  paiement intégral.
 */
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

  const acceptedQuoteId = (data as WorkOrderExtended & { accepted_quote_id?: string | null })
    .accepted_quote_id;
  if (acceptedQuoteId) {
    await supabase
      .from('provider_quotes')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      } as never)
      .eq('id', acceptedQuoteId);
  }

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

  // Escrow : libère automatiquement l'acompte vers le compte Connect du
  // prestataire au démarrage des travaux. Fire-and-forget — un échec
  // (compte Connect KO, charge_id manquant…) ne doit pas bloquer la
  // transition de statut.
  void releaseDepositOnStart(supabase, workOrderId);

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

  // Escrow : à la complétion, on pose la dispute_deadline = now + 7j sur
  // tous les paiements 'balance'/'full' encore en escrow_status='held'.
  // Le cron /api/cron/release-escrow libérera ces fonds après la deadline
  // si le proprio ne valide pas explicitement avant.
  void setDisputeDeadlineOnComplete(supabase, workOrderId);

  return data as WorkOrderExtended;
}

/**
 * Libère l'acompte (escrow) vers le compte Connect du prestataire au
 * démarrage de l'intervention. Fire-and-forget : log mais ne throw pas.
 */
async function releaseDepositOnStart(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<void> {
  try {
    const { findHeldPayments, releaseEscrowToProvider } = await import(
      '@/lib/work-orders/release-escrow'
    );
    const heldDeposits = await findHeldPayments(supabase, workOrderId, 'deposit');
    for (const payment of heldDeposits) {
      try {
        await releaseEscrowToProvider(supabase, {
          paymentId: payment.id,
          reason: 'deposit_release_on_start',
        });
      } catch (err) {
        console.error(
          `[startIntervention] Escrow deposit release failed for payment ${payment.id}:`,
          err
        );
      }
    }
  } catch (err) {
    console.error('[startIntervention] releaseDepositOnStart fatal:', err);
  }
}

/**
 * Pose dispute_deadline = NOW() + 7 jours sur les paiements balance/full
 * en escrow held. Idempotent : si déjà posée, ne touche pas.
 */
async function setDisputeDeadlineOnComplete(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<void> {
  try {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    await (supabase as SupabaseClient)
      .from('work_order_payments')
      .update({ dispute_deadline: deadline.toISOString() })
      .eq('work_order_id', workOrderId)
      .eq('escrow_status', 'held')
      .in('payment_type', ['balance', 'full'])
      .is('dispute_deadline', null);
  } catch (err) {
    console.error('[completeIntervention] setDisputeDeadlineOnComplete failed:', err);
  }
}

/**
 * Resolve the legal_entity_id for a work order.
 * Prefer wo.entity_id, fall back to wo.property.legal_entity_id.
 */
async function resolveWorkOrderEntityId(
  supabase: SupabaseClient,
  wo: WorkOrderExtended,
): Promise<string | null> {
  if (wo.entity_id) return wo.entity_id;
  if (!wo.property_id) return null;
  const { data } = await supabase
    .from('properties')
    .select('legal_entity_id')
    .eq('id', wo.property_id)
    .maybeSingle();
  return (data as { legal_entity_id?: string } | null)?.legal_entity_id ?? null;
}

/**
 * Post an auto-entry for a work order (supplier_invoice or supplier_payment).
 * Fire-and-forget: logs errors but never throws. Best effort.
 * Updates work_orders.accounting_entry_id on success (supplier_invoice only).
 */
async function postWorkOrderAutoEntry(
  supabase: SupabaseClient,
  params: {
    workOrder: WorkOrderExtended;
    event: 'supplier_invoice' | 'supplier_payment';
    amountCents: number;
    date: string;
    label: string;
    reference?: string;
    persistEntryIdOnWorkOrder?: boolean;
  },
): Promise<void> {
  try {
    const entityId = await resolveWorkOrderEntityId(supabase, params.workOrder);
    if (!entityId) {
      console.warn(
        '[work-orders] Skipping auto-entry: no entity_id resolvable for work order',
        params.workOrder.id,
      );
      return;
    }

    const { createAutoEntry } = await import('@/lib/accounting/engine');
    const { getOrCreateCurrentExercise } = await import('@/lib/accounting/auto-exercise');
    const { getEntityAccountingConfig, shouldMarkInformational, markEntryInformational } =
      await import('@/lib/accounting/entity-config');
    const { resolveSystemActorForEntity } = await import('@/lib/accounting/system-actor');

    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) {
      console.log(
        '[work-orders] Skipping auto-entry: accounting not enabled for entity',
        entityId,
      );
      return;
    }

    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) {
      console.warn('[work-orders] Skipping auto-entry: no exercise for entity', entityId);
      return;
    }

    // accounting_entries.created_by is UUID NOT NULL REFERENCES auth.users(id).
    // work_orders.owner_id is a profiles.id, not an auth.users.id, so we always
    // resolve the entity owner's auth user id to avoid both UUID-syntax errors
    // and FK violations.
    const actorUserId = await resolveSystemActorForEntity(supabase, entityId);
    if (!actorUserId) {
      console.warn('[work-orders] Skipping auto-entry: no actor resolvable for entity', entityId);
      return;
    }

    const entry = await createAutoEntry(supabase, params.event, {
      entityId,
      exerciseId: exercise.id,
      userId: actorUserId,
      amountCents: params.amountCents,
      label: params.label,
      date: params.date,
      reference: params.reference,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, entry.id);
    }

    if (params.persistEntryIdOnWorkOrder && entry?.id) {
      await supabase
        .from('work_orders')
        .update({ accounting_entry_id: entry.id })
        .eq('id', params.workOrder.id);
    }
  } catch (err) {
    console.error(
      `[work-orders] createAutoEntry(${params.event}) failed (non-blocking):`,
      err instanceof Error ? err.message : err,
    );
    // Never throw — work order status change is already committed
  }
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

  // Accounting auto-entry (fire-and-forget, non-blocking)
  // Debit 615100 (Entretien) / Credit 401000 (Fournisseurs)
  const updatedWo = data as WorkOrderExtended;
  void postWorkOrderAutoEntry(supabase, {
    workOrder: updatedWo,
    event: 'supplier_invoice',
    amountCents: input.invoice_amount_cents,
    date: new Date().toISOString().split('T')[0],
    label: `Facture prestataire - ${updatedWo.title ?? 'Work order'}`,
    reference: workOrderId,
    persistEntryIdOnWorkOrder: true,
  });

  return updatedWo;
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

  // Accounting auto-entry (fire-and-forget, non-blocking)
  // Debit 401000 (Fournisseurs) / Credit 512100 (Banque)
  const updatedWo = data as WorkOrderExtended;
  const paymentAmountCents = updatedWo.invoice_amount_cents ?? 0;
  if (paymentAmountCents > 0) {
    void postWorkOrderAutoEntry(supabase, {
      workOrder: updatedWo,
      event: 'supplier_payment',
      amountCents: paymentAmountCents,
      date: new Date().toISOString().split('T')[0],
      label: `Paiement prestataire - ${updatedWo.title ?? 'Work order'}`,
      reference: workOrderId,
    });
  }

  return updatedWo;
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
