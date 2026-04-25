export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/provider/quotes/[id]/accept
 *
 * Acceptation d'un devis prestataire par le proprietaire (owner_profile_id)
 * ou un admin. Cote owner : action "Accepter ce devis" depuis la page
 * de detail du devis.
 *
 * Effets de bord :
 *   1. provider_quotes.status -> 'accepted' + accepted_at = NOW()
 *   2. Envoi email "Votre devis a ete accepte" au prestataire (Resend)
 *
 * Idempotent : si le devis est deja en statut 'accepted', renvoie 200
 * sans rien re-faire (et n'envoie pas d'email — Resend l'aurait dedup
 * de toute facon via idempotencyKey).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sendProviderQuoteApprovedEmail } from '@/lib/emails/resend.service';

export async function POST(
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
        id, status, accepted_at,
        title, reference, total_amount,
        owner_profile_id,
        provider_profile_id,
        property_id,
        provider:profiles!provider_quotes_provider_profile_id_fkey (
          email, prenom, nom
        ),
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          prenom, nom
        ),
        property:properties (
          adresse_complete, code_postal, ville
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Devis introuvable' }, { status: 404 });
    }

    const isOwner = quote.owner_profile_id === profile.id;
    const isAdmin = profile.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Seul le destinataire peut accepter ce devis' },
        { status: 403 },
      );
    }

    // Idempotent : deja accepte
    if (quote.status === 'accepted') {
      return NextResponse.json({ ok: true, already: true });
    }

    // Statuts qu'on accepte de transitionner -> accepted
    const transitionable = ['sent', 'viewed'];
    if (!transitionable.includes(quote.status)) {
      return NextResponse.json(
        {
          error: `Devis non acceptable depuis le statut "${quote.status}". Le prestataire doit d'abord l'envoyer.`,
        },
        { status: 400 },
      );
    }

    const acceptedAt = new Date().toISOString();
    const { error: updateError } = await serviceClient
      .from('provider_quotes')
      .update({
        status: 'accepted',
        accepted_at: acceptedAt,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[provider/quotes/:id/accept] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Email prestataire (best-effort, non bloquant)
    const provider = quote.provider as {
      email?: string | null;
      prenom?: string | null;
      nom?: string | null;
    } | null;
    const owner = quote.owner as {
      prenom?: string | null;
      nom?: string | null;
    } | null;
    const property = quote.property as {
      adresse_complete?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    } | null;

    if (provider?.email) {
      const recipientName =
        `${provider.prenom || ''} ${provider.nom || ''}`.trim() || 'Prestataire';
      const clientName = owner
        ? `${owner.prenom || ''} ${owner.nom || ''}`.trim() || null
        : null;
      const propertyAddress = property
        ? [property.adresse_complete, [property.code_postal, property.ville].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ')
        : null;

      const totalEuros =
        typeof quote.total_amount === 'string'
          ? parseFloat(quote.total_amount)
          : (quote.total_amount as number);

      sendProviderQuoteApprovedEmail({
        providerEmail: provider.email,
        recipientName,
        quoteReference: quote.reference,
        quoteTitle: quote.title,
        clientName,
        propertyAddress,
        totalAmountEuros: Number.isFinite(totalEuros) ? totalEuros : 0,
        acceptedAt,
        quoteId: quote.id,
      }).catch((err) => {
        console.error('[provider/quotes/:id/accept] sendProviderQuoteApprovedEmail failed:', err);
      });
    }

    return NextResponse.json({ ok: true, accepted_at: acceptedAt });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/accept:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
