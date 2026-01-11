/**
 * Cron Job: Visit Reminders - SOTA 2026
 *
 * Sends reminder emails 24h and 1h before scheduled visits.
 * Should be triggered by Vercel Cron or similar scheduler.
 *
 * Recommended cron schedule: Every 30 minutes
 * 0,30 * * * *
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendVisitReminder } from "@/lib/emails/resend.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supabase admin client for cron operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey);
}

interface VisitBookingWithDetails {
  id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string | null;
  owner_notes: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  visit_slots: {
    slot_date: string;
    start_time: string;
    end_time: string;
    properties: {
      id: string;
      adresse_complete: string;
      ville: string;
      code_postal: string;
      profiles: {
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
      };
    };
  };
}

export async function GET(request: Request) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();

    // Calculate time windows
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Format for comparison
    const todayDate = now.toISOString().split("T")[0];
    const tomorrowDate = twentyFourHoursFromNow.toISOString().split("T")[0];

    // Get confirmed bookings that need reminders
    const { data: bookings, error } = await supabase
      .from("visit_bookings")
      .select(`
        id,
        tenant_name,
        tenant_email,
        tenant_phone,
        owner_notes,
        reminder_24h_sent,
        reminder_1h_sent,
        visit_slots (
          slot_date,
          start_time,
          end_time,
          properties (
            id,
            adresse_complete,
            ville,
            code_postal,
            profiles:owner_id (
              id,
              full_name,
              email,
              phone
            )
          )
        )
      `)
      .eq("status", "confirmed")
      .in("visit_slots.slot_date", [todayDate, tomorrowDate])
      .or("reminder_24h_sent.eq.false,reminder_1h_sent.eq.false");

    if (error) {
      console.error("[Visit Reminders] Query error:", error);
      return NextResponse.json(
        { error: "Database query failed", details: error.message },
        { status: 500 }
      );
    }

    const results = {
      processed: 0,
      reminders_24h_sent: 0,
      reminders_1h_sent: 0,
      errors: [] as string[],
    };

    // Process each booking
    for (const booking of (bookings || []) as unknown as VisitBookingWithDetails[]) {
      if (!booking.visit_slots || !booking.visit_slots.properties) {
        continue;
      }

      results.processed++;

      const slot = booking.visit_slots;
      const property = slot.properties;
      const owner = property.profiles;

      // Calculate visit datetime
      const visitDateTime = new Date(`${slot.slot_date}T${slot.start_time}`);
      const hoursUntilVisit = (visitDateTime.getTime() - now.getTime()) / (60 * 60 * 1000);

      const propertyAddress = `${property.adresse_complete}, ${property.code_postal} ${property.ville}`;
      const visitDate = new Date(slot.slot_date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const visitTime = `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}`;

      // Send 24h reminder (between 23-25 hours before)
      if (!booking.reminder_24h_sent && hoursUntilVisit <= 25 && hoursUntilVisit >= 23) {
        try {
          // Send to tenant
          await sendVisitReminder({
            recipientEmail: booking.tenant_email,
            recipientName: booking.tenant_name,
            propertyAddress,
            visitDate,
            visitTime,
            hoursBeforeVisit: 24,
            isOwner: false,
            contactName: owner.full_name,
            contactPhone: owner.phone || undefined,
            bookingId: booking.id,
          });

          // Send to owner
          await sendVisitReminder({
            recipientEmail: owner.email,
            recipientName: owner.full_name,
            propertyAddress,
            visitDate,
            visitTime,
            hoursBeforeVisit: 24,
            isOwner: true,
            contactName: booking.tenant_name,
            contactPhone: booking.tenant_phone || undefined,
            bookingId: booking.id,
          });

          // Mark as sent
          await supabase
            .from("visit_bookings")
            .update({ reminder_24h_sent: true })
            .eq("id", booking.id);

          results.reminders_24h_sent++;
        } catch (err: any) {
          results.errors.push(`24h reminder for ${booking.id}: ${err.message}`);
        }
      }

      // Send 1h reminder (between 0.5-1.5 hours before)
      if (!booking.reminder_1h_sent && hoursUntilVisit <= 1.5 && hoursUntilVisit >= 0.5) {
        try {
          // Send to tenant
          await sendVisitReminder({
            recipientEmail: booking.tenant_email,
            recipientName: booking.tenant_name,
            propertyAddress,
            visitDate,
            visitTime,
            hoursBeforeVisit: 1,
            isOwner: false,
            contactName: owner.full_name,
            contactPhone: owner.phone || undefined,
            bookingId: booking.id,
          });

          // Send to owner
          await sendVisitReminder({
            recipientEmail: owner.email,
            recipientName: owner.full_name,
            propertyAddress,
            visitDate,
            visitTime,
            hoursBeforeVisit: 1,
            isOwner: true,
            contactName: booking.tenant_name,
            contactPhone: booking.tenant_phone || undefined,
            bookingId: booking.id,
          });

          // Mark as sent
          await supabase
            .from("visit_bookings")
            .update({ reminder_1h_sent: true })
            .eq("id", booking.id);

          results.reminders_1h_sent++;
        } catch (err: any) {
          results.errors.push(`1h reminder for ${booking.id}: ${err.message}`);
        }
      }
    }

    console.log("[Visit Reminders] Completed:", results);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...results,
    });
  } catch (error: any) {
    console.error("[Visit Reminders] Fatal error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
