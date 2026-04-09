export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/helpers/auth-helper';
import { compareApplicationsSchema } from '@/lib/validations/candidatures';
import { getServiceClient } from '@/lib/supabase/service-client';
import { z } from 'zod';

/**
 * POST /api/v1/applications/compare — Comparer N candidats côte à côte
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const validated = compareApplicationsSchema.parse(body);

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Récupérer les candidatures
    const { data: applications, error } = await serviceClient
      .from('applications')
      .select('*')
      .in('id', validated.application_ids)
      .eq('owner_id', (profile as any)?.id);

    if (error) throw error;

    if (!applications || applications.length < 2) {
      return NextResponse.json(
        { error: 'Au moins 2 candidatures valides sont requises' },
        { status: 400 }
      );
    }

    // Calculer le ranking
    const ranking = (applications as any[])
      .map((app) => ({
        application_id: app.id,
        applicant_name: app.applicant_name,
        applicant_email: app.applicant_email,
        completeness_score: app.completeness_score || 0,
        ai_score: app.ai_score,
        total_score: app.ai_score
          ? Math.round((app.completeness_score || 0) * 0.4 + app.ai_score * 0.6)
          : app.completeness_score || 0,
        status: app.status,
        documents_count: (app.documents || []).length,
        has_message: !!app.message,
        created_at: app.created_at,
        rank: 0,
      }))
      .sort((a, b) => b.total_score - a.total_score)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return NextResponse.json({
      applications,
      ranking,
      comparison_date: new Date().toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) },
        { status: 400 }
      );
    }
    console.error('[POST /api/v1/applications/compare] Erreur:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}
