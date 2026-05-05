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
import {
  extractPostalCode,
  postalCodeToCountryCodes,
} from "@/lib/properties/address";
import { checkGooglePlacesQuota } from "@/lib/rate-limit/google-places";

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
  // "autre" / Tout métier : terme volontairement large pour ne pas filtrer
  // les artisans isolés (très présents en DROM-COM où Google catégorise mal).
  autre: "artisan",
};

interface GooglePlaceResult {
  place_id: string;
  name: string;
  // formatted_address est renvoyé par Text Search ; Nearby Search renvoie
  // `vicinity` (rue + commune) à la place. On lit les deux pour rester
  // compatible avec les deux endpoints.
  formatted_address?: string;
  vicinity?: string;
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
  source: "google" | "osm";
}

// Mapping catégories → tags OpenStreetMap (Overpass).
// Utilisé pour le fallback réel quand Google Places n'est pas disponible.
// Pour `autre` (Tout métier) on inclut tous les métiers du bâtiment courants
// qui n'ont pas d'entrée dédiée dans l'UI (couvreur, maçon, carreleur, etc.) :
// le propriétaire ne doit pas être obligé de connaître la catégorie OSM
// exacte pour trouver une entreprise qui réalise les travaux.
const CATEGORY_TO_OSM_FILTERS: Record<string, string[]> = {
  plomberie: ["craft=plumber"],
  electricite: ["craft=electrician"],
  chauffage: ["craft=hvac", "craft=heating_engineer"],
  serrurerie: ["shop=locksmith", "craft=key_cutter"],
  menuiserie: ["craft=carpenter", "craft=cabinet_maker", "craft=joiner"],
  peinture: ["craft=painter"],
  nettoyage: ["office=cleaning", "craft=cleaning"],
  jardinage: ["craft=gardener", "craft=tree_surgeon"],
  autre: [
    "craft=handyman",
    "craft=builder",
    "craft=roofer",
    "craft=stonemason",
    "craft=tiler",
    "craft=plasterer",
    "craft=glazier",
    "craft=metal_construction",
    "shop=hardware",
    "shop=trade",
  ],
};

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

    // Rate-limit Google Places (per-user-hour, per-user-day, per-ip-hour).
    // Place avant le cache memoire car chaque requete (meme cachee) peut
    // potentiellement deboucher sur un appel Google.
    const quota = await checkGooglePlacesQuota({
      scope: "nearby",
      userId: user.id,
      request,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Trop de recherches de prestataires. Réessayez plus tard." },
        { status: 429, headers: quota.headers }
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
        // Fallback Nominatim — élargir aux codes pays DROM-COM si l'adresse
        // contient un code postal 97xxx, sinon Nominatim filtre l'adresse à
        // la métropole et géocode à 4500 km du vrai bien.
        const fallbackPostal = extractPostalCode(address);
        const countries =
          fallbackPostal && fallbackPostal.startsWith("97")
            ? postalCodeToCountryCodes(fallbackPostal)
            : "fr";
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=${countries}&limit=1`;
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

    // Sans clé API Google : recherche réelle via OpenStreetMap (Overpass API).
    // On ne renvoie plus de données de démonstration fictives — l'utilisateur voit
    // de vrais artisans présents dans OSM autour du bien sélectionné.
    if (!googleApiKey) {
      const osmResults = await searchOSMProviders(category, latitude, longitude, radius);
      cache.set(cacheKey, { data: osmResults, timestamp: Date.now() });
      void logGooglePlacesUsage({
        endpoint: "text_search",
        source: "osm",
        status: osmResults.length === 0 ? "zero_results" : "ok",
        category,
        userId: user.id,
        resultsCount: osmResults.length,
      });
      return NextResponse.json({
        providers: osmResults,
        source: "osm",
        total: osmResults.length,
        search_location: { lat: latitude, lng: longitude },
      });
    }

    // -------------------------------------------------------------------
    // Stratégie : Nearby Search d'abord (proximity-optimisé, respecte
    // strictement location + radius), puis fallback Text Search si zéro
    // résultat (Nearby Search filtre sur le `type` Google et peut rater
    // une boutique mal catégorisée).
    //
    // Les coordonnées renvoyées par Google (`geometry.location.lat/lng`)
    // sont les coordonnées rooftop officielles du commerce — c'est la
    // meilleure précision possible côté API.
    // -------------------------------------------------------------------
    // Fallback volontairement large : on ne biaise pas vers "dépannage" / 24h.
    // Toute entreprise qui propose le métier doit pouvoir remonter, le
    // propriétaire choisira ensuite qui contacter.
    const searchTerm = CATEGORY_TO_SEARCH_TERM[category] || "artisan";
    const googleTypes = CATEGORY_TO_GOOGLE_TYPE[category] || [];
    const primaryType = googleTypes[0]; // Nearby Search n'accepte qu'un seul type

    // Pour "autre" / Tout métier on retire toute contrainte de type Google :
    // `general_contractor` filtre la majorité des artisans indépendants
    // (zéro résultat sur Fort-de-France 20 km par exemple). On laisse le
    // keyword seul piloter la recherche.
    const isAllCategories = category === "autre";

    const buildNearbyUrl = () => {
      const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: String(radius),
        keyword: searchTerm,
        language: "fr",
        key: googleApiKey,
      });
      if (primaryType && !isAllCategories) params.set("type", primaryType);
      return `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
    };

    const buildTextSearchUrl = () =>
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchTerm)}&location=${latitude},${longitude}&radius=${radius}&language=fr&key=${googleApiKey}`;

    type GoogleSearchEndpoint = "nearby_search" | "text_search";
    let placesData: { status: string; results?: GooglePlaceResult[]; error_message?: string };
    let usedEndpoint: GoogleSearchEndpoint = "nearby_search";

    const nearbyRes = await fetch(buildNearbyUrl());
    placesData = await nearbyRes.json();

    if (placesData.status !== "OK" && placesData.status !== "ZERO_RESULTS") {
      console.error(
        "Google Places (nearby) error:",
        placesData.status,
        placesData.error_message,
      );
      void logGooglePlacesUsage({
        endpoint: "nearby_search",
        source: "google",
        status: "error",
        category,
        userId: user.id,
        metadata: {
          google_status: placesData.status,
          google_error: placesData.error_message,
        },
      });
      // Fallback OSM : on renvoie de vrais artisans depuis OpenStreetMap
      // plutôt que des données fictives.
      const osmResults = await searchOSMProviders(category, latitude, longitude, radius);
      cache.set(cacheKey, { data: osmResults, timestamp: Date.now() });
      return NextResponse.json({
        providers: osmResults,
        source: "osm",
        total: osmResults.length,
        search_location: { lat: latitude, lng: longitude },
      });
    }

    // Fallback Text Search si Nearby Search ne renvoie rien (le `type`
    // exact peut manquer pour des artisans indépendants).
    if (!placesData.results?.length) {
      const textRes = await fetch(buildTextSearchUrl());
      const textData = await textRes.json();

      if (textData.status === "OK") {
        placesData = textData;
        usedEndpoint = "text_search";
      } else if (
        textData.status !== "ZERO_RESULTS" &&
        textData.status !== "OK"
      ) {
        void logGooglePlacesUsage({
          endpoint: "text_search",
          source: "google",
          status: "error",
          category,
          userId: user.id,
          metadata: {
            google_status: textData.status,
            google_error: textData.error_message,
          },
        });
      }
    }

    // Transformer les résultats — coordonnées issues du rooftop Google.
    const providers: NearbyProvider[] = (placesData.results || [])
      .slice(0, 10)
      .map((place: GooglePlaceResult) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          place.geometry.location.lat,
          place.geometry.location.lng,
        );

        return {
          id: place.place_id,
          name: place.name,
          address: place.formatted_address || place.vicinity || "",
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
      // Garde-fou : Nearby Search peut occasionnellement renvoyer un
      // résultat juste hors rayon ; on filtre côté serveur pour éviter
      // un point qui apparaîtrait hors du cercle bleu sur la carte.
      .filter((p: NearbyProvider) => (p.distance_km ?? 0) <= radius / 1000);

    cache.set(cacheKey, { data: providers, timestamp: Date.now() });

    void logGooglePlacesUsage({
      endpoint: usedEndpoint,
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
      endpoint: usedEndpoint,
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

// Recherche réelle via Overpass API (OpenStreetMap) — fallback gratuit
// quand Google Places est indisponible (clé absente, REQUEST_DENIED, quota…).
// On retourne de vrais établissements géolocalisés à leur position OSM officielle.
async function searchOSMProviders(
  category: string,
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
): Promise<NearbyProvider[]> {
  // Pour "autre" / Tout métier on union TOUS les tags de toutes les
  // catégories. Sans ça, en DROM-COM (couverture OSM craft=* éparse) la
  // recherche ne retournait que `craft=handyman/builder` + `shop=hardware`
  // — quasi inexistants à Fort-de-France ou Cayenne, donc liste vide.
  const filters =
    category === "autre"
      ? Array.from(
          new Set(
            Object.entries(CATEGORY_TO_OSM_FILTERS)
              .filter(([key]) => key !== "autre")
              .flatMap(([, v]) => v)
              .concat(CATEGORY_TO_OSM_FILTERS.autre),
          ),
        )
      : CATEGORY_TO_OSM_FILTERS[category] || CATEGORY_TO_OSM_FILTERS.autre;

  // Union de nodes/ways pour chaque tag, dans le rayon demandé.
  const queryParts = filters
    .flatMap((filter) => {
      const [k, v] = filter.split("=");
      const around = `(around:${radiusMeters},${centerLat},${centerLng})`;
      return [
        `node["${k}"="${v}"]${around};`,
        `way["${k}"="${v}"]${around};`,
      ];
    })
    .join("\n");

  // Timeout 25s pour absorber les unions larges (catégorie "autre" → 17 tags
  // donc 34 sous-requêtes node+way). `out center tags 60` suffit largement
  // après dédup et tri par distance, on ne garde de toute façon que les 15
  // premiers côté serveur.
  const overpassQuery = `[out:json][timeout:25];(${queryParts});out center tags 60;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });
    if (!res.ok) {
      console.error("Overpass API error:", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data = (await res.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const seen = new Set<string>();
    const providers: NearbyProvider[] = [];

    for (const el of data.elements || []) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null) continue;

      const tags = el.tags || {};
      const name = tags.name || tags["name:fr"] || tags.brand;
      if (!name) continue;

      // Déduplique par nom + position arrondie (évite doublons node/way).
      const dedupeKey = `${name.toLowerCase()}@${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const street = [tags["addr:housenumber"], tags["addr:street"]]
        .filter(Boolean)
        .join(" ");
      const cityLine = [tags["addr:postcode"], tags["addr:city"] || tags["addr:place"]]
        .filter(Boolean)
        .join(" ");
      const address =
        [street, cityLine].filter(Boolean).join(", ") ||
        cityLine ||
        tags["addr:place"] ||
        "";

      const distance = calculateDistance(centerLat, centerLng, lat, lng);

      providers.push({
        id: `osm-${el.type}-${el.id}`,
        name,
        address,
        latitude: lat,
        longitude: lng,
        distance_km: Math.round(distance * 10) / 10,
        phone: tags.phone || tags["contact:phone"],
        website: tags.website || tags["contact:website"],
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${name} ${address}`.trim(),
        )}`,
        source: "osm",
      });
    }

    return providers
      .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
      .slice(0, 15);
  } catch (err) {
    console.error("Overpass fetch failed:", err);
    return [];
  }
}


