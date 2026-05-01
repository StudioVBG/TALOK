export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Géocodage adresse -> coordonnées GPS
// GET /api/geocode?address=...&country=fr
// Google Geocoding (si GOOGLE_PLACES_API_KEY) -> Nominatim fallback
// =====================================================

import { NextRequest, NextResponse } from "next/server";

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
  const params = new URLSearchParams({
    format: "json",
    q: address,
    countrycodes: countryCode,
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
