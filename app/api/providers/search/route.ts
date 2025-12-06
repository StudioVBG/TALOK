// =====================================================
// API: Recherche de prestataires
// GET /api/providers/search
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    
    // Paramètres de recherche
    const query = searchParams.get('q') || '';
    const services = searchParams.get('services')?.split(',').filter(Boolean) || [];
    const minRating = parseFloat(searchParams.get('min_rating') || '0');
    const maxPrice = parseFloat(searchParams.get('max_price') || '999');
    const urgentOnly = searchParams.get('urgent_only') === 'true';
    const verifiedOnly = searchParams.get('verified_only') === 'true';
    const withPortfolio = searchParams.get('with_portfolio') === 'true';
    const location = searchParams.get('location') || '';
    const sortBy = searchParams.get('sort') || 'relevance';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Construire la requête de base
    let queryBuilder = supabase
      .from('provider_profiles')
      .select(`
        profile_id,
        type_services,
        certifications,
        zones_intervention,
        status,
        kyc_status,
        tarif_min,
        tarif_max,
        disponibilite_urgence,
        profiles!inner (
          id,
          prenom,
          nom,
          avatar_url,
          telephone,
          created_at
        )
      `, { count: 'exact' })
      .eq('status', 'approved');
    
    // Filtres
    if (verifiedOnly) {
      queryBuilder = queryBuilder.eq('kyc_status', 'verified');
    }
    
    if (urgentOnly) {
      queryBuilder = queryBuilder.eq('disponibilite_urgence', true);
    }
    
    if (maxPrice < 999) {
      queryBuilder = queryBuilder.lte('tarif_min', maxPrice);
    }
    
    // Exécuter la requête
    const { data: providers, error, count } = await queryBuilder
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Erreur recherche prestataires:', error);
      return NextResponse.json({ error: 'Erreur recherche' }, { status: 500 });
    }
    
    // Récupérer les stats pour chaque prestataire
    const providerIds = providers?.map(p => p.profile_id) || [];
    
    // Stats des avis
    const { data: reviewStats } = await supabase
      .from('provider_reviews')
      .select('provider_profile_id, rating')
      .in('provider_profile_id', providerIds);
    
    // Stats des interventions
    const { data: interventionStats } = await supabase
      .from('work_orders')
      .select('provider_id, statut')
      .in('provider_id', providerIds)
      .in('statut', ['closed', 'fully_paid']);
    
    // Stats du portfolio
    const { data: portfolioStats } = await supabase
      .from('provider_portfolio_items')
      .select('provider_profile_id, is_featured, after_photo_url, title, before_photo_url')
      .in('provider_profile_id', providerIds)
      .eq('is_public', true)
      .eq('moderation_status', 'approved');
    
    // Construire les résultats enrichis
    const enrichedProviders = providers?.map(provider => {
      const profile = provider.profiles as any;
      
      // Calculer les stats d'avis
      const reviews = reviewStats?.filter(r => r.provider_profile_id === provider.profile_id) || [];
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 0;
      
      // Calculer les stats d'interventions
      const interventions = interventionStats?.filter(i => i.provider_id === provider.profile_id) || [];
      
      // Portfolio
      const portfolio = portfolioStats?.filter(p => p.provider_profile_id === provider.profile_id) || [];
      const featuredPortfolio = portfolio.find(p => p.is_featured);
      
      return {
        id: provider.profile_id,
        name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Prestataire',
        avatar_url: profile.avatar_url,
        services: provider.type_services || [],
        rating: Math.round(avgRating * 10) / 10,
        review_count: reviews.length,
        intervention_count: interventions.length,
        location: provider.zones_intervention || 'France',
        hourly_rate_min: provider.tarif_min,
        hourly_rate_max: provider.tarif_max,
        is_urgent_available: provider.disponibilite_urgence || false,
        kyc_status: provider.kyc_status,
        has_certifications: !!provider.certifications && provider.certifications.length > 0,
        portfolio_count: portfolio.length,
        featured_portfolio: featuredPortfolio ? {
          before_url: featuredPortfolio.before_photo_url,
          after_url: featuredPortfolio.after_photo_url,
          title: featuredPortfolio.title,
        } : undefined,
      };
    }) || [];
    
    // Filtrer côté serveur (pour les critères non supportés par Supabase)
    let filteredProviders = enrichedProviders;
    
    // Filtre par services
    if (services.length > 0) {
      filteredProviders = filteredProviders.filter(p => 
        p.services.some((s: string) => services.includes(s))
      );
    }
    
    // Filtre par note minimum
    if (minRating > 0) {
      filteredProviders = filteredProviders.filter(p => p.rating >= minRating);
    }
    
    // Filtre par portfolio
    if (withPortfolio) {
      filteredProviders = filteredProviders.filter(p => p.portfolio_count > 0);
    }
    
    // Filtre par recherche textuelle
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredProviders = filteredProviders.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.services.some((s: string) => s.toLowerCase().includes(lowerQuery)) ||
        p.location.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Tri
    switch (sortBy) {
      case 'rating':
        filteredProviders.sort((a, b) => b.rating - a.rating);
        break;
      case 'reviews':
        filteredProviders.sort((a, b) => b.review_count - a.review_count);
        break;
      case 'price_asc':
        filteredProviders.sort((a, b) => (a.hourly_rate_min || 999) - (b.hourly_rate_min || 999));
        break;
      case 'price_desc':
        filteredProviders.sort((a, b) => (b.hourly_rate_max || 0) - (a.hourly_rate_max || 0));
        break;
      case 'relevance':
      default:
        // Tri par pertinence : vérifié > note > avis
        filteredProviders.sort((a, b) => {
          const aScore = (a.kyc_status === 'verified' ? 100 : 0) + (a.rating * 10) + a.review_count;
          const bScore = (b.kyc_status === 'verified' ? 100 : 0) + (b.rating * 10) + b.review_count;
          return bScore - aScore;
        });
        break;
    }
    
    return NextResponse.json({
      success: true,
      providers: filteredProviders,
      total: filteredProviders.length,
      limit,
      offset,
    });
    
  } catch (error) {
    console.error('Erreur API providers/search:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

