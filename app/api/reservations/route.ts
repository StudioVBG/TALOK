export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { fetchPropertyCoverUrls } from "@/lib/properties/cover-url";

const createReservationSchema = z.object({
  listing_id: z.string().uuid(),
  guest_name: z.string().min(2).max(200),
  guest_email: z.string().email(),
  guest_phone: z.string().max(20).optional(),
  guest_count: z.number().int().min(1).default(1),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nightly_rate_cents: z.number().int().positive(),
  cleaning_fee_cents: z.number().int().min(0).default(0),
  deposit_cents: z.number().int().min(0).default(0),
  source: z.enum(["direct", "airbnb", "booking", "other"]).default("direct"),
  external_id: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
});

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from);
  const d2 = new Date(to);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * GET /api/reservations — Liste des réservations
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Accès refusé");

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const listing_id = url.searchParams.get("listing_id");

    let query = supabase
      .from("reservations")
      .select(`
        *,
        listing:seasonal_listings!listing_id(
          id, title, property_id,
          property:properties!property_id(id, adresse_complete, ville)
        )
      `)
      .in("listing_id",
        supabase
          .from("seasonal_listings")
          .select("id")
          .eq("owner_id", profile.id)
      )
      .order("check_in", { ascending: true });

    if (status) {
      query = query.eq("status", status);
    }
    if (listing_id) {
      query = query.eq("listing_id", listing_id);
    }

    const { data: reservations, error: fetchError } = await query;

    let rows: any[] = reservations ?? [];

    if (fetchError) {
      // Fallback: fetch listing IDs first, then filter
      const { data: listings } = await supabase
        .from("seasonal_listings")
        .select("id")
        .eq("owner_id", profile.id);

      const listingIds = (listings ?? []).map((l: { id: string }) => l.id);
      if (listingIds.length === 0) {
        return NextResponse.json({ reservations: [] });
      }

      let fallbackQuery = supabase
        .from("reservations")
        .select(`
          *,
          listing:seasonal_listings!listing_id(
            id, title, property_id,
            property:properties!property_id(id, adresse_complete, ville)
          )
        `)
        .in("listing_id", listingIds)
        .order("check_in", { ascending: true });

      if (status) fallbackQuery = fallbackQuery.eq("status", status);
      if (listing_id) fallbackQuery = fallbackQuery.eq("listing_id", listing_id);

      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) throw new ApiError(500, fallbackError.message);

      rows = fallbackData ?? [];
    }

    // Enrichir avec cover_url (depuis la table photos)
    const propertyIds = rows
      .map((r: any) => r.listing?.property?.id)
      .filter((id: any): id is string => !!id);
    const coverMap = await fetchPropertyCoverUrls(supabase, propertyIds);
    for (const r of rows) {
      if (r.listing?.property?.id) {
        r.listing.property.cover_url = coverMap.get(r.listing.property.id) ?? null;
      }
    }

    return NextResponse.json({ reservations: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/reservations — Créer une réservation
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Accès refusé");

    const body = await request.json();
    const parsed = createReservationSchema.parse(body);

    // Verify listing ownership
    const { data: listing } = await supabase
      .from("seasonal_listings")
      .select("id, property_id, tourist_tax_per_night_cents, cleaning_fee_cents, min_nights, max_nights, max_guests")
      .eq("id", parsed.listing_id)
      .eq("owner_id", profile.id)
      .single();

    if (!listing) throw new ApiError(404, "Annonce non trouvée");

    // Validate dates
    const nights = daysBetween(parsed.check_in, parsed.check_out);
    if (nights < 1) throw new ApiError(400, "Le check-out doit être après le check-in");
    if (nights < listing.min_nights) throw new ApiError(400, `Minimum ${listing.min_nights} nuit(s)`);
    if (nights > listing.max_nights) throw new ApiError(400, `Maximum ${listing.max_nights} nuit(s)`);
    if (parsed.guest_count > listing.max_guests) throw new ApiError(400, `Maximum ${listing.max_guests} voyageur(s)`);

    // Calculate totals
    const subtotal_cents = parsed.nightly_rate_cents * nights;
    const tourist_tax_cents = listing.tourist_tax_per_night_cents * nights;
    const cleaning = parsed.cleaning_fee_cents || listing.cleaning_fee_cents || 0;
    const total_cents = subtotal_cents + cleaning + tourist_tax_cents;

    const { data: reservation, error: insertError } = await supabase
      .from("reservations")
      .insert({
        listing_id: parsed.listing_id,
        property_id: listing.property_id,
        guest_name: parsed.guest_name,
        guest_email: parsed.guest_email,
        guest_phone: parsed.guest_phone,
        guest_count: parsed.guest_count,
        check_in: parsed.check_in,
        check_out: parsed.check_out,
        nights,
        nightly_rate_cents: parsed.nightly_rate_cents,
        subtotal_cents,
        cleaning_fee_cents: cleaning,
        tourist_tax_cents,
        total_cents,
        deposit_cents: parsed.deposit_cents,
        source: parsed.source,
        external_id: parsed.external_id,
        status: parsed.status,
        notes: parsed.notes,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.message.includes("no_overlap") || insertError.message.includes("exclusion")) {
        throw new ApiError(409, "Les dates sont déjà réservées");
      }
      throw new ApiError(500, insertError.message);
    }

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
