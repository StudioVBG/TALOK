export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { fetchPropertyCoverUrl } from "@/lib/properties/cover-url";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateReservationSchema = z.object({
  guest_name: z.string().min(2).max(200).optional(),
  guest_email: z.string().email().optional(),
  guest_phone: z.string().max(20).optional(),
  guest_count: z.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
  cleaning_status: z.enum(["pending", "scheduled", "done"]).optional(),
  cleaning_provider_id: z.string().uuid().optional(),
});

async function getReservationWithAuth(supabase: any, reservationId: string, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (!profile) throw new ApiError(403, "Accès refusé");

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(`
      *,
      listing:seasonal_listings!listing_id(id, title, owner_id,
        property:properties!property_id(id, adresse_complete, ville)
      )
    `)
    .eq("id", reservationId)
    .single();

  if (error || !reservation) throw new ApiError(404, "Réservation non trouvée");
  if (reservation.listing?.owner_id !== profile.id) throw new ApiError(403, "Accès refusé");

  // Enrichir avec cover_url (depuis la table photos)
  if (reservation.listing?.property?.id) {
    reservation.listing.property.cover_url = await fetchPropertyCoverUrl(
      supabase,
      reservation.listing.property.id,
    );
  }

  return { reservation, profile };
}

/**
 * GET /api/reservations/[id] — Détail d'une réservation
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const { reservation } = await getReservationWithAuth(supabase, id, user.id);

    return NextResponse.json({ reservation });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/reservations/[id] — Modifier une réservation
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    await getReservationWithAuth(supabase, id, user.id);

    const body = await request.json();
    const parsed = updateReservationSchema.parse(body);

    const { data: updated, error: updateError } = await supabase
      .from("reservations")
      .update(parsed)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw new ApiError(500, updateError.message);

    return NextResponse.json({ reservation: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
