export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/provider/quotes/[id]/pdf
 *
 * Genere et retourne le PDF d'un devis prestataire (A4 portrait).
 * Acces : prestataire proprietaire du devis ou destinataire (owner_profile_id).
 *
 * Le PDF n'est pas stocke — il est genere a la volee a chaque appel
 * pour rester toujours a jour avec les donnees DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { generateQuotePDF, type QuotePdfItem } from '@/lib/pdf/quote-pdf-generator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
    }

    const { data: quote, error: quoteError } = await serviceClient
      .from('provider_quotes')
      .select(`
        *,
        provider:profiles!provider_quotes_provider_profile_id_fkey (
          prenom,
          nom,
          email,
          telephone
        ),
        provider_profile:provider_profiles!provider_quotes_provider_profile_id_fkey (
          raison_sociale,
          siret,
          adresse,
          code_postal,
          ville
        ),
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          prenom,
          nom,
          email
        ),
        property:properties (
          adresse_complete,
          code_postal,
          ville
        ),
        items:provider_quote_items (
          description,
          quantity,
          unit,
          unit_price,
          tax_rate,
          sort_order
        )
      `)
      .eq('id', id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    // Acces : provider createur OU owner destinataire OU admin
    const isProvider = quote.provider_profile_id === profile.id;
    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    // Composer le nom prestataire (raison sociale en priorite)
    const providerInfo = quote.provider_profile as {
      raison_sociale?: string | null;
      siret?: string | null;
      adresse?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    } | null;
    const providerUser = quote.provider as {
      prenom?: string | null;
      nom?: string | null;
      email?: string | null;
      telephone?: string | null;
    } | null;

    const providerName =
      providerInfo?.raison_sociale ||
      `${providerUser?.prenom || ''} ${providerUser?.nom || ''}`.trim() ||
      'Prestataire';

    const providerAddress = providerInfo?.adresse
      ? [providerInfo.adresse, [providerInfo.code_postal, providerInfo.ville].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(' — ')
      : null;

    const ownerUser = quote.owner as {
      prenom?: string | null;
      nom?: string | null;
      email?: string | null;
    } | null;
    const clientName = ownerUser
      ? `${ownerUser.prenom || ''} ${ownerUser.nom || ''}`.trim() || null
      : null;
    const clientEmail = ownerUser?.email || null;

    const property = quote.property as {
      adresse_complete?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    } | null;
    const propertyAddress = property
      ? [property.adresse_complete, [property.code_postal, property.ville].filter(Boolean).join(' ')]
          .filter(Boolean)
          .join(', ')
      : null;

    // Sort items
    const rawItems = (quote.items || []) as Array<{
      description: string;
      quantity: number | string;
      unit?: string | null;
      unit_price: number | string;
      tax_rate: number | string;
      sort_order: number | null;
    }>;
    const items: QuotePdfItem[] = rawItems
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it) => ({
        description: it.description,
        quantity: typeof it.quantity === 'string' ? parseFloat(it.quantity) : it.quantity,
        unit: it.unit ?? null,
        unit_price:
          typeof it.unit_price === 'string' ? parseFloat(it.unit_price) : it.unit_price,
        tax_rate: typeof it.tax_rate === 'string' ? parseFloat(it.tax_rate) : it.tax_rate,
      }));

    const pdfBytes = await generateQuotePDF({
      reference: quote.reference,
      title: quote.title,
      description: quote.description ?? null,
      issueDate: quote.created_at,
      validUntil: quote.valid_until ?? null,

      providerName,
      providerSiret: providerInfo?.siret ?? null,
      providerEmail: providerUser?.email ?? null,
      providerPhone: providerUser?.telephone ?? null,
      providerAddress,

      clientName,
      clientEmail,
      propertyAddress,

      items,

      termsAndConditions: quote.terms_and_conditions ?? null,
      paymentConditions: null,

      acceptanceSignedName: quote.acceptance_signed_name ?? null,
      acceptanceSignedAt: quote.acceptance_signed_at ?? null,
    });

    const filename = `devis-${quote.reference}.pdf`;
    const inline = request.nextUrl.searchParams.get('download') !== 'true';
    const disposition = `${inline ? 'inline' : 'attachment'}; filename="${filename}"`;

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quotes/[id]/pdf:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
