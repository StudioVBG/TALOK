export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour envoyer un devis
 * POST /api/provider/quotes/[id]/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { sendOwnerQuoteReceivedEmail } from '@/lib/emails/resend.service';

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const quoteId = params.id;
    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    const { data: quote, error: quoteError } = await serviceClient
      .from('provider_quotes')
      .select(`
        *,
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          id,
          prenom,
          nom,
          email,
          user_id
        ),
        provider:profiles!provider_quotes_provider_profile_id_fkey (
          prenom,
          nom,
          provider_profile:provider_profiles (
            raison_sociale
          )
        ),
        property:properties (
          adresse_complete,
          code_postal,
          ville
        )
      `)
      .eq('id', quoteId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Devis non trouvé' }, { status: 404 });
    }

    // Vérifier que le devis peut être envoyé
    if (!['draft'].includes(quote.status)) {
      return NextResponse.json(
        { error: 'Ce devis a déjà été envoyé' },
        { status: 400 }
      );
    }

    // Mettre à jour le statut du devis
    const { error: updateError } = await serviceClient
      .from('provider_quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .eq('provider_profile_id', profile.id);

    if (updateError) {
      console.error('Error updating quote:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Créer une notification pour le destinataire
    if (quote.owner?.id) {
      await serviceClient.from('notifications').insert({
        profile_id: quote.owner.id,
        type: 'quote_received',
        title: 'Nouveau devis reçu',
        message: `Vous avez reçu un devis de ${quote.total_amount}€ pour "${quote.title}"`,
        data: {
          quote_id: quoteId,
          reference: quote.reference,
          amount: quote.total_amount,
        },
      });
    }

    // Email Resend "Nouveau devis recu" au proprietaire (best-effort, non bloquant)
    const ownerObj = quote.owner as {
      id?: string;
      email?: string | null;
      prenom?: string | null;
      nom?: string | null;
    } | null;
    const providerObj = quote.provider as {
      prenom?: string | null;
      nom?: string | null;
      provider_profile?: { raison_sociale?: string | null } | null;
    } | null;
    const providerInfo = providerObj?.provider_profile ?? null;
    const propertyObj = quote.property as {
      adresse_complete?: string | null;
      code_postal?: string | null;
      ville?: string | null;
    } | null;

    if (ownerObj?.email) {
      const recipientName =
        `${ownerObj.prenom || ''} ${ownerObj.nom || ''}`.trim() || 'Propriétaire';
      const providerName =
        providerInfo?.raison_sociale ||
        `${providerObj?.prenom || ''} ${providerObj?.nom || ''}`.trim() ||
        'Prestataire';
      const propertyAddress = propertyObj
        ? [propertyObj.adresse_complete, [propertyObj.code_postal, propertyObj.ville].filter(Boolean).join(' ')]
            .filter(Boolean)
            .join(', ')
        : null;
      const totalEuros =
        typeof quote.total_amount === 'string'
          ? parseFloat(quote.total_amount)
          : (quote.total_amount as number);

      sendOwnerQuoteReceivedEmail({
        ownerEmail: ownerObj.email,
        recipientName,
        quoteId: quoteId,
        quoteReference: quote.reference,
        quoteTitle: quote.title,
        providerName,
        propertyAddress,
        totalAmountEuros: Number.isFinite(totalEuros) ? totalEuros : 0,
        validUntil: quote.valid_until ?? null,
      }).catch((err) => {
        console.error('[provider/quotes/:id/send] sendOwnerQuoteReceivedEmail failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Devis envoyé avec succès',
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/send:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

