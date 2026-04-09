export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/reservations/[id]/check-out — Enregistrer le check-out
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

    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select(`
        id, status, cleaning_provider_id,
        listing:seasonal_listings!listing_id(owner_id)
      `)
      .eq("id", id)
      .single();

    if (fetchError || !reservation) throw new ApiError(404, "Réservation non trouvée");
    if (reservation.listing?.owner_id !== profile.id) throw new ApiError(403, "Accès refusé");

    if (reservation.status !== "checked_in") {
      throw new ApiError(400, `Check-out impossible : la réservation est en statut "${reservation.status}"`);
    }

    const updateData: Record<string, unknown> = {
      status: "checked_out",
      check_out_at: new Date().toISOString(),
    };

    // Auto-schedule cleaning if provider is set
    if (reservation.cleaning_provider_id) {
      updateData.cleaning_status = "scheduled";
    }

    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw new ApiError(500, updateError.message);

    return NextResponse.json({ reservation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
