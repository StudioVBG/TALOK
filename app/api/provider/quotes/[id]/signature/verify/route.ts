export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/provider/quotes/[id]/signature/verify
 *
 * Verifie l'integrite et l'origine de la signature d'un devis :
 *   - Recalcule le hash canonique des donnees DB courantes
 *   - Compare au hash stocke (signature_document_hash)
 *   - Valide le HMAC (signature_hmac) via le secret SIGNATURE_HMAC_KEY
 *
 * Acces : provider createur, owner destinataire, ou admin.
 *
 * Reponse :
 *   {
 *     valid: boolean,
 *     level: 'simple' | 'advanced' | null,
 *     hashMatches: boolean | null,
 *     hmacValid: boolean | null,
 *     currentHash, storedHash,
 *     signedName, signedAt,
 *     reasons: string[]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { verifyQuoteSignature } from '@/lib/signature/quote-signature';

export async function GET(
  _request: NextRequest,
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

    const { data: quote, error: fetchError } = await serviceClient
      .from('provider_quotes')
      .select(`
        id, reference, title, description,
        subtotal, tax_amount, total_amount,
        valid_until, created_at,
        terms_and_conditions,
        provider_profile_id, owner_profile_id, property_id, ticket_id,
        signature_level,
        signature_document_hash, signature_hmac,
        acceptance_signed_name, acceptance_signed_at,
        items:provider_quote_items (
          description, quantity, unit, unit_price, tax_rate, sort_order
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const isProvider = quote.provider_profile_id === profile.id;
    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';
    if (!isProvider && !isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    const items = ((quote.items || []) as Array<{
      description: string;
      quantity: number | string;
      unit?: string | null;
      unit_price: number | string;
      tax_rate: number | string;
      sort_order?: number | null;
    }>);

    let result;
    try {
      result = verifyQuoteSignature({
        id: quote.id,
        reference: quote.reference,
        title: quote.title,
        description: quote.description ?? null,
        subtotal: quote.subtotal,
        tax_amount: quote.tax_amount,
        total_amount: quote.total_amount,
        valid_until: quote.valid_until ?? null,
        created_at: quote.created_at,
        provider_profile_id: quote.provider_profile_id,
        owner_profile_id: quote.owner_profile_id ?? null,
        property_id: quote.property_id ?? null,
        ticket_id: quote.ticket_id ?? null,
        terms_and_conditions: quote.terms_and_conditions ?? null,
        items,
        signature_level: quote.signature_level ?? null,
        signature_document_hash: quote.signature_document_hash ?? null,
        signature_hmac: quote.signature_hmac ?? null,
        acceptance_signed_name: quote.acceptance_signed_name ?? null,
        acceptance_signed_at: quote.acceptance_signed_at ?? null,
      });
    } catch (err) {
      // SIGNATURE_HMAC_KEY manquant -> verification impossible mais le devis existe
      return NextResponse.json(
        {
          valid: false,
          level: quote.signature_level ?? null,
          error: err instanceof Error ? err.message : 'Erreur verification',
          configured: false,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ ...result, configured: true });
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/quotes/[id]/signature/verify:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
