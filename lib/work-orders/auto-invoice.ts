/**
 * Auto-génère une facture prestataire (`provider_invoices`) à partir du
 * `provider_quote` accepté lié à un work_order, dès que le proprio a payé
 * l'intégralité (statut `fully_paid`).
 *
 * Garanties :
 *   - Idempotent : si le quote a déjà été converti (`converted_invoice_id`
 *     non null), aucune nouvelle facture n'est créée.
 *   - Numérotation séquentielle légale via le trigger DB
 *     `trigger_generate_invoice_number()` (FAC-AAAA-XXXXXX par presta).
 *   - Totaux recalculés automatiquement par le trigger
 *     `trigger_recalculate_invoice_totals()` après insertion des lignes.
 *   - Fire-and-forget : un échec ne doit pas bloquer le webhook de paiement.
 *
 * Le PDF n'est PAS stocké pour l'instant — il est régénéré à la volée via
 * `GET /api/work-orders/[id]/invoice-pdf`. Un sprint ultérieur pourra
 * pousser le PDF dans Supabase Storage et figer `pdf_storage_path`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface QuoteRow {
  id: string;
  provider_profile_id: string;
  owner_profile_id: string | null;
  property_id: string | null;
  title: string;
  description: string | null;
  terms_and_conditions: string | null;
  converted_invoice_id: string | null;
  tax_rate: number | string | null;
  total_amount: number | string | null;
}

interface QuoteItemRow {
  description: string;
  quantity: number | string;
  unit: string | null;
  unit_price: number | string;
  tax_rate: number | string;
  sort_order: number | null;
}

export interface AutoInvoiceResult {
  invoice_id: string;
  invoice_number: string;
  reused: boolean;
}

/**
 * Tente de créer la facture pour un work_order. Retourne null si pas de
 * quote accepté lié, ou un résultat avec `reused=true` si la facture
 * existait déjà.
 */
export async function createInvoiceFromWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string,
): Promise<AutoInvoiceResult | null> {
  // 1. Récupérer le work_order et son devis accepté
  const { data: woRaw } = await supabase
    .from('work_orders')
    .select('id, accepted_quote_id')
    .eq('id', workOrderId)
    .maybeSingle();

  const wo = woRaw as { id: string; accepted_quote_id: string | null } | null;
  if (!wo?.accepted_quote_id) return null;

  // 2. Lire le quote + idempotence
  const { data: quoteRaw } = await supabase
    .from('provider_quotes')
    .select(
      'id, provider_profile_id, owner_profile_id, property_id, title, description, terms_and_conditions, converted_invoice_id, tax_rate, total_amount',
    )
    .eq('id', wo.accepted_quote_id)
    .maybeSingle();

  const quote = quoteRaw as QuoteRow | null;
  if (!quote) return null;

  if (quote.converted_invoice_id) {
    const { data: existing } = await supabase
      .from('provider_invoices')
      .select('id, invoice_number')
      .eq('id', quote.converted_invoice_id)
      .maybeSingle();
    const existingRow = existing as { id: string; invoice_number: string } | null;
    if (existingRow) {
      return {
        invoice_id: existingRow.id,
        invoice_number: existingRow.invoice_number,
        reused: true,
      };
    }
  }

  // 3. Lire les lignes du devis
  const { data: itemsRaw } = await supabase
    .from('provider_quote_items')
    .select('description, quantity, unit, unit_price, tax_rate, sort_order')
    .eq('quote_id', quote.id)
    .order('sort_order', { ascending: true });

  const items = (itemsRaw ?? []) as QuoteItemRow[];
  if (items.length === 0) return null;

  // 4. Créer la facture (le trigger DB pose invoice_number et calculera
  //    les totaux après insertion des lignes).
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const { data: insertedInvoice, error: invoiceError } = await supabase
    .from('provider_invoices')
    .insert({
      provider_profile_id: quote.provider_profile_id,
      owner_profile_id: quote.owner_profile_id,
      property_id: quote.property_id,
      work_order_id: workOrderId,
      document_type: 'invoice',
      title: quote.title,
      description: quote.description,
      invoice_date: today,
      due_date: dueDate.toISOString().slice(0, 10),
      payment_terms_days: 30,
      tax_rate: 20,
      late_payment_rate: 10,
      fixed_recovery_fee: 40,
      status: 'sent',
      sent_at: new Date().toISOString(),
      custom_legal_mentions: quote.terms_and_conditions,
      metadata: {
        source: 'auto_from_quote',
        source_quote_id: quote.id,
      },
    } as never)
    .select('id, invoice_number')
    .single();

  if (invoiceError || !insertedInvoice) throw invoiceError;
  const invoice = insertedInvoice as { id: string; invoice_number: string };

  // 5. Insérer les lignes (le trigger recalcule automatiquement les totaux).
  const itemsRows = items.map((it, idx) => ({
    invoice_id: invoice.id,
    description: it.description,
    quantity: Number(it.quantity),
    unit: it.unit ?? 'unité',
    unit_price: Number(it.unit_price),
    tax_rate: Number(it.tax_rate ?? 20),
    sort_order: it.sort_order ?? idx,
  }));

  const { error: itemsError } = await supabase
    .from('provider_invoice_items')
    .insert(itemsRows as never);

  if (itemsError) {
    // Rollback : la facture sans lignes est inutilisable.
    await supabase.from('provider_invoices').delete().eq('id', invoice.id);
    throw itemsError;
  }

  // 6. Marquer le devis comme converti.
  await supabase
    .from('provider_quotes')
    .update({
      status: 'converted',
      converted_invoice_id: invoice.id,
    } as never)
    .eq('id', quote.id);

  // 7. Écritures comptables auto :
  //    - supplier_invoice : ventile HT (615100) + TVA déductible (445660) /
  //      contrepartie 401000 fournisseurs.
  //    - supplier_payment : 401000 / 512100 (banque) puisque le proprio
  //      vient d'encaisser le solde — la facture est née payée.
  //    Idempotent via work_orders.accounting_entry_id.
  await postAccountingEntries(supabase, {
    workOrderId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    quote,
  });

  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    reused: false,
  };
}

