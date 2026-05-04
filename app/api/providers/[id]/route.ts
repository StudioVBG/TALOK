export const runtime = 'nodejs';

// =====================================================
// API: Détail d'un prestataire
// GET /api/providers/[id]
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    // Récupérer le profil prestataire
    const { data: providerProfile, error: profileError } = await supabase
      .from('provider_profiles')
      .select(`
        *,
        profiles!inner (
          id,
          prenom,
          nom,
          avatar_url,
          telephone,
          created_at
        )
      `)
      .eq('profile_id', id)
      .eq('status', 'approved')
      .single();
    
    if (profileError || !providerProfile) {
      return NextResponse.json({ error: 'Prestataire non trouvé' }, { status: 404 });
    }
    
    const profile = providerProfile.profiles as any;
    
    // Récupérer les avis
    const { data: reviews } = await supabase
      .from('provider_reviews')
      .select(`
        id,
        rating,
        comment,
        service_type,
        provider_response,
        created_at,
        reviewer:profiles!provider_reviews_reviewer_profile_id_fkey (
          prenom,
          nom,
          avatar_url
        )
      `)
      .eq('provider_profile_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false })
      .limit(20);
    
    // Calculer les stats des avis
    const allReviews = reviews || [];
    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + (r.rating as number), 0) / allReviews.length
      : 0;
    
    // Récupérer le portfolio
    const { data: portfolio } = await supabase
      .from('provider_portfolio_items')
      .select('*')
      .eq('provider_profile_id', id)
      .eq('is_public', true)
      .eq('moderation_status', 'approved')
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .limit(20);
    
    // Récupérer les stats d'interventions
    const { data: interventions, count: interventionCount } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: false })
      .eq('provider_id', id)
      .in('statut', ['closed', 'fully_paid']);

    // Identité légale + géolocalisation depuis la table `providers` (canonique).
    const { data: providerRow } = await supabase
      .from('providers')
      .select(
        'email, phone, address, city, postal_code, latitude, longitude, service_radius_km, is_verified, est_rge, decennale_expiry',
      )
      .eq('profile_id', id)
      .maybeSingle();

    // Statut favori : la table provider_favorites est scopée par owner.
    let isFavorite = false;
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (ownerProfile?.id) {
      const { data: fav } = await supabase
        .from('provider_favorites')
        .select('id')
        .eq('owner_profile_id', ownerProfile.id)
        .eq('provider_profile_id', id)
        .maybeSingle();
      isFavorite = !!fav;
    }
    
    // Calculer les stats
    const completedInterventions = interventionCount || 0;
    const onTimeCount = interventions?.filter(i => {
      if (!i.scheduled_start_at || !i.actual_start_at) return true;
      const scheduled = new Date(i.scheduled_start_at);
      const actual = new Date(i.actual_start_at);
      return actual <= new Date(scheduled.getTime() + 15 * 60000); // 15 min de marge
    }).length || 0;
    
    const onTimeRate = completedInterventions > 0 
      ? Math.round((onTimeCount / completedInterventions) * 100) 
      : 100;
    
    const satisfiedCount = allReviews.filter(r => (r.rating as number) >= 4).length;
    const satisfactionRate = allReviews.length > 0 
      ? Math.round((satisfiedCount / allReviews.length) * 100) 
      : 100;
    
    const recommendCount = allReviews.filter(r => (r.rating as number) >= 4.5).length;
    const recommendationRate = allReviews.length > 0 
      ? Math.round((recommendCount / allReviews.length) * 100) 
      : 100;
    
    // Formater les avis
    const formattedReviews = allReviews.map(review => ({
      id: review.id,
      author_name: review.reviewer 
        ? `${(review.reviewer as any).prenom || ''} ${((review.reviewer as any).nom || '').charAt(0)}.`
        : 'Anonyme',
      author_avatar: (review.reviewer as any)?.avatar_url,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      service_type: review.service_type,
      provider_response: review.provider_response,
    }));
    
    // Formater le portfolio
    const formattedPortfolio = (portfolio || []).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      service_type: item.service_type,
      before_photo_url: item.before_photo_url,
      after_photo_url: item.after_photo_url,
      completed_at: item.completed_at,
      is_featured: item.is_featured,
    }));
    
    // Parser les certifications
    let certifications: string[] = [];
    const rawCertifications = (providerProfile as any).certifications;
    if (rawCertifications) {
      if (typeof rawCertifications === 'string') {
        certifications = rawCertifications.split(',').map((c: string) => c.trim());
      } else if (Array.isArray(rawCertifications)) {
        certifications = rawCertifications;
      }
    }
    
    // Adresse complète canonique (issue de l'identité légale).
    const fullAddress = providerRow
      ? [providerRow.address, providerRow.postal_code, providerRow.city]
          .filter(Boolean)
          .join(', ')
      : null;

    // Construire la réponse
    const provider = {
      id: providerProfile.profile_id,
      name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Prestataire',
      avatar_url: profile.avatar_url,
      bio: (providerProfile as any).description || null,
      services: providerProfile.type_services || [],
      rating: Math.round(avgRating * 10) / 10,
      review_count: allReviews.length,
      intervention_count: completedInterventions,
      location: fullAddress || providerProfile.zones_intervention || 'France',
      // Adresse / contact / géoloc : provient de `providers` (identité légale)
      // et retombe sur `profile.telephone` si l'artisan n'a pas finalisé l'onboarding.
      address: fullAddress || (providerProfile as any).adresse || null,
      phone: providerRow?.phone || profile.telephone || null,
      email: providerRow?.email || null,
      latitude: providerRow?.latitude ?? null,
      longitude: providerRow?.longitude ?? null,
      service_radius_km: providerRow?.service_radius_km ?? null,
      is_verified: providerRow?.is_verified ?? false,
      est_rge: providerRow?.est_rge ?? false,
      decennale_expiry: providerRow?.decennale_expiry ?? null,
      hourly_rate_min: providerProfile.tarif_min,
      hourly_rate_max: providerProfile.tarif_max,
      is_urgent_available: providerProfile.disponibilite_urgence || false,
      response_time_hours: (providerProfile as any).temps_reponse_heures,
      kyc_status: providerProfile.kyc_status,
      has_certifications: certifications.length > 0,
      certifications,
      created_at: profile.created_at,
      portfolio: formattedPortfolio,
      reviews: formattedReviews,
      is_favorite: isFavorite,
      stats: {
        completed_interventions: completedInterventions,
        on_time_rate: onTimeRate,
        satisfaction_rate: satisfactionRate,
        recommendation_rate: recommendationRate,
      },
    };
    
    return NextResponse.json({
      success: true,
      provider,
    });
    
  } catch (error) {
    console.error('Erreur API providers/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

