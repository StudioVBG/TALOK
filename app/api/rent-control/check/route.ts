export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { rentControlCheckSchema } from "@/lib/validations/diagnostics";
import type { RentControlResult } from "@/lib/validations/diagnostics";

/**
 * POST /api/rent-control/check
 * Check if a rent is within the allowed range for a given city/type/surface.
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const body = await request.json();
    const parsed = rentControlCheckSchema.parse(body);

    const currentYear = new Date().getFullYear();
    const loyerM2 = parsed.loyer / parsed.surface;

    // Look up the reference rent
    let query = supabase
      .from("rent_control_zones")
      .select("*")
      .eq("city", parsed.city)
      .eq("type_logement", parsed.type_logement)
      .lte("year", currentYear)
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    // Try exact nb_pieces match first, then fallback
    if (parsed.nb_pieces <= 3) {
      query = query.eq("nb_pieces", parsed.nb_pieces);
    } else {
      // For 4+ pieces, use the 3-piece reference as a floor
      query = query.eq("nb_pieces", 3);
    }

    const { data: zones } = await query.limit(1);
    const zone = zones?.[0];

    if (!zone) {
      const result: RentControlResult = {
        in_zone: false,
        city: parsed.city,
        loyer_reference: null,
        loyer_majore: null,
        loyer_minore: null,
        loyer_m2: Math.round(loyerM2 * 100) / 100,
        is_over_limit: false,
        depassement: null,
      };
      return NextResponse.json(result);
    }

    const loyerMajoreTotal = zone.loyer_majore * parsed.surface;
    const isOverLimit = parsed.loyer > loyerMajoreTotal;
    const depassement = isOverLimit
      ? Math.round((parsed.loyer - loyerMajoreTotal) * 100) / 100
      : null;

    const result: RentControlResult = {
      in_zone: true,
      city: zone.city,
      loyer_reference: zone.loyer_reference,
      loyer_majore: zone.loyer_majore,
      loyer_minore: zone.loyer_minore,
      loyer_m2: Math.round(loyerM2 * 100) / 100,
      is_over_limit: isOverLimit,
      depassement,
    };

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
