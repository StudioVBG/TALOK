export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";

/**
 * POST /api/cron/seasonal-cleaning — Rappels ménage
 * Cron job qui détecte les check-outs du jour et envoie des rappels ménage
 * Appelé par un cron externe (ex: Vercel Cron, Upstash QStash)
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // Find reservations checking out today or tomorrow with pending cleaning
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select(`
        id, guest_name, check_out, cleaning_status, cleaning_provider_id,
        listing:seasonal_listings!listing_id(
          id, title, owner_id,
          property:properties!property_id(id, adresse_complete, ville)
        )
      `)
      .in("check_out", [today, tomorrow])
      .eq("cleaning_status", "pending")
      .in("status", ["checked_in", "confirmed"]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let scheduled = 0;
    let notified = 0;

    for (const reservation of reservations ?? []) {
      // Auto-schedule cleaning for reservations with a provider assigned
      if (reservation.cleaning_provider_id) {
        await supabase
          .from("reservations")
          .update({ cleaning_status: "scheduled" })
          .eq("id", reservation.id);
        scheduled++;
      }

      // Notify the owner about pending cleaning
      if (reservation.listing?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("user_id, email, prenom")
          .eq("id", reservation.listing.owner_id)
          .single();

        if (ownerProfile?.user_id) {
          // Insert notification
          await supabase.from("notifications").insert({
            user_id: ownerProfile.user_id,
            type: "cleaning_reminder",
            title: "Ménage à planifier",
            message: `Ménage à prévoir pour "${reservation.listing.title}" — check-out de ${reservation.guest_name} le ${reservation.check_out}`,
            data: {
              reservation_id: reservation.id,
              listing_id: reservation.listing.id,
              check_out: reservation.check_out,
            },
          });
          notified++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: (reservations ?? []).length,
      scheduled,
      notified,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
