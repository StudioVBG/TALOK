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
      'id, provider_profile_id, owner_profile_id, property_id, title, description, terms_and_conditions, converted_invoice_id',
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

  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    reused: false,
  };
}
