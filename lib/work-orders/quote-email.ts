/**
 * Envoie au propriétaire le PDF du devis fraîchement créé par
 * submitQuote(). Fire-and-forget : un échec n'a aucun impact sur
 * la transition d'état du work_order.
 *
 * Idempotence assurée par Resend via la clé `quote-received/<quoteId>`
 * — Resend dédoublonne sur 24h, ce qui couvre les retries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface QuoteRow {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  total_amount: number | string;
  valid_until: string | null;
  terms_and_conditions: string | null;
  provider_profile_id: string;
  owner_profile_id: string | null;
  property_id: string | null;
}

interface QuoteItemRow {
  description: string;
  quantity: number | string;
  unit: string | null;
  unit_price: number | string;
  tax_rate: number | string;
  sort_order: number | null;
}

export async function sendQuotePdfEmailToOwner(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<void> {
  try {
    const { data: quoteRaw } = await supabase
      .from('provider_quotes')
      .select(
        'id, reference, title, description, total_amount, valid_until, terms_and_conditions, provider_profile_id, owner_profile_id, property_id',
      )
      .eq('id', quoteId)
      .maybeSingle();
    const quote = quoteRaw as QuoteRow | null;
    if (!quote) return;

    if (!quote.owner_profile_id) {
      console.warn('[quote-email] No owner_profile_id, skipping email');
      return;
    }

    // Owner email + name
    const { data: ownerRaw } = await supabase
      .from('profiles')
      .select('id, prenom, nom, user_id')
      .eq('id', quote.owner_profile_id)
      .maybeSingle();
    const owner = ownerRaw as {
      id: string;
      prenom: string | null;
      nom: string | null;
      user_id: string;
    } | null;
    if (!owner) return;

    const { data: ownerAuth } = await (supabase as SupabaseClient).auth.admin.getUserById(
      owner.user_id,
    );
    const ownerEmail = ownerAuth?.user?.email;
    if (!ownerEmail) {
      console.warn('[quote-email] No owner email, skipping');
      return;
    }

    // Provider info
    const { data: providerProfileRaw } = await supabase
      .from('profiles')
      .select('id, prenom, nom, telephone')
      .eq('id', quote.provider_profile_id)
      .maybeSingle();
    const providerProfile = providerProfileRaw as {
      id: string;
      prenom: string | null;
      nom: string | null;
      telephone: string | null;
    } | null;

    const { data: providerEntityRaw } = await supabase
      .from('providers')
      .select('company_name, siret, email, phone, adresse_complete')
      .eq('profile_id', quote.provider_profile_id)
      .maybeSingle();
    const providerEntity = providerEntityRaw as {
      company_name: string | null;
      siret: string | null;
      email: string | null;
      phone: string | null;
      adresse_complete: string | null;
    } | null;

    const providerName =
      providerEntity?.company_name ||
      `${providerProfile?.prenom ?? ''} ${providerProfile?.nom ?? ''}`.trim() ||
      'Prestataire';

    // Property
    let propertyAddress: string | null = null;
    if (quote.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('adresse_complete, code_postal, ville')
        .eq('id', quote.property_id)
        .maybeSingle();
      const propRow = prop as {
        adresse_complete: string | null;
        code_postal: string | null;
        ville: string | null;
      } | null;
      if (propRow?.adresse_complete) {
        propertyAddress = [
          propRow.adresse_complete,
          [propRow.code_postal, propRow.ville].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', ');
      }
    }

    // Items
    const { data: itemsRaw } = await supabase
      .from('provider_quote_items')
      .select('description, quantity, unit, unit_price, tax_rate, sort_order')
      .eq('quote_id', quote.id)
      .order('sort_order', { ascending: true });
    const items = (itemsRaw ?? []) as QuoteItemRow[];

    // Generate PDF
    const { generateQuotePDF } = await import('@/lib/pdf/quote-pdf-generator');
    const pdfBytes = await generateQuotePDF({
      reference: quote.reference,
      title: quote.title,
      description: quote.description,
      documentType: 'quote',
      issueDate: new Date().toISOString(),
      validUntil: quote.valid_until,
      providerName,
      providerSiret: providerEntity?.siret ?? null,
      providerEmail: providerEntity?.email ?? null,
      providerPhone: providerEntity?.phone ?? providerProfile?.telephone ?? null,
      providerAddress: providerEntity?.adresse_complete ?? null,
      clientName: `${owner.prenom ?? ''} ${owner.nom ?? ''}`.trim() || null,
      clientEmail: ownerEmail,
      propertyAddress,
      items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit ?? 'unité',
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate ?? 20),
      })),
      termsAndConditions: quote.terms_and_conditions,
    });

    // Send email avec le PDF en pièce jointe.
    const { sendOwnerQuoteReceivedEmail } = await import('@/lib/emails/resend.service');
    const recipientName =
      `${owner.prenom ?? ''} ${owner.nom ?? ''}`.trim() || 'Propriétaire';

    await sendOwnerQuoteReceivedEmail({
      ownerEmail,
      recipientName,
      quoteReference: quote.reference,
      quoteTitle: quote.title,
      providerName,
      propertyAddress,
      totalAmountEuros: Number(quote.total_amount ?? 0),
      validUntil: quote.valid_until,
      quoteId: quote.id,
      pdfAttachment: Buffer.from(pdfBytes),
    });
  } catch (err) {
    console.error('[quote-email] Failed to send quote PDF email:', err);
  }
}
