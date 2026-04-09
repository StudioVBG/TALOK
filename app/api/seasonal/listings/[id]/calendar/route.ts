export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import type { CalendarDay } from "@/lib/types/seasonal";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/seasonal/listings/[id]/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Retourne un tableau de jours avec leur statut (available, reserved, blocked, past)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    // Default: current month + 2 months
    const today = new Date();
    const from = fromParam ? new Date(fromParam) : new Date(today.getFullYear(), today.getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(today.getFullYear(), today.getMonth() + 3, 0);

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    // Verify ownership
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Accès refusé");

    const { data: listing } = await supabase
      .from("seasonal_listings")
      .select("id")
      .eq("id", id)
      .eq("owner_id", profile.id)
      .single();

    if (!listing) throw new ApiError(404, "Annonce non trouvée");

    // Fetch reservations and blocked dates in parallel
    const [reservationsRes, blockedRes] = await Promise.all([
      supabase
        .from("reservations")
        .select("id, guest_name, source, status, check_in, check_out")
        .eq("listing_id", id)
        .not("status", "in", '("cancelled","no_show")')
        .lte("check_in", toStr)
        .gte("check_out", fromStr),
      supabase
        .from("seasonal_blocked_dates")
        .select("id, start_date, end_date, reason")
        .eq("listing_id", id)
        .lte("start_date", toStr)
        .gte("end_date", fromStr),
    ]);

    const reservations = reservationsRes.data ?? [];
    const blocked = blockedRes.data ?? [];

    // Build calendar days
    const days: CalendarDay[] = [];
    const todayStr = today.toISOString().split("T")[0];
    const cursor = new Date(from);

    while (cursor <= to) {
      const dateStr = cursor.toISOString().split("T")[0];

      let status: CalendarDay["status"] = "available";
      let reservation_id: string | undefined;
      let reservation: CalendarDay["reservation"] | undefined;

      if (dateStr < todayStr) {
        status = "past";
      }

      // Check reservations
      for (const r of reservations) {
        if (dateStr >= r.check_in && dateStr < r.check_out) {
          status = r.status === "checked_in" ? "checked_in" : "reserved";
          reservation_id = r.id;
          reservation = {
            id: r.id,
            guest_name: r.guest_name,
            source: r.source,
            status: r.status,
          };
          break;
        }
      }

      // Check blocked dates (only if not reserved)
      if (status === "available" || status === "past") {
        for (const b of blocked) {
          if (dateStr >= b.start_date && dateStr <= b.end_date) {
            status = "blocked";
            break;
          }
        }
      }

      days.push({ date: dateStr, status, reservation_id, reservation });
      cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json({ days });
  } catch (err) {
    return handleApiError(err);
  }
}
