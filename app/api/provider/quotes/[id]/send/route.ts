export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour envoyer un devis
 * POST /api/provider/quotes/[id]/send
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Récupérer le devis
    const { data: quote, error: quoteError } = await supabase
      .from('provider_quotes')
      .select(`
        *,
        owner:profiles!provider_quotes_owner_profile_id_fkey (
          id,
          prenom,
          nom,
          user_id
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
    const { error: updateError } = await supabase
      .from('provider_quotes')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (updateError) {
      console.error('Error updating quote:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Créer une notification pour le destinataire
    if (quote.owner?.id) {
      await supabase.from('notifications').insert({
        profile_id: quote.owner.id,
        type: 'quote_received',
        title: 'Nouveau devis reçu',
        message: `Vous avez reçu un devis de ${quote.total_amount}€ pour "${quote.title}"`,
        data: {
          quote_id: quoteId,
          reference: quote.reference,
          amount: quote.total_amount,
        },
      }).catch(() => {
        // Ignorer les erreurs de notification
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Devis envoyé avec succès',
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quotes/[id]/send:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

