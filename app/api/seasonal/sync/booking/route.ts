export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { parseICalEvents, icalEventToReservation } from "@/features/seasonal/services/ical-parser";

const syncSchema = z.object({
  listing_id: z.string().uuid(),
  ical_url: z.string().url(),
});

/**
 * POST /api/seasonal/sync/booking — Sync iCal Booking.com
 * Importe les réservations depuis un feed iCal Booking.com
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
    const { listing_id, ical_url } = syncSchema.parse(body);

    const { data: listing } = await supabase
      .from("seasonal_listings")
      .select("id, property_id, tourist_tax_per_night_cents, cleaning_fee_cents")
      .eq("id", listing_id)
      .eq("owner_id", profile.id)
      .single();

    if (!listing) throw new ApiError(404, "Annonce non trouvée");

    // Fetch iCal feed
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let icalText: string;

    try {
      const res = await fetch(ical_url, { signal: controller.signal });
      if (!res.ok) throw new ApiError(502, "Impossible de récupérer le calendrier Booking.com");
      icalText = await res.text();
    } finally {
      clearTimeout(timeout);
    }

    const events = parseICalEvents(icalText);
    let imported = 0;
    let skipped = 0;

    for (const event of events) {
      const reservation = icalEventToReservation(event, listing_id, listing.property_id, "booking");
      if (!reservation) {
        skipped++;
        continue;
      }

      if (reservation.external_id) {
        const { count } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("listing_id", listing_id)
          .eq("external_id", reservation.external_id);

        if (count && count > 0) {
          skipped++;
          continue;
        }
      }

      const nights = Math.max(1, reservation.nights);
      const subtotal = reservation.nightly_rate_cents * nights;
      const tourist_tax = listing.tourist_tax_per_night_cents * nights;
      const total = subtotal + (listing.cleaning_fee_cents || 0) + tourist_tax;

      const { error: insertError } = await supabase
        .from("reservations")
        .insert({
          ...reservation,
          subtotal_cents: subtotal,
          cleaning_fee_cents: listing.cleaning_fee_cents || 0,
          tourist_tax_cents: tourist_tax,
          total_cents: total,
        });

      if (insertError) {
        skipped++;
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total_events: events.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
