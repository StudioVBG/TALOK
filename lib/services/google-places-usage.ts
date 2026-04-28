/**
 * Logger pour les appels à Google Places API
 * Permet le monitoring du quota gratuit (200 $/mois Maps Platform)
 *
 * Tarifs Google Maps Platform (avril 2026, en $ pour 1000 appels) :
 *  - Text Search    : 32 $
 *  - Nearby Search  : 32 $
 *  - Place Details  : 17 $
 *  - Geocoding      :  5 $
 *  - Place Photo    :  7 $
 */

import { getServiceClient } from "@/lib/supabase/service-client";

export type GooglePlacesEndpoint =
  | "text_search"
  | "nearby_search"
  | "place_details"
  | "geocoding"
  | "place_photo";

export type UsageSource = "google" | "cache" | "demo";
export type UsageStatus = "ok" | "error" | "zero_results";

const PRICE_PER_1000_USD: Record<GooglePlacesEndpoint, number> = {
  text_search: 32,
  nearby_search: 32,
  place_details: 17,
  geocoding: 5,
  place_photo: 7,
};

export const GOOGLE_FREE_CREDIT_USD = 200; // crédit mensuel offert par Google

export function estimateCostCents(endpoint: GooglePlacesEndpoint): number {
  // 32 $ / 1000 = 3.2 cents par appel
  return (PRICE_PER_1000_USD[endpoint] / 1000) * 100;
}

interface LogUsageParams {
  endpoint: GooglePlacesEndpoint;
  source: UsageSource;
  status: UsageStatus;
  category?: string;
  userId?: string | null;
  resultsCount?: number;
  cacheHit?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Enregistre un appel (ou un hit cache, ou un fallback démo) dans la table de monitoring.
 * Volontairement non-bloquant : on log mais on n'échoue jamais l'appel principal.
 */
export async function logGooglePlacesUsage(params: LogUsageParams): Promise<void> {
  try {
    const cost =
      params.source === "google" && params.status !== "error"
        ? estimateCostCents(params.endpoint)
        : 0;

    const supabase = getServiceClient();
    await supabase.from("google_places_usage").insert({
      endpoint: params.endpoint,
      source: params.source,
      status: params.status,
      category: params.category ?? null,
      user_id: params.userId ?? null,
      results_count: params.resultsCount ?? 0,
      estimated_cost_cents: cost,
      cache_hit: params.cacheHit ?? false,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    console.warn("[google-places-usage] Logging failed:", error);
  }
}