interface PostAccountingParams {
  workOrderId: string;
  invoiceId: string;
  invoiceNumber: string;
  quote: QuoteRow;
}

async function postAccountingEntries(
  supabase: SupabaseClient,
  params: PostAccountingParams,
): Promise<void> {
  try {
    // Idempotence : si l'écriture a déjà été posée pour ce WO, on ne
    // recommence pas (un retry de webhook ne doit pas dupliquer la compta).
    const { data: woRow } = await supabase
      .from('work_orders')
      .select('id, property_id, entity_id, accounting_entry_id, title')
      .eq('id', params.workOrderId)
      .maybeSingle();
    const wo = woRow as {
      id: string;
      property_id: string | null;
      entity_id: string | null;
      accounting_entry_id: string | null;
      title: string | null;
    } | null;
    if (!wo) return;
    if (wo.accounting_entry_id) return;

    // Résoudre l'entity comptable.
    let entityId: string | null = wo.entity_id;
    if (!entityId && wo.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('legal_entity_id')
        .eq('id', wo.property_id)
        .maybeSingle();
      entityId = (prop as { legal_entity_id: string | null } | null)?.legal_entity_id ?? null;
    }
    if (!entityId) {
      console.warn('[auto-invoice] No entity_id resolvable for', params.workOrderId);
      return;
    }

    // Vérifier que la compta est activée pour cette entité.
    const { getEntityAccountingConfig, shouldMarkInformational, markEntryInformational } =
      await import('@/lib/accounting/entity-config');
    const config = await getEntityAccountingConfig(supabase, entityId);
    if (!config || !config.accountingEnabled) return;

    const { getOrCreateCurrentExercise } = await import('@/lib/accounting/auto-exercise');
    const exercise = await getOrCreateCurrentExercise(supabase, entityId);
    if (!exercise) return;

    const { resolveSystemActorForEntity } = await import('@/lib/accounting/system-actor');
    const userId = await resolveSystemActorForEntity(supabase, entityId);
    if (!userId) return;

    const { createAutoEntry } = await import('@/lib/accounting/engine');

    const totalCents = Math.round(Number(params.quote.total_amount ?? 0) * 100);
    if (totalCents <= 0) return;

    // tax_rate du quote = % moyen pondéré (ex 20 pour 20%).
    const taxRatePct = Number(params.quote.tax_rate ?? 0);
    const vatRateBps = Math.round(taxRatePct * 100); // 20 → 2000 bps

    const today = new Date().toISOString().slice(0, 10);
    const baseLabel = wo.title || params.quote.title || 'Intervention';
    const reference = params.invoiceNumber;

    // 7a. Facture fournisseur (achat — ACH)
    const invoiceEntry = await createAutoEntry(supabase, 'supplier_invoice', {
      entityId,
      exerciseId: exercise.id,
      userId,
      amountCents: totalCents,
      vatRateBps,
      label: `Facture ${reference} — ${baseLabel}`,
      date: today,
      reference,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, invoiceEntry.id);
    }

    // 7b. Paiement fournisseur (banque — BQ)
    const paymentEntry = await createAutoEntry(supabase, 'supplier_payment', {
      entityId,
      exerciseId: exercise.id,
      userId,
      amountCents: totalCents,
      label: `Paiement Stripe ${reference} — ${baseLabel}`,
      date: today,
      reference,
    });

    if (shouldMarkInformational(config)) {
      await markEntryInformational(supabase, paymentEntry.id);
    }

    // 8. Persister les liens : work_orders.accounting_entry_id + métadonnées
    //    facture + statut payée. Le journal/grand livre/balance pourront
    //    ainsi remonter l'écriture avec sa pièce justificative.
    await supabase
      .from('work_orders')
      .update({ accounting_entry_id: invoiceEntry.id } as never)
      .eq('id', params.workOrderId);

    await supabase
      .from('provider_invoices')
      .update({
        status: 'paid',
        paid_date: today,
        metadata: {
          source: 'auto_from_quote',
          source_quote_id: params.quote.id,
          accounting_entry_invoice_id: invoiceEntry.id,
          accounting_entry_payment_id: paymentEntry.id,
        },
      } as never)
      .eq('id', params.invoiceId);
  } catch (err) {
    // Fire-and-forget : on log mais on ne bloque pas le webhook.
    console.error('[auto-invoice] postAccountingEntries failed:', err);
  }
}
