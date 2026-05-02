export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/provider/invoices/[id]/pdf
 *
 * Renvoie le PDF d'une facture provider_invoices. Sert à la fois :
 *   - le prestataire émetteur (téléchargement depuis /provider/invoices)
 *   - le propriétaire destinataire (téléchargement depuis /owner/work-orders/[id])
 *   - un admin
 *
 * Stratégie :
 *   1. Si `pdf_storage_path` est posé (facture auto-générée et archivée),
 *      on stream le fichier depuis Supabase Storage — version immutable
 *      et identique à celle envoyée par email au moment de l'émission.
 *   2. Sinon, on génère à la volée via generateQuotePDF en mode 'invoice'
 *      sans uploader (factures historiques sans archive figée).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { STORAGE_BUCKETS } from '@/lib/config/storage-buckets';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();
    const profileRow = profile as { id: string; role: string } | null;
    if (!profileRow) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const { data: invoiceRaw } = await supabase
      .from('provider_invoices')
      .select(
        'id, invoice_number, title, description, invoice_date, due_date, total_amount, provider_profile_id, owner_profile_id, property_id, pdf_storage_path',
      )
      .eq('id', id)
      .maybeSingle();
    const invoice = invoiceRaw as
      | {
          id: string;
          invoice_number: string;
          title: string;
          description: string | null;
          invoice_date: string;
          due_date: string | null;
          total_amount: number | string;
          provider_profile_id: string;
          owner_profile_id: string | null;
          property_id: string | null;
          pdf_storage_path: string | null;
        }
      | null;

    if (!invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Contrôle d'accès : presta émetteur, proprio destinataire ou admin.
    const isProvider = invoice.provider_profile_id === profileRow.id;
    const isOwner = invoice.owner_profile_id === profileRow.id;
    const isAdmin = profileRow.role === 'admin';
    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // 1. Cas chemin Storage : version immutable archivée.
    if (invoice.pdf_storage_path) {
      const { data: file, error: dlError } = await supabase.storage
        .from(STORAGE_BUCKETS.DOCUMENTS)
        .download(invoice.pdf_storage_path);
      if (!dlError && file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      console.error(
        '[invoice-pdf] Storage download failed, falling back to regen:',
        dlError,
      );
    }

    // 2. Fallback : régénération à la volée.
    const { data: itemsRaw } = await supabase
      .from('provider_invoice_items')
      .select('description, quantity, unit, unit_price, tax_rate, sort_order')
      .eq('invoice_id', invoice.id)
      .order('sort_order', { ascending: true });
    const items = (itemsRaw ?? []) as Array<{
      description: string;
      quantity: number | string;
      unit: string | null;
      unit_price: number | string;
      tax_rate: number | string;
      sort_order: number | null;
    }>;

    const { data: providerProfileRaw } = await supabase
      .from('profiles')
      .select('prenom, nom, telephone')
      .eq('id', invoice.provider_profile_id)
      .maybeSingle();
    const providerProfile = providerProfileRaw as {
      prenom: string | null;
      nom: string | null;
      telephone: string | null;
    } | null;

    const { data: providerEntityRaw } = await supabase
      .from('providers')
      .select('company_name, siret, email, phone, adresse_complete')
      .eq('profile_id', invoice.provider_profile_id)
      .maybeSingle();
    const providerEntity = providerEntityRaw as {
      company_name: string | null;
      siret: string | null;
      email: string | null;
      phone: string | null;
      adresse_complete: string | null;
    } | null;

    let ownerName: string | null = null;
    let ownerEmail: string | null = null;
    if (invoice.owner_profile_id) {
      const { data: ownerRaw } = await supabase
        .from('profiles')
        .select('prenom, nom, user_id')
        .eq('id', invoice.owner_profile_id)
        .maybeSingle();
      const owner = ownerRaw as {
        prenom: string | null;
        nom: string | null;
        user_id: string;
      } | null;
      if (owner) {
        ownerName = `${owner.prenom ?? ''} ${owner.nom ?? ''}`.trim() || null;
        const { data: ownerAuth } = await supabase.auth.admin.getUserById(owner.user_id);
        ownerEmail = ownerAuth?.user?.email ?? null;
      }
    }

    let propertyAddress: string | null = null;
    if (invoice.property_id) {
      const { data: prop } = await supabase
        .from('properties')
        .select('adresse_complete, code_postal, ville')
        .eq('id', invoice.property_id)
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

    const providerName =
      providerEntity?.company_name ||
      `${providerProfile?.prenom ?? ''} ${providerProfile?.nom ?? ''}`.trim() ||
      'Prestataire';

    const { generateQuotePDF } = await import('@/lib/pdf/quote-pdf-generator');
    const pdfBytes = await generateQuotePDF({
      reference: invoice.invoice_number,
      title: invoice.title,
      description: invoice.description,
      documentType: 'invoice',
      issueDate: invoice.invoice_date,
      validUntil: invoice.due_date,
      providerName,
      providerSiret: providerEntity?.siret ?? null,
      providerEmail: providerEntity?.email ?? null,
      providerPhone: providerEntity?.phone ?? providerProfile?.telephone ?? null,
      providerAddress: providerEntity?.adresse_complete ?? null,
      clientName: ownerName,
      clientEmail: ownerEmail,
      propertyAddress,
      items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit: it.unit ?? 'unité',
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate ?? 20),
      })),
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (error) {
    console.error('[GET /api/provider/invoices/[id]/pdf] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
