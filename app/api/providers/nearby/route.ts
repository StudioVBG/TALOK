export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API: Recherche de prestataires locaux via Google Places
// GET /api/providers/nearby
// Fonctionnalité PREMIUM (Confort+)
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

// Mapping des catégories vers les types Google Places
const CATEGORY_TO_GOOGLE_TYPE: Record<string, string[]> = {
  plomberie: ["plumber"],
  electricite: ["electrician"],
  chauffage: ["hvac_contractor", "plumber"],
  serrurerie: ["locksmith"],
  menuiserie: ["carpenter"],
  peinture: ["painter"],
  nettoyage: ["cleaning_service"],
  jardinage: ["landscaper", "gardener"],
  autre: ["general_contractor", "handyman"],
};

// Mapping des catégories vers les termes de recherche en français
const CATEGORY_TO_SEARCH_TERM: Record<string, string> = {
  plomberie: "plombier",
  electricite: "électricien",
  chauffage: "chauffagiste climatisation",
  serrurerie: "serrurier",
  menuiserie: "menuisier",
  peinture: "peintre bâtiment",
  nettoyage: "entreprise nettoyage",
  jardinage: "jardinier paysagiste",
  autre: "dépannage artisan",
};

interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  international_phone_number?: string;
  opening_hours?: {
    open_now?: boolean;
  };
  photos?: Array<{
    photo_reference: string;
  }>;
  business_status?: string;
}

interface NearbyProvider {
  id: string;
  name: string;
  address: string;
  distance_km?: number;
  rating?: number;
  reviews_count?: number;
  phone?: string;
  is_open?: boolean;
  photo_url?: string;
  google_maps_url: string;
  source: "google";
}

// Cache simple en mémoire (en production, utiliser Redis)
const cache = new Map<string, { data: NearbyProvider[]; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient();

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier le plan de l'utilisateur (doit être Confort ou supérieur)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier l'abonnement
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug, status")
      .eq("user_id", profile.id)
      .eq("status", "active")
      .single();

    const planSlug = subscription?.plan_slug || "starter";
    const premiumPlans = ["confort", "pro", "enterprise"];

    if (!premiumPlans.includes(planSlug)) {
      return NextResponse.json(
        {
          error: "premium_required",
          message: "Cette fonctionnalité nécessite un plan Confort ou supérieur",
          upgrade_url: "/owner/settings/subscription",
        },
        { status: 403 }
      );
    }

    // Récupérer les paramètres
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "autre";
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radius = parseInt(searchParams.get("radius") || "10000"); // 10km par défaut
    const address = searchParams.get("address") || "";

    // Vérifier la clé API Google
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      // Fallback : retourner des données de démonstration
      return NextResponse.json({
        providers: getDemoProviders(category),
        source: "demo",
        message: "Mode démonstration - Configurez GOOGLE_PLACES_API_KEY pour les vrais résultats",
      });
    }

    // Créer une clé de cache
    const cacheKey = `${category}-${lat.toFixed(2)}-${lng.toFixed(2)}-${radius}`;

    // Vérifier le cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        providers: cached.data,
        source: "cache",
        cached: true,
      });
    }

    // Si on a une adresse mais pas de coordonnées, géocoder l'adresse
    let latitude = lat;
    let longitude = lng;

    if ((!lat || !lng) && address) {
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
      const geocodeRes = await fetch(geocodeUrl);
      const geocodeData = await geocodeRes.json();

      if (geocodeData.results?.[0]?.geometry?.location) {
        latitude = geocodeData.results[0].geometry.location.lat;
        longitude = geocodeData.results[0].geometry.location.lng;
      }
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Coordonnées ou adresse requises" },
        { status: 400 }
      );
    }

    // Rechercher via Google Places API (Text Search)
    const searchTerm = CATEGORY_TO_SEARCH_TERM[category] || "artisan dépannage";
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchTerm)}&location=${latitude},${longitude}&radius=${radius}&language=fr&key=${googleApiKey}`;

    const placesRes = await fetch(textSearchUrl);
    const placesData = await placesRes.json();

    if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", placesData.status, placesData.error_message);
      return NextResponse.json({
        providers: getDemoProviders(category),
        source: "demo",
        error: "Erreur API Google, données de démonstration affichées",
      });
    }

    // Transformer les résultats
    const providers: NearbyProvider[] = (placesData.results || [])
      .slice(0, 10) // Limiter à 10 résultats
      .map((place: GooglePlaceResult) => {
        // Calculer la distance approximative
        const distance = calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng
        );

        return {
          id: place.place_id,
          name: place.name,
          address: place.formatted_address || "",
          distance_km: Math.round(distance * 10) / 10,
          rating: place.rating,
          reviews_count: place.user_ratings_total,
          phone: place.formatted_phone_number || place.international_phone_number,
          is_open: place.opening_hours?.open_now,
          photo_url: place.photos?.[0]?.photo_reference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photo_reference=${place.photos[0].photo_reference}&key=${googleApiKey}`
            : undefined,
          google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          source: "google" as const,
        };
      })
      .filter((p: NearbyProvider) => p.distance_km <= radius / 1000); // Filtrer par distance

    // Mettre en cache
    cache.set(cacheKey, { data: providers, timestamp: Date.now() });

    return NextResponse.json({
      providers,
      source: "google",
      total: providers.length,
      search_location: { lat: latitude, lng: longitude },
    });
  } catch (error) {
    console.error("Erreur API providers/nearby:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Calculer la distance entre deux points (formule de Haversine)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Données de démonstration quand l'API n'est pas configurée
function getDemoProviders(category: string): NearbyProvider[] {
  const demoData: Record<string, NearbyProvider[]> = {
    plomberie: [
      {
        id: "demo-1",
        name: "Plomberie Express",
        address: "12 rue du Commerce",
        distance_km: 2.3,
        rating: 4.7,
        reviews_count: 89,
        phone: "0596 12 34 56",
        is_open: true,
        google_maps_url: "https://maps.google.com/?q=plombier",
        source: "google",
      },
      {
        id: "demo-2",
        name: "SOS Plombier 972",
        address: "45 avenue des Caraïbes",
        distance_km: 4.1,
        rating: 4.5,
        reviews_count: 156,
        phone: "0696 78 90 12",
        is_open: true,
        google_maps_url: "https://maps.google.com/?q=plombier",
        source: "google",
      },
    ],
    electricite: [
      {
        id: "demo-3",
        name: "Électricité Martinique",
        address: "8 boulevard du Général de Gaulle",
        distance_km: 1.8,
        rating: 4.9,
        reviews_count: 203,
        phone: "0596 45 67 89",
        is_open: true,
        google_maps_url: "https://maps.google.com/?q=electricien",
        source: "google",
      },
    ],
    serrurerie: [
      {
        id: "demo-4",
        name: "Serrurier Antilles",
        address: "23 rue Victor Hugo",
        distance_km: 3.2,
        rating: 4.6,
        reviews_count: 78,
        phone: "0696 11 22 33",
        is_open: false,
        google_maps_url: "https://maps.google.com/?q=serrurier",
        source: "google",
      },
    ],
    default: [
      {
        id: "demo-5",
        name: "Multi-Services Pro",
        address: "15 rue de la Liberté",
        distance_km: 2.5,
        rating: 4.4,
        reviews_count: 112,
        phone: "0596 99 88 77",
        is_open: true,
        google_maps_url: "https://maps.google.com/?q=artisan",
        source: "google",
      },
    ],
  };

  return demoData[category] || demoData.default;
}

