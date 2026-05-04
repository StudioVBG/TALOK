export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// API: Favoris prestataires externes (Google Places / démo)
// GET   /api/providers/external-favorites          → liste
// POST  /api/providers/external-favorites          → upsert
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/lib/supabase/server";

interface ExternalFavoritePayload {
  place_id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  google_maps_url?: string | null;
  notes?: string | null;
  source?: "google" | "demo" | "manual" | "osm" | null;
}

async function getOwnerProfileId(): Promise<{
  ok: true;
  profileId: string;
  supabase: Awaited<ReturnType<typeof createRouteHandlerClient>>;
} | { ok: false; response: NextResponse }> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Profil non trouvé" }, { status: 404 }),
    };
  }

  return { ok: true, profileId: profile.id, supabase };
}

export async function GET() {
  const ctx = await getOwnerProfileId();
  if (!ctx.ok) return ctx.response;

  const { data, error } = await (ctx.supabase as any)
    .from("provider_external_favorites")
    .select("*")
    .eq("owner_profile_id", ctx.profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[external-favorites] GET error:", error);
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  return NextResponse.json({ favorites: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getOwnerProfileId();
  if (!ctx.ok) return ctx.response;

  let body: ExternalFavoritePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide" }, { status: 400 });
  }

  if (!body.place_id || !body.name) {
    return NextResponse.json(
      { error: "Champs requis : place_id, name" },
      { status: 400 },
    );
  }

  const { data, error } = await (ctx.supabase as any)
    .from("provider_external_favorites")
    .upsert(
      {
        owner_profile_id: ctx.profileId,
        place_id: body.place_id,
        name: body.name,
        category: body.category ?? null,
        address: body.address ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        rating: body.rating ?? null,
        reviews_count: body.reviews_count ?? null,
        google_maps_url: body.google_maps_url ?? null,
        notes: body.notes ?? null,
        source: body.source ?? "google",
      },
      { onConflict: "owner_profile_id,place_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[external-favorites] POST error:", error);
    return NextResponse.json({ error: "Erreur d'enregistrement" }, { status: 500 });
  }

  return NextResponse.json({ favorite: data });
}
