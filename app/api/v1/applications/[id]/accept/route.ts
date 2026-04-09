export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { getServiceClient } from '@/lib/supabase/service-client';

/**
 * POST /api/v1/applications/[id]/accept — Accepter une candidature
 * Crée automatiquement un bail draft et notifie les autres candidats
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Récupérer la candidature
    const { data: application } = await serviceClient
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (!application) {
      return NextResponse.json({ error: 'Candidature introuvable' }, { status: 404 });
    }

    const appData = application as any;

    if (appData.owner_id !== (profile as any)?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    if (appData.status === 'accepted') {
      return NextResponse.json({ error: 'Candidature déjà acceptée' }, { status: 400 });
    }

    if (appData.status === 'rejected' || appData.status === 'withdrawn') {
      return NextResponse.json({ error: 'Impossible d\'accepter cette candidature' }, { status: 400 });
    }

    // 1. Accepter la candidature
    const { data: accepted, error: acceptError } = await serviceClient
      .from('applications')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (acceptError) throw acceptError;

    // 2. Créer un bail draft
    const { data: listing } = await serviceClient
      .from('property_listings')
      .select('property_id, rent_amount_cents, charges_cents, bail_type, available_from')
      .eq('id', appData.listing_id)
      .single();

    let leaseId: string | null = null;

    if (listing) {
      const listingInfo = listing as any;
      const { data: lease } = await serviceClient
        .from('leases')
        .insert({
          property_id: listingInfo.property_id,
          owner_id: (profile as any).id,
          statut: 'draft',
          type_bail: listingInfo.bail_type === 'nu' ? 'nu' : 'meuble',
          loyer: listingInfo.rent_amount_cents / 100,
          charges_forfaitaires: listingInfo.charges_cents / 100,
          date_debut: listingInfo.available_from,
        } as any)
        .select('id')
        .single();

      if (lease) {
        leaseId = (lease as any).id;
      }
    }

    // 3. Rejeter les autres candidatures pour cette annonce
    const { data: otherApplications } = await serviceClient
      .from('applications')
      .select('id, applicant_email, applicant_name')
      .eq('listing_id', appData.listing_id)
      .neq('id', id)
      .not('status', 'in', '("rejected","withdrawn","accepted")');

    if (otherApplications && otherApplications.length > 0) {
      await serviceClient
        .from('applications')
        .update({
          status: 'rejected',
          rejection_reason: 'Un autre candidat a été retenu',
          rejected_at: new Date().toISOString(),
        } as any)
        .eq('listing_id', appData.listing_id)
        .neq('id', id)
        .not('status', 'in', '("rejected","withdrawn","accepted")');

      // Envoyer les emails de refus
      try {
        const { sendEmail } = await import('@/lib/emails/resend.service');
        for (const other of otherApplications as any[]) {
          await sendEmail({
            to: other.applicant_email,
            subject: 'Suite à votre candidature — Talok',
            html: `
              <h2>Bonjour ${other.applicant_name},</h2>
              <p>Nous avons le regret de vous informer que votre candidature n'a pas été retenue pour ce logement.</p>
              <p>Nous vous souhaitons bonne chance dans vos recherches.</p>
              <p>Cordialement,<br/>L'équipe Talok</p>
            `,
          });
        }
      } catch (emailError) {
        console.error('[POST /api/v1/applications/[id]/accept] Erreur envoi emails refus:', emailError);
      }
    }

    // 4. Dépublier l'annonce
    await serviceClient
      .from('property_listings')
      .update({ is_published: false } as any)
      .eq('id', appData.listing_id);

    // 5. Email de confirmation au candidat accepté
    try {
      const { sendEmail } = await import('@/lib/emails/resend.service');
      await sendEmail({
        to: appData.applicant_email,
        subject: 'Candidature acceptée — Talok',
        html: `
          <h2>Bonjour ${appData.applicant_name},</h2>
          <p>Bonne nouvelle ! Votre candidature a été acceptée. Le propriétaire va préparer votre bail.</p>
          <p>Vous recevrez prochainement une invitation pour signer votre contrat de location.</p>
          <p>Cordialement,<br/>L'équipe Talok</p>
        `,
      });
    } catch (emailError) {
      console.error('[POST /api/v1/applications/[id]/accept] Erreur envoi email acceptation:', emailError);
    }

    return NextResponse.json({
      success: true,
      application: accepted,
      lease_id: leaseId,
    });
  } catch (error: unknown) {
    console.error('[POST /api/v1/applications/[id]/accept] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
