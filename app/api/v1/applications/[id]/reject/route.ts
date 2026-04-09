export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { rejectApplicationSchema } from '@/lib/validations/candidatures';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

/**
 * POST /api/v1/applications/[id]/reject — Refuser une candidature
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

    const body = await request.json().catch(() => ({}));
    const validated = rejectApplicationSchema.parse(body);

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

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

    if (appData.status === 'rejected') {
      return NextResponse.json({ error: 'Candidature déjà refusée' }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from('applications')
      .update({
        status: 'rejected',
        rejection_reason: validated.rejection_reason || null,
        rejected_at: new Date().toISOString(),
      } as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Envoyer l'email de refus
    try {
      const { sendEmail } = await import('@/lib/emails/resend.service');
      await sendEmail({
        to: appData.applicant_email,
        subject: 'Suite à votre candidature — Talok',
        html: `
          <h2>Bonjour ${appData.applicant_name},</h2>
          <p>Nous avons le regret de vous informer que votre candidature n'a pas été retenue pour ce logement.</p>
          <p>Nous vous souhaitons bonne chance dans vos recherches.</p>
          <p>Cordialement,<br/>L'équipe Talok</p>
        `,
      });
    } catch (emailError) {
      console.error('[POST /api/v1/applications/[id]/reject] Erreur envoi email:', emailError);
    }

    return NextResponse.json({ success: true, application: data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      );
    }
    console.error('[POST /api/v1/applications/[id]/reject] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
