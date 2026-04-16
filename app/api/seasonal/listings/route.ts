export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { fetchPropertyCoverUrls } from "@/lib/properties/cover-url";

const createListingSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  min_nights: z.number().int().min(1).default(1),
  max_nights: z.number().int().min(1).default(90),
  max_guests: z.number().int().min(1).default(4),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/).default("11:00"),
  house_rules: z.string().max(5000).optional(),
  amenities: z.array(z.string()).default([]),
  cleaning_fee_cents: z.number().int().min(0).default(0),
  security_deposit_cents: z.number().int().min(0).default(0),
  tourist_tax_per_night_cents: z.number().int().min(0).default(0),
});

/**
 * GET /api/seasonal/listings — Liste des annonces saisonnières du propriétaire
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "agency" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: listings, error: listError } = await supabase
      .from("seasonal_listings")
      .select(`
        *,
        property:properties!property_id(
          id, adresse_complete, ville, code_postal
        )
      `)
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });

    if (listError) throw new ApiError(500, listError.message);

    // Enrichir avec cover_url (depuis la table photos)
    const rows = (listings ?? []) as any[];
    const propertyIds = rows
      .map((l: any) => l.property?.id)
      .filter((id: any): id is string => !!id);
    const coverMap = await fetchPropertyCoverUrls(supabase, propertyIds);
    for (const row of rows) {
      if (row.property?.id) {
        row.property.cover_url = coverMap.get(row.property.id) ?? null;
      }
    }

    return NextResponse.json({ listings: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/seasonal/listings — Créer une annonce saisonnière
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "agency" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const body = await request.json();
    const parsed = createListingSchema.parse(body);

    // Verify property belongs to owner
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", parsed.property_id)
      .eq("owner_id", profile.id)
      .single();

    if (!property) {
      throw new ApiError(404, "Bien non trouvé ou non autorisé");
    }

    const { data: listing, error: insertError } = await supabase
      .from("seasonal_listings")
      .insert({
        ...parsed,
        owner_id: profile.id,
      })
      .select()
      .single();

    if (insertError) throw new ApiError(500, insertError.message);

    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
