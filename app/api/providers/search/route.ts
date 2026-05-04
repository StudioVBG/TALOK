export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API: Recherche de prestataires
// GET /api/providers/search
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { withFeatureAccess, createSubscriptionErrorResponse } from '@/lib/middleware/subscription-check';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Gate: hasProvidersManagement
    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
    if (profile) {
      const featureCheck = await withFeatureAccess(profile.id, "providers_management");
      if (!featureCheck.allowed) {
        return createSubscriptionErrorResponse(featureCheck);
      }
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

    // Coordonnées du bien (pour tri/filtre par distance) — optionnelles.
    // Si fournies, on calcule la distance réelle (Haversine) entre chaque
    // artisan géocodé et le bien, et on exclut ceux hors `radius_km`.
    const propertyLat = parseFloat(searchParams.get('property_lat') || 'NaN');
    const propertyLng = parseFloat(searchParams.get('property_lng') || 'NaN');
    const radiusKm = parseFloat(searchParams.get('radius_km') || 'NaN');
    const hasPropertyCoords =
      Number.isFinite(propertyLat) && Number.isFinite(propertyLng);
    
    // Construire la requête de base.
    // On joint `profiles` (FK directe) pour nom/avatar/téléphone.
    // Les données canoniques de l'identité légale (adresse, lat/lng,
    // service_radius_km, phone/email pro) vivent sur la table `providers`
    // qui partage `profile_id` mais sans FK directe avec `provider_profiles`
    // — on les rapatrie dans un second appel ci-dessous.
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
      .select('provider_profile_id, rating_overall')
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

    // Identité légale + géolocalisation depuis la table `providers` (canonique).
    // Partage `profile_id` avec provider_profiles mais sans FK directe.
    interface ProviderRow {
      profile_id: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      postal_code: string | null;
      latitude: number | null;
      longitude: number | null;
      service_radius_km: number | null;
      is_verified: boolean | null;
    }
    const { data: providersRows } = await supabase
      .from('providers')
      .select(
        'profile_id, email, phone, address, city, postal_code, latitude, longitude, service_radius_km, is_verified',
      )
      .in('profile_id', providerIds);
    const providersByProfileId = new Map<string, ProviderRow>();
    for (const row of (providersRows ?? []) as ProviderRow[]) {
      if (row.profile_id) providersByProfileId.set(row.profile_id, row);
    }

    // Favoris du propriétaire courant (table provider_favorites).
    let favoriteIds = new Set<string>();
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (ownerProfile?.id && providerIds.length > 0) {
      const { data: favs } = await supabase
        .from('provider_favorites')
        .select('provider_profile_id')
        .eq('owner_profile_id', ownerProfile.id)
        .in('provider_profile_id', providerIds);
      favoriteIds = new Set((favs ?? []).map((f: any) => f.provider_profile_id));
    }
    
    // Construire les résultats enrichis
    const enrichedProviders = providers?.map(provider => {
      const profile = provider.profiles as any;
      const providerRow = providersByProfileId.get(provider.profile_id);

      // Calculer les stats d'avis
      const reviews = reviewStats?.filter(r => r.provider_profile_id === provider.profile_id) || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating_overall as number), 0) / reviews.length
        : 0;

      // Calculer les stats d'interventions
      const interventions = interventionStats?.filter(i => i.provider_id === provider.profile_id) || [];

      // Portfolio
      const portfolio = portfolioStats?.filter(p => p.provider_profile_id === provider.profile_id) || [];
      const featuredPortfolio = portfolio.find(p => p.is_featured);

      // Géolocalisation : préférer les coordonnées de la table `providers`
      // (géocodées à partir de l'identité légale).
      const latitude = providerRow?.latitude ?? null;
      const longitude = providerRow?.longitude ?? null;

      // Distance par rapport au bien (si coordonnées fournies & artisan géocodé).
      let distance_km: number | null = null;
      if (
        hasPropertyCoords &&
        typeof latitude === 'number' &&
        typeof longitude === 'number'
      ) {
        distance_km =
          Math.round(
            haversineKm(propertyLat, propertyLng, latitude, longitude) * 10,
          ) / 10;
      }

      // Adresse complète : on assemble depuis providers (canonique) ou retombe
      // sur zones_intervention pour les artisans non encore géocodés.
      const fullAddress = providerRow
        ? [providerRow.address, providerRow.postal_code, providerRow.city]
            .filter(Boolean)
            .join(', ')
        : '';
      const location = fullAddress || provider.zones_intervention || 'France';

      // Phone professionnel saisi à l'identité légale > téléphone du profil
      // personnel (pour les artisans qui n'ont pas finalisé l'onboarding).
      const phone = providerRow?.phone || profile.telephone || null;
      const email = providerRow?.email || null;

      return {
        id: provider.profile_id,
        name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Prestataire',
        avatar_url: profile.avatar_url,
        services: provider.type_services || [],
        rating: Math.round(avgRating * 10) / 10,
        review_count: reviews.length,
        intervention_count: interventions.length,
        location,
        hourly_rate_min: provider.tarif_min,
        hourly_rate_max: provider.tarif_max,
        is_urgent_available: provider.disponibilite_urgence || false,
        kyc_status: provider.kyc_status,
        is_verified: providerRow?.is_verified ?? false,
        has_certifications: !!provider.certifications && provider.certifications.length > 0,
        portfolio_count: portfolio.length,
        featured_portfolio: featuredPortfolio ? {
          before_url: featuredPortfolio.before_photo_url,
          after_url: featuredPortfolio.after_photo_url,
          title: featuredPortfolio.title,
        } : undefined,
        // Coordonnées de contact + géolocalisation (nouveau)
        phone,
        email,
        latitude,
        longitude,
        service_radius_km: providerRow?.service_radius_km ?? null,
        distance_km,
        is_favorite: favoriteIds.has(provider.profile_id),
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

    // Filtre par localisation (matching textuel sur zones_intervention).
    // `location` peut être un code postal, une ville ou un département.
    if (location) {
      const lowerLocation = location.toLowerCase();
      filteredProviders = filteredProviders.filter(p =>
        p.location.toLowerCase().includes(lowerLocation),
      );
    }

    // Filtre par rayon (uniquement pour les artisans géocodés).
    // `radius_km` borne la zone autour du bien ; on respecte aussi le rayon
    // d'intervention déclaré par l'artisan (`service_radius_km`).
    if (hasPropertyCoords && Number.isFinite(radiusKm)) {
      filteredProviders = filteredProviders.filter((p) => {
        if (p.distance_km == null) return true; // pas géocodé → on garde
        if (p.distance_km > radiusKm) return false;
        // Si l'artisan a déclaré un rayon d'intervention, on l'exclut s'il
        // ne dessert pas ce point.
        if (
          typeof p.service_radius_km === 'number' &&
          p.distance_km > p.service_radius_km
        ) {
          return false;
        }
        return true;
      });
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
      case 'distance':
        // Tri réel par distance si coordonnées du bien fournies.
        // Les artisans non géocodés (distance_km = null) sont rejetés en fin
        // de liste pour ne pas masquer les options pertinentes.
        if (hasPropertyCoords) {
          filteredProviders.sort((a, b) => {
            const aDist = a.distance_km ?? Number.POSITIVE_INFINITY;
            const bDist = b.distance_km ?? Number.POSITIVE_INFINITY;
            return aDist - bDist;
          });
        } else {
          // Sans coordonnées, retombe sur la pertinence.
          filteredProviders.sort((a, b) => {
            const aScore = (a.kyc_status === 'verified' ? 100 : 0) + (a.rating * 10) + a.review_count;
            const bScore = (b.kyc_status === 'verified' ? 100 : 0) + (b.rating * 10) + b.review_count;
            return bScore - aScore;
          });
        }
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

// Distance en km entre deux points (formule de Haversine).
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

