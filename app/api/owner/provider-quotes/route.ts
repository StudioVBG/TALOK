export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/provider-quotes
 *
 * Liste tous les devis prestataire envoyes au proprietaire courant.
 * Filtres : ?status=sent|viewed|accepted|rejected|expired (multi-valeurs
 * autorise via virgules).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(request: NextRequest) {
  try {
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

    const statusFilter = request.nextUrl.searchParams.get('status');
    const statuses = statusFilter
      ? statusFilter.split(',').map((s) => s.trim()).filter(Boolean)
      : null;

    let query = serviceClient
      .from('provider_quotes')
      .select(`
        id,
        reference,
        title,
        status,
        total_amount,
        valid_until,
        sent_at,
        accepted_at,
        rejected_at,
        created_at,
        provider:profiles!provider_quotes_provider_profile_id_fkey (
          prenom,
          nom
        ),
        provider_profile:provider_profiles!provider_quotes_provider_profile_id_fkey (
          raison_sociale,
          company_logo_url
        ),
        property:properties (
          adresse_complete,
          ville
        )
      `)
      .eq('owner_profile_id', profile.id)
      .neq('status', 'draft')
      .order('sent_at', { ascending: false, nullsFirst: false });

    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    }

    const { data: quotes, error } = await query;

    if (error) {
      console.error('[owner/provider-quotes] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enriched = (quotes || []).map((q) => {
      const provUser = q.provider as { prenom?: string; nom?: string } | null;
      const provInfo = q.provider_profile as {
        raison_sociale?: string | null;
        company_logo_url?: string | null;
      } | null;
      const property = q.property as {
        adresse_complete?: string | null;
        ville?: string | null;
      } | null;
      return {
        id: q.id,
        reference: q.reference,
        title: q.title,
        status: q.status,
        total_amount: q.total_amount,
        valid_until: q.valid_until,
        sent_at: q.sent_at,
        accepted_at: q.accepted_at,
        rejected_at: q.rejected_at,
        created_at: q.created_at,
        provider_name:
          provInfo?.raison_sociale ||
          `${provUser?.prenom || ''} ${provUser?.nom || ''}`.trim() ||
          'Prestataire',
        provider_logo_url: provInfo?.company_logo_url ?? null,
        property_address: property
          ? `${property.adresse_complete || ''}${property.ville ? ', ' + property.ville : ''}`.trim()
          : null,
      };
    });

    const stats = {
      total: enriched.length,
      pending: enriched.filter((q) => q.status === 'sent' || q.status === 'viewed').length,
      accepted: enriched.filter((q) => q.status === 'accepted').length,
      rejected: enriched.filter((q) => q.status === 'rejected').length,
    };

    return NextResponse.json({ quotes: enriched, stats });
  } catch (error: unknown) {
    console.error('Error in GET /api/owner/provider-quotes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 },
    );
  }
}
