export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Détails d'un prestataire Google Places
// GET /api/providers/place-details/[placeId]
//
// Le Text Search ne renvoie pas le site web ni le téléphone : on récupère
// ces champs via Place Details au moment où l'utilisateur ouvre la fiche
// détail d'un prestataire. Cache 24h en mémoire (mêmes contraintes que
// /api/providers/nearby) pour limiter le coût (17 $ / 1000 appels).
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";
import { logGooglePlacesUsage } from "@/lib/services/google-places-usage";
import { checkGooglePlacesQuota } from "@/lib/rate-limit/google-places";
import { getRedis } from "@/lib/rate-limit/upstash";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";

interface PlaceDetailsResult {
  website?: string;
  phone?: string;
  google_maps_url?: string;
}

const CACHE_TTL_SEC = 24 * 60 * 60; // 24h
const CACHE_PREFIX = "providers:place_details:v1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> },
) {
  const { placeId } = await params;
  if (!placeId) {
    return NextResponse.json({ error: "placeId manquant" }, { status: 400 });
  }

  // Les IDs OSM (préfixe "osm-") ne sont pas des place_id Google : court-circuit.
  // (L'ancien préfixe "demo-" est conservé pour rétro-compat avec les caches/favoris créés avant la bascule OSM.)
  if (placeId.startsWith("osm-") || placeId.startsWith("demo-")) {
    return NextResponse.json({ details: {} as PlaceDetailsResult });
  }

  try {
    const supabase = await createRouteHandlerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Même feature gate que /nearby (Pro+, via providers_management).
    const featureCheck = await withFeatureAccess(profile.id, "providers_management");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: "premium_required",
          message: featureCheck.message,
          upgrade_url: "/owner/money?tab=forfait",
          required_plan: featureCheck.requiredPlan,
        },
        { status: 403 },
      );
    }

    // Rate-limit Google Places (Place Details = ~17$/1000 appels).
    const quota = await checkGooglePlacesQuota({
      scope: "place_details",
      userId: user.id,
      request,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Trop de consultations de fiches. Réessayez plus tard." },
        { status: 429, headers: quota.headers },
      );
    }

    // Cache Redis (place_details Google = ~17$/1000 appels, ça vaut le partage
    // entre lambdas).
    const cacheKey = `${CACHE_PREFIX}:${placeId}`;
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get<PlaceDetailsResult>(cacheKey);
        if (cached && typeof cached === "object") {
          void logGooglePlacesUsage({
            endpoint: "place_details",
            source: "cache",
            status: "ok",
            userId: user.id,
            cacheHit: true,
          });
          return NextResponse.json({ details: cached, cached: true });
        }
      } catch (err) {
        console.warn("[providers/place-details] Redis read échoué:", err);
      }
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json({ details: {} as PlaceDetailsResult });
    }

    // Champs limités pour minimiser le coût (Place Details est facturé
    // par "field" au-delà du Basic data ; website + phone sont en Contact data).
    const fields = [
      "website",
      "formatted_phone_number",
      "international_phone_number",
      "url",
    ].join(",");
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&language=fr&key=${googleApiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK") {
      void logGooglePlacesUsage({
        endpoint: "place_details",
        source: "google",
        status: "error",
        userId: user.id,
        metadata: { google_status: data.status, google_error: data.error_message },
      });
      return NextResponse.json({ details: {} as PlaceDetailsResult });
    }

    const result: PlaceDetailsResult = {
      website: data.result?.website,
      phone:
        data.result?.formatted_phone_number ||
        data.result?.international_phone_number,
      google_maps_url: data.result?.url,
    };

    if (redis) {
      try {
        await redis.set(cacheKey, result, { ex: CACHE_TTL_SEC });
      } catch (err) {
        console.warn("[providers/place-details] Redis write échoué:", err);
      }
    }

    void logGooglePlacesUsage({
      endpoint: "place_details",
      source: "google",
      status: "ok",
      userId: user.id,
      resultsCount: 1,
    });

    return NextResponse.json({ details: result });
  } catch (error) {
    console.error("Erreur API providers/place-details:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
