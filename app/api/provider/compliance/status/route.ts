export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour le statut de compliance du prestataire
 * GET /api/provider/compliance/status - Statut complet de compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Récupérer le profil prestataire
    const { data: profile } = await supabase
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

    // Récupérer le profil prestataire avec tous les détails
    const { data: providerProfile, error: providerError } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('profile_id', profile.id)
      .single();

    if (providerError && providerError.code !== 'PGRST116') {
      console.error('Error fetching provider profile:', providerError);
      return NextResponse.json({ error: providerError.message }, { status: 500 });
    }

    // Récupérer les documents
    const { data: documents } = await supabase
      .from('provider_compliance_documents')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .order('created_at', { ascending: false });

    // Récupérer les exigences KYC selon le type de prestataire
    const providerType = providerProfile?.provider_type || 'independant';
    const { data: requirements } = await supabase
      .from('provider_kyc_requirements')
      .select('*')
      .eq('provider_type', providerType);

    // Récupérer les documents manquants
    const { data: missingDocs } = await supabase.rpc('get_provider_missing_documents', {
      p_provider_profile_id: profile.id,
    });

    // Calculer le score de compliance
    const { data: complianceScore } = await supabase.rpc('calculate_provider_compliance_score', {
      p_provider_profile_id: profile.id,
    });

    // Récupérer le compte de paiement par défaut
    const { data: payoutAccount } = await supabase
      .from('provider_payout_accounts')
      .select('*')
      .eq('provider_profile_id', profile.id)
      .eq('is_default', true)
      .single();

    // Construire la réponse
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
          providerProfile?.status === 'approved' && providerProfile?.kyc_status === 'verified',
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Error in GET /api/provider/compliance/status:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" || 'Erreur serveur' }, { status: 500 });
  }
}

