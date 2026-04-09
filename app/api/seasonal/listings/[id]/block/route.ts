export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const blockSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).default("owner_block"),
});

/**
 * POST /api/seasonal/listings/[id]/block — Bloquer des dates
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

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

    const body = await request.json();
    const parsed = blockSchema.parse(body);

    if (new Date(parsed.end_date) < new Date(parsed.start_date)) {
      throw new ApiError(400, "La date de fin doit être postérieure ou égale à la date de début");
    }

    // Check for conflicting reservations
    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", id)
      .not("status", "in", '("cancelled","no_show")')
      .lte("check_in", parsed.end_date)
      .gte("check_out", parsed.start_date);

    if (count && count > 0) {
      throw new ApiError(409, "Impossible de bloquer : des réservations existent sur cette période");
    }

    const { data: blocked, error: insertError } = await supabase
      .from("seasonal_blocked_dates")
      .insert({ ...parsed, listing_id: id })
      .select()
      .single();

    if (insertError) throw new ApiError(500, insertError.message);

    return NextResponse.json({ blocked }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
