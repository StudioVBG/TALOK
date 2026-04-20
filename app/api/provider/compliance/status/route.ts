export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour le statut de compliance du prestataire
 * GET /api/provider/compliance/status - Statut complet de compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('id, role, prenom, nom')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
    }

    if (profile.role !== 'provider') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { data: providerProfile, error: providerError } = await serviceClient
      .from('provider_profiles')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    if (providerError && providerError.code !== 'PGRST116') {
      console.error('[provider/compliance/status] provider_profiles error:', providerError);
      return NextResponse.json({ error: providerError.message }, { status: 500 });
    }

    const { data: documents } = await serviceClient
      .from('provider_compliance_documents')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false });

    const providerType = (providerProfile as any)?.provider_type || 'independant';
    const { data: requirements } = await serviceClient
      .from('provider_kyc_requirements')
      .select('*')
      .eq('provider_type', providerType);

    const { data: missingDocs } = await serviceClient.rpc('get_provider_missing_documents', {
      p_provider_profile_id: profile.id,
    });

    const { data: complianceScore } = await serviceClient.rpc('calculate_provider_compliance_score', {
      p_provider_profile_id: profile.id,
    });

    const { data: payoutAccount } = await serviceClient
      .from('provider_payout_accounts')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .eq('is_default', true)
      .single();

    const response = {
      profile: {
        id: profile.id,
        name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Prestataire',
      },
      provider: providerProfile || {
        profile_id: profile.id,
        provider_type: 'independant',
        kyc_status: 'incomplete',
        compliance_score: 0,
        status: 'pending',
      },
      documents: documents || [],
      requirements: requirements || [],
      missing_documents: missingDocs || [],
      compliance_score: complianceScore || 0,
      payout_account: payoutAccount || null,
      summary: {
        total_required: (requirements || []).filter((r: any) => r.is_required).length,
        total_uploaded: (documents || []).length,
        total_verified: (documents || []).filter((d: any) => d.verification_status === 'verified').length,
        total_pending: (documents || []).filter((d: any) => d.verification_status === 'pending').length,
        total_rejected: (documents || []).filter((d: any) => d.verification_status === 'rejected').length,
        total_expired: (documents || []).filter(
          (d: any) => d.expiration_date && new Date(d.expiration_date) < new Date()
        ).length,
        has_payout_account: !!payoutAccount,
        can_receive_missions:
          (providerProfile as any)?.status === 'approved' && (providerProfile as any)?.kyc_status === 'verified',
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[provider/compliance/status] handler error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
