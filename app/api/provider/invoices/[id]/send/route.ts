export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour envoyer une facture
 * POST /api/provider/invoices/[id]/send
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

    const invoiceId = params.id;

    // Récupérer le profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    // Récupérer la facture
    const { data: invoice, error: invoiceError } = await supabase
      .from('provider_invoices')
      .select(`
        *,
        owner:profiles!provider_invoices_owner_profile_id_fkey (
          id,
          prenom,
          nom,
          user_id
        )
      `)
      .eq('id', invoiceId)
      .eq('provider_profile_id', profile.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Facture non trouvée' }, { status: 404 });
    }

    // Vérifier que la facture peut être envoyée
    if (!['draft', 'sent'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'Cette facture ne peut pas être envoyée dans son état actuel' },
        { status: 400 }
      );
    }

    // Récupérer l'email du destinataire
    let recipientEmail = null;
    if (invoice.owner?.user_id) {
      const { data: ownerUser } = await supabase.auth.admin.getUserById(invoice.owner.user_id);
      recipientEmail = ownerUser?.user?.email;
    }

    // Parser le body pour l'email personnalisé
    const body = await request.json().catch(() => ({}));
    const sendToEmail = body.email || recipientEmail;

    if (!sendToEmail) {
      return NextResponse.json(
        { error: 'Aucun email de destination trouvé' },
        { status: 400 }
      );
    }

    // Mettre à jour le statut de la facture
    const { error: updateError } = await supabase
      .from('provider_invoices')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_to_email: sendToEmail,
        reminder_count: invoice.status === 'sent' ? (invoice.reminder_count || 0) + 1 : 0,
        last_reminder_at: invoice.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Error updating invoice:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // TODO: Envoyer l'email via le système de notifications
    // Pour l'instant, on log simplement l'action
    console.log(`Invoice ${invoice.invoice_number} sent to ${sendToEmail}`);

    // Créer une notification pour le destinataire
    if (invoice.owner?.id) {
      await supabase.from('notifications').insert({
        profile_id: invoice.owner.id,
        type: 'invoice_received',
        title: 'Nouvelle facture reçue',
        message: `Vous avez reçu une facture de ${invoice.total_amount}€ pour "${invoice.title}"`,
        data: {
          invoice_id: invoiceId,
          invoice_number: invoice.invoice_number,
          amount: invoice.total_amount,
        },
      }).catch(() => {
        // Ignorer les erreurs de notification
      });
    }

    return NextResponse.json({
      success: true,
      message: `Facture envoyée à ${sendToEmail}`,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/invoices/[id]/send:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

