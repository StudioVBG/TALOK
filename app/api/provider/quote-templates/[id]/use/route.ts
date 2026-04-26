export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/provider/quote-templates/[id]/use
 *
 * Incremente usage_count + met a jour last_used_at quand un template
 * est charge pour creer un devis. Endpoint dedie pour eviter de
 * surcharger PUT (qui modifie le contenu) et permettre du tracking
 * fiable cote analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';

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

    if (!profile || profile.role !== 'provider') {
      return NextResponse.json({ error: 'Acces non autorise' }, { status: 403 });
    }

    // Verifier ownership avant update
    const { data: existing } = await serviceClient
      .from('quote_templates')
      .select('id, usage_count')
      .eq('id', id)
      .eq('provider_profile_id', profile.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
    }

    const { data: updated, error: updateError } = await serviceClient
      .from('quote_templates')
      .update({
        usage_count: (existing.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, usage_count, last_used_at')
      .single();

    if (updateError) {
      console.error('[provider/quote-templates/:id/use] update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ template: updated });
  } catch (error: unknown) {
    console.error('Error in POST /api/provider/quote-templates/[id]/use:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
