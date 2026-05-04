export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Géocodage adresse -> coordonnées GPS
// GET /api/geocode?address=...&country=fr
// Google Geocoding (si GOOGLE_PLACES_API_KEY) -> Nominatim fallback
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import {
  extractPostalCode,
  postalCodeToCountryCodes,
} from "@/lib/properties/address";
import { createClient } from "@/lib/supabase/server";
import { checkGooglePlacesQuota } from "@/lib/rate-limit/google-places";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  displayName: string;
  source: "google" | "nominatim";
}

async function geocodeWithGoogle(
  address: string,
  apiKey: string,
  countryCode: string,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    key: apiKey,
    language: "fr",
    region: countryCode,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.results?.[0];
  if (!first?.geometry?.location) return null;
  return {
    latitude: first.geometry.location.lat,
    longitude: first.geometry.location.lng,
    displayName: first.formatted_address || address,
    source: "google",
  };
}

async function geocodeWithNominatim(
  address: string,
  countryCode: string,
): Promise<GeocodeResult | null> {
  // Si l'adresse contient un code postal DROM-COM (97xxx), on élargit
  // les pays autorisés — sinon Nominatim filtre sur la France métropole
  // et géocode l'adresse à 4500 km du vrai bien.
  const postal = extractPostalCode(address);
  const countries =
    postal && postal.startsWith("97")
      ? postalCodeToCountryCodes(postal)
      : countryCode;

  const params = new URLSearchParams({
    format: "json",
    q: address,
    countrycodes: countries,
    limit: "1",
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": "Talok/1.0 (contact@talok.fr)",
        "Accept-Language": "fr",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.[0];
  if (!first?.lat || !first?.lon) return null;
  return {
    latitude: parseFloat(first.lat),
    longitude: parseFloat(first.lon),
    displayName: first.display_name,
    source: "nominatim",
  };
}

export async function GET(request: NextRequest) {
  // Auth requise — l'ancien endpoint etait public, ce qui permettait a
  // n'importe qui de cramer le quota Google Geocoding (~$32/1000 appels).
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate-limit (per-user-hour, per-user-day, per-ip-hour).
  const quota = await checkGooglePlacesQuota({
    scope: "geocode",
    userId: user.id,
    request,
  });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes de géocodage. Réessayez plus tard." },
      { status: 429, headers: quota.headers },
    );
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();
  const countryCode = (searchParams.get("country") || "fr").toLowerCase();

  if (!address) {
    return NextResponse.json(
      { error: "Paramètre 'address' requis" },
      { status: 400 },
    );
  }

  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (googleApiKey) {
    try {
      const google = await geocodeWithGoogle(address, googleApiKey, countryCode);
      if (google) return NextResponse.json(google);
    } catch (err) {
      console.error("[/api/geocode] Google error:", err);
    }
  }

  try {
    const nominatim = await geocodeWithNominatim(address, countryCode);
    if (nominatim) return NextResponse.json(nominatim);
  } catch (err) {
    console.error("[/api/geocode] Nominatim error:", err);
  }

  return NextResponse.json(
    { error: "Adresse introuvable" },
    { status: 404 },
  );
}
