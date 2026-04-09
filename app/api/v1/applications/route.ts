export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createApplicationSchema } from '@/lib/validations/candidatures';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

/**
 * POST /api/v1/applications — Déposer une candidature (public, pas d'auth requise)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createApplicationSchema.parse(body);

    const serviceClient = getServiceClient();

    // Vérifier que l'annonce existe et est publiée
    const { data: listing, error: listingError } = await serviceClient
      .from('property_listings')
      .select('id, property_id, owner_id, is_published')
      .eq('id', validated.listing_id)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 });
    }

    const listingData = listing as any;
    if (!listingData.is_published) {
      return NextResponse.json({ error: 'Cette annonce n\'est plus disponible' }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas déjà une candidature avec le même email pour cette annonce
    const { data: existing } = await serviceClient
      .from('applications')
      .select('id')
      .eq('listing_id', validated.listing_id)
      .eq('applicant_email', validated.applicant_email)
      .not('status', 'eq', 'withdrawn')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Vous avez déjà déposé une candidature pour cette annonce' },
        { status: 409 }
      );
    }

    const { data, error } = await serviceClient
      .from('applications')
      .insert({
        listing_id: validated.listing_id,
        property_id: listingData.property_id,
        owner_id: listingData.owner_id,
        applicant_name: validated.applicant_name,
        applicant_email: validated.applicant_email,
        applicant_phone: validated.applicant_phone || null,
        message: validated.message || null,
        documents: validated.documents || [],
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Envoyer un email de confirmation au candidat
    try {
      const { sendEmail } = await import('@/lib/emails/resend.service');
      await sendEmail({
        to: validated.applicant_email,
        subject: 'Candidature reçue — Talok',
        html: `
          <h2>Bonjour ${validated.applicant_name},</h2>
          <p>Votre candidature a bien été enregistrée. Le propriétaire examinera votre dossier et reviendra vers vous dans les meilleurs délais.</p>
          <p>Cordialement,<br/>L'équipe Talok</p>
        `,
      });
    } catch (emailError) {
      console.error('[POST /api/v1/applications] Erreur envoi email:', emailError);
    }

    return NextResponse.json({ application: data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      );
    }
    console.error('[POST /api/v1/applications] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
