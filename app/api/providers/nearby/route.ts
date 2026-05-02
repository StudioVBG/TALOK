export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =====================================================
// API: Recherche de prestataires locaux via Google Places
// GET /api/providers/nearby
// Fonctionnalité PREMIUM (Confort+)
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { logGooglePlacesUsage } from "@/lib/services/google-places-usage";
import { getPlanLevel, type PlanSlug } from "@/lib/subscriptions/plans";

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
  website?: string;
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
  latitude: number;
  longitude: number;
  distance_km?: number;
  rating?: number;
  reviews_count?: number;
  phone?: string;
  website?: string;
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

    // Vérifier l'abonnement.
    // NB : la table `subscriptions` est scopée par `owner_id` (FK profiles.id),
    // pas `user_id`. L'ancienne requête `.eq("user_id", profile.id)` ne
    // matchait JAMAIS, donc planSlug retombait toujours sur "gratuit" et
    // tous les comptes — y compris entreprise — recevaient 403.
    // On accepte aussi `trialing` car un compte en période d'essai a accès
    // aux features de son plan.
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug, status")
      .eq("owner_id", profile.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    const planSlug: PlanSlug = (subscription?.plan_slug as PlanSlug) || "gratuit";
    // Confort+ = niveau confort ou supérieur (pro, enterprise_s/m/l/xl, legacy
    // enterprise). On compare via getPlanLevel pour ne pas oublier les variantes
    // entreprise — un slug `enterprise_s` n'aurait jamais matché la liste
    // hardcodée précédente.
    const isConfortOrHigher = getPlanLevel(planSlug) >= getPlanLevel("confort");

    if (!isConfortOrHigher) {
      return NextResponse.json(
        {
          error: "premium_required",
          message: "Cette fonctionnalité nécessite un plan Confort ou supérieur",
          upgrade_url: "/owner/money?tab=forfait",
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

    // Créer une clé de cache
    const cacheKey = `${category}-${lat.toFixed(2)}-${lng.toFixed(2)}-${radius}`;

    // Vérifier le cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      void logGooglePlacesUsage({
        endpoint: "text_search",
        source: "cache",
        status: "ok",
        category,
        userId: user.id,
        resultsCount: cached.data.length,
        cacheHit: true,
      });
      return NextResponse.json({
        providers: cached.data,
        source: "cache",
        cached: true,
      });
    }

    // Si on a une adresse mais pas de coordonnées, géocoder via Google (si dispo)
    // ou via Nominatim (fallback gratuit OpenStreetMap)
    let latitude = lat;
    let longitude = lng;

    if ((!lat || !lng) && address) {
      if (googleApiKey) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
        const geocodeRes = await fetch(geocodeUrl);
        const geocodeData = await geocodeRes.json();

        const geocodeOk = !!geocodeData.results?.[0]?.geometry?.location;
        if (geocodeOk) {
          latitude = geocodeData.results[0].geometry.location.lat;
          longitude = geocodeData.results[0].geometry.location.lng;
        }
        void logGooglePlacesUsage({
          endpoint: "geocoding",
          source: "google",
          status: geocodeOk ? "ok" : "zero_results",
          userId: user.id,
          resultsCount: geocodeOk ? 1 : 0,
        });
      } else {
        // Fallback Nominatim
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=fr&limit=1`;
        const nominatimRes = await fetch(nominatimUrl, {
          headers: {
            "User-Agent": "Talok/1.0 (contact@talok.fr)",
            "Accept-Language": "fr",
          },
        });
        const nominatimData = await nominatimRes.json();
        if (nominatimData?.[0]?.lat && nominatimData?.[0]?.lon) {
          latitude = parseFloat(nominatimData[0].lat);
          longitude = parseFloat(nominatimData[0].lon);
        }
      }
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Coordonnées ou adresse requises" },
        { status: 400 }
      );
    }

    // Sans clé API Google : retourner des données de démonstration centrées sur le bien
    if (!googleApiKey) {
      const demo = getDemoProviders(category, latitude, longitude);
      void logGooglePlacesUsage({
        endpoint: "text_search",
        source: "demo",
        status: "ok",
        category,
        userId: user.id,
        resultsCount: demo.length,
      });
      return NextResponse.json({
        providers: demo,
        source: "demo",
        search_location: { lat: latitude, lng: longitude },
        message: "Mode démonstration - Configurez GOOGLE_PLACES_API_KEY pour les vrais résultats",
      });
    }

    // Rechercher via Google Places API (Text Search)
    const searchTerm = CATEGORY_TO_SEARCH_TERM[category] || "artisan dépannage";
    const textSearchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchTerm)}&location=${latitude},${longitude}&radius=${radius}&language=fr&key=${googleApiKey}`;

    const placesRes = await fetch(textSearchUrl);
    const placesData = await placesRes.json();

    if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
      console.error("Google Places API error:", placesData.status, placesData.error_message);
      void logGooglePlacesUsage({
        endpoint: "text_search",
        source: "google",
        status: "error",
        category,
        userId: user.id,
        metadata: {
          google_status: placesData.status,
          google_error: placesData.error_message,
        },
      });
      const demo = getDemoProviders(category, latitude, longitude);
      return NextResponse.json({
        providers: demo,
        source: "demo",
        search_location: { lat: latitude, lng: longitude },
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
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          distance_km: Math.round(distance * 10) / 10,
          rating: place.rating,
          reviews_count: place.user_ratings_total,
          phone: place.formatted_phone_number || place.international_phone_number,
          website: place.website,
          is_open: place.opening_hours?.open_now,
          photo_url: place.photos?.[0]?.photo_reference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photo_reference=${place.photos[0].photo_reference}&key=${googleApiKey}`
            : undefined,
          google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          source: "google" as const,
        };
      })
      .filter((p: NearbyProvider) => (p.distance_km ?? 0) <= radius / 1000); // Filtrer par distance

    // Mettre en cache
    cache.set(cacheKey, { data: providers, timestamp: Date.now() });

    void logGooglePlacesUsage({
      endpoint: "text_search",
      source: "google",
      status: providers.length === 0 ? "zero_results" : "ok",
      category,
      userId: user.id,
      resultsCount: providers.length,
    });

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
// Distribuées sur un anneau autour du bien sélectionné pour rester réalistes
// quel que soit le département (métropole ou DROM-COM).
function getDemoProviders(
  category: string,
  centerLat = 14.6161,
  centerLng = -61.0588,
): NearbyProvider[] {
  const offsetKm = (km: number) => km / 111; // ~1° lat ≈ 111 km

  // Place une entrée à `distanceKm` du centre, sur une orientation `angleDeg`.
  const place = (distanceKm: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    const lonScale = Math.cos((centerLat * Math.PI) / 180) || 1;
    return {
      lat: centerLat + offsetKm(distanceKm * Math.cos(rad)),
      lng: centerLng + offsetKm(distanceKm * Math.sin(rad)) / lonScale,
    };
  };

  const mapsLink = (term: string) =>
    `https://www.google.com/maps/search/${encodeURIComponent(term)}/@${centerLat},${centerLng},13z`;

  type Seed = {
    id: string;
    name: string;
    address: string;
    distanceKm: number;
    angle: number;
    rating: number;
    reviews_count: number;
    phone: string;
    is_open: boolean;
    mapsTerm: string;
    website?: string;
  };

  const build = (seeds: Seed[]): NearbyProvider[] =>
    seeds.map((s) => {
      const { lat, lng } = place(s.distanceKm, s.angle);
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        latitude: lat,
        longitude: lng,
        distance_km: Math.round(s.distanceKm * 10) / 10,
        rating: s.rating,
        reviews_count: s.reviews_count,
        phone: s.phone,
        website: s.website,
        is_open: s.is_open,
        google_maps_url: mapsLink(s.mapsTerm),
        source: "google" as const,
      };
    });

  const demoData: Record<string, NearbyProvider[]> = {
    plomberie: build([
      { id: "demo-plo-1", name: "Plomberie Express 972", address: "12 rue du Commerce", distanceKm: 1.8, angle: 35, rating: 4.7, reviews_count: 89, phone: "0596 12 34 56", is_open: true, mapsTerm: "plombier" },
      { id: "demo-plo-2", name: "SOS Plombier Antilles", address: "45 avenue des Caraïbes", distanceKm: 3.6, angle: 110, rating: 4.5, reviews_count: 156, phone: "0696 78 90 12", is_open: true, mapsTerm: "plombier" },
      { id: "demo-plo-3", name: "Aqua Services Caraïbes", address: "7 chemin de la Source", distanceKm: 5.2, angle: 200, rating: 4.3, reviews_count: 47, phone: "0596 22 11 33", is_open: true, mapsTerm: "plombier" },
      { id: "demo-plo-4", name: "Artisan Plomberie Locale", address: "18 lotissement les Manguiers", distanceKm: 7.1, angle: 280, rating: 4.6, reviews_count: 122, phone: "0696 55 44 77", is_open: false, mapsTerm: "plombier" },
      { id: "demo-plo-5", name: "Plomberie & Sanitaire Pro", address: "3 ZA Acajou Nord", distanceKm: 9.4, angle: 25, rating: 4.2, reviews_count: 64, phone: "0596 88 99 11", is_open: true, mapsTerm: "plombier" },
    ]),
    electricite: build([
      { id: "demo-ele-1", name: "Électricité Martinique", address: "8 boulevard du Général de Gaulle", distanceKm: 1.5, angle: 320, rating: 4.9, reviews_count: 203, phone: "0596 45 67 89", is_open: true, mapsTerm: "electricien" },
      { id: "demo-ele-2", name: "Élec Antilles Pro", address: "27 rue de la République", distanceKm: 3.0, angle: 60, rating: 4.6, reviews_count: 134, phone: "0696 23 56 78", is_open: true, mapsTerm: "electricien" },
      { id: "demo-ele-3", name: "Domotique & Élec Caraïbes", address: "14 lotissement Bel Air", distanceKm: 4.7, angle: 150, rating: 4.4, reviews_count: 71, phone: "0596 33 22 11", is_open: true, mapsTerm: "electricien domotique" },
      { id: "demo-ele-4", name: "SOS Électricien 24/7", address: "9 rue Schoelcher", distanceKm: 6.3, angle: 240, rating: 4.7, reviews_count: 188, phone: "0696 99 88 77", is_open: true, mapsTerm: "electricien urgence" },
      { id: "demo-ele-5", name: "Électricien Indépendant Diaz", address: "Quartier Bois Rouge", distanceKm: 8.2, angle: 10, rating: 4.3, reviews_count: 39, phone: "0596 77 11 44", is_open: false, mapsTerm: "electricien" },
      { id: "demo-ele-6", name: "Tropic Élec Services", address: "ZA La Galleria, lot 4", distanceKm: 11.5, angle: 295, rating: 4.5, reviews_count: 92, phone: "0696 12 88 33", is_open: true, mapsTerm: "electricien batiment" },
    ]),
    chauffage: build([
      { id: "demo-cha-1", name: "Clim Caraïbes Pro", address: "21 rue de la Marine", distanceKm: 2.4, angle: 75, rating: 4.8, reviews_count: 167, phone: "0596 66 22 88", is_open: true, mapsTerm: "climatisation" },
      { id: "demo-cha-2", name: "Froid & Climatisation 972", address: "5 ZA Champigny", distanceKm: 4.8, angle: 165, rating: 4.6, reviews_count: 98, phone: "0696 44 55 66", is_open: true, mapsTerm: "climatisation" },
      { id: "demo-cha-3", name: "Tropic'Air Service", address: "10 rue Lamartine", distanceKm: 6.9, angle: 250, rating: 4.4, reviews_count: 73, phone: "0596 33 88 99", is_open: false, mapsTerm: "climatisation depannage" },
      { id: "demo-cha-4", name: "Climatech Antilles", address: "33 avenue Maurice Bishop", distanceKm: 9.1, angle: 30, rating: 4.5, reviews_count: 124, phone: "0696 77 66 55", is_open: true, mapsTerm: "chauffagiste climatisation" },
    ]),
    serrurerie: build([
      { id: "demo-ser-1", name: "Serrurier Antilles", address: "23 rue Victor Hugo", distanceKm: 2.0, angle: 220, rating: 4.6, reviews_count: 78, phone: "0696 11 22 33", is_open: false, mapsTerm: "serrurier" },
      { id: "demo-ser-2", name: "SOS Serrure 972", address: "16 rue de la Liberté", distanceKm: 3.7, angle: 90, rating: 4.7, reviews_count: 142, phone: "0596 55 33 22", is_open: true, mapsTerm: "serrurier urgence" },
      { id: "demo-ser-3", name: "Clés & Sécurité Caraïbes", address: "8 rue Lazare Carnot", distanceKm: 5.5, angle: 160, rating: 4.4, reviews_count: 56, phone: "0696 22 99 11", is_open: true, mapsTerm: "serrurier" },
      { id: "demo-ser-4", name: "Artisan Serrurier Diaz", address: "Quartier Cité Dillon", distanceKm: 8.3, angle: 305, rating: 4.5, reviews_count: 91, phone: "0596 44 77 88", is_open: true, mapsTerm: "serrurier" },
    ]),
    menuiserie: build([
      { id: "demo-men-1", name: "Menuiserie Tropicale", address: "11 rue des Acacias", distanceKm: 2.6, angle: 55, rating: 4.8, reviews_count: 113, phone: "0596 22 33 44", is_open: true, mapsTerm: "menuisier" },
      { id: "demo-men-2", name: "Bois & Style Antilles", address: "29 ZA Place d'Armes", distanceKm: 4.4, angle: 145, rating: 4.5, reviews_count: 67, phone: "0696 88 22 11", is_open: true, mapsTerm: "menuiserie bois" },
      { id: "demo-men-3", name: "Atelier du Mahogany", address: "6 rue Schoelcher", distanceKm: 6.7, angle: 230, rating: 4.7, reviews_count: 88, phone: "0596 77 33 22", is_open: false, mapsTerm: "menuisier ebeniste" },
      { id: "demo-men-4", name: "Pose & Rénovation 972", address: "ZA Acajou Sud", distanceKm: 9.8, angle: 320, rating: 4.3, reviews_count: 41, phone: "0696 11 55 99", is_open: true, mapsTerm: "menuisier renovation" },
    ]),
    peinture: build([
      { id: "demo-pei-1", name: "Couleurs Caraïbes", address: "4 rue Ernest Deproge", distanceKm: 2.1, angle: 100, rating: 4.7, reviews_count: 95, phone: "0596 33 44 55", is_open: true, mapsTerm: "peintre batiment" },
      { id: "demo-pei-2", name: "Peinture Tropicale Pro", address: "17 lotissement les Hibiscus", distanceKm: 4.3, angle: 190, rating: 4.5, reviews_count: 72, phone: "0696 66 11 22", is_open: true, mapsTerm: "peintre" },
      { id: "demo-pei-3", name: "Déco & Façades 972", address: "12 ZA Place d'Armes", distanceKm: 6.0, angle: 280, rating: 4.4, reviews_count: 59, phone: "0596 99 22 33", is_open: false, mapsTerm: "peintre facade" },
      { id: "demo-pei-4", name: "Artisan Peintre Antillais", address: "31 rue Bouillé", distanceKm: 8.5, angle: 20, rating: 4.6, reviews_count: 104, phone: "0696 33 88 99", is_open: true, mapsTerm: "peintre interieur" },
    ]),
    nettoyage: build([
      { id: "demo-net-1", name: "Net' Antilles Services", address: "9 rue de la Liberté", distanceKm: 1.9, angle: 130, rating: 4.6, reviews_count: 88, phone: "0596 44 55 66", is_open: true, mapsTerm: "entreprise nettoyage" },
      { id: "demo-net-2", name: "Tropic Clean 972", address: "22 ZA Acajou", distanceKm: 3.8, angle: 215, rating: 4.7, reviews_count: 134, phone: "0696 55 22 11", is_open: true, mapsTerm: "nettoyage entreprise" },
      { id: "demo-net-3", name: "Propreté Caraïbes Pro", address: "5 rue Lamartine", distanceKm: 5.6, angle: 305, rating: 4.4, reviews_count: 62, phone: "0596 11 88 99", is_open: true, mapsTerm: "nettoyage fin de chantier" },
      { id: "demo-net-4", name: "Nettoyage Vitres & Sols", address: "14 rue Victor Schoelcher", distanceKm: 7.9, angle: 45, rating: 4.5, reviews_count: 79, phone: "0696 99 33 44", is_open: false, mapsTerm: "nettoyage vitres" },
    ]),
    jardinage: build([
      { id: "demo-jar-1", name: "Paysages Tropicaux 972", address: "3 chemin des Flamboyants", distanceKm: 2.7, angle: 70, rating: 4.8, reviews_count: 152, phone: "0596 77 88 99", is_open: true, mapsTerm: "paysagiste jardinier" },
      { id: "demo-jar-2", name: "Jardin Caraïbes Service", address: "18 lotissement Belle Étoile", distanceKm: 4.6, angle: 175, rating: 4.6, reviews_count: 84, phone: "0696 22 44 66", is_open: true, mapsTerm: "jardinier elagueur" },
      { id: "demo-jar-3", name: "Élagage & Espaces Verts", address: "27 rue de la Savane", distanceKm: 7.2, angle: 260, rating: 4.5, reviews_count: 71, phone: "0596 33 22 11", is_open: false, mapsTerm: "elagueur" },
      { id: "demo-jar-4", name: "Tropic'Garden Services", address: "ZA La Galleria", distanceKm: 10.4, angle: 350, rating: 4.4, reviews_count: 53, phone: "0696 88 77 66", is_open: true, mapsTerm: "entretien jardin" },
    ]),
    autre: build([
      { id: "demo-aut-1", name: "Multi-Services Pro 972", address: "15 rue de la Liberté", distanceKm: 2.3, angle: 120, rating: 4.4, reviews_count: 112, phone: "0596 99 88 77", is_open: true, mapsTerm: "artisan multi services" },
      { id: "demo-aut-2", name: "Bricolage Antilles", address: "8 ZA Place d'Armes", distanceKm: 4.1, angle: 235, rating: 4.5, reviews_count: 96, phone: "0696 11 33 55", is_open: true, mapsTerm: "homme toutes mains" },
      { id: "demo-aut-3", name: "Dépannage Express 24/7", address: "21 avenue des Caraïbes", distanceKm: 6.5, angle: 30, rating: 4.6, reviews_count: 145, phone: "0596 22 99 88", is_open: true, mapsTerm: "depannage urgence" },
      { id: "demo-aut-4", name: "Petits Travaux & Rénovation", address: "Quartier Bois Rouge", distanceKm: 9.0, angle: 195, rating: 4.3, reviews_count: 58, phone: "0696 44 66 88", is_open: false, mapsTerm: "petits travaux" },
    ]),
  };

  // Alias `default` pour rétro-compat avec d'éventuels appels historiques.
  return demoData[category] || demoData.autre;
}

