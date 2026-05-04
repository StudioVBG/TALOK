export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// Backfill géocodage des artisans Talok
// POST /api/admin/providers/geocode-backfill
// Réservé aux admins. Géocode tous les `providers` qui n'ont pas
// encore de lat/lng et persiste les coordonnées.
//
// Throttle : 1 req/sec vers Nominatim (politique de l'OSM Foundation).
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { geocodeAndSaveProvider } from "@/lib/services/provider-geocoding";

const NOMINATIM_DELAY_MS = 1100;

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) {
    return NextResponse.json(
      { error: adminCheck.error.message },
      { status: adminCheck.error.status },
    );
  }

  const supabase = getServiceClient();

  // Limite raisonnable par appel pour ne pas saturer Nominatim ni le runtime.
  const limit = Math.min(
    Number(new URL(request.url).searchParams.get("limit") ?? "50") || 50,
    200,
  );

  const { data: pending, error } = await supabase
    .from("providers")
    .select("id, address, postal_code, city")
    .is("latitude", null)
    .not("address", "is", null)
    .limit(limit);

  if (error) {
    console.error("[geocode-backfill] query error:", error);
    return NextResponse.json({ error: "Erreur base de données" }, { status: 500 });
  }

  let geocoded = 0;
  let failed = 0;

  for (const row of pending ?? []) {
    const ok = await geocodeAndSaveProvider(row.id);
    if (ok) geocoded += 1;
    else failed += 1;
    // Throttle pour respecter la usage policy Nominatim.
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_DELAY_MS));
  }

  return NextResponse.json({
    processed: pending?.length ?? 0,
    geocoded,
    failed,
    remaining_hint: "Relancer l'endpoint si processed === limit pour traiter le reste.",
  });
}
