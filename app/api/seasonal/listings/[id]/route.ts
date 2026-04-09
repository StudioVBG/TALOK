export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateListingSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional(),
  min_nights: z.number().int().min(1).optional(),
  max_nights: z.number().int().min(1).optional(),
  max_guests: z.number().int().min(1).optional(),
  check_in_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  check_out_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  house_rules: z.string().max(5000).optional(),
  amenities: z.array(z.string()).optional(),
  cleaning_fee_cents: z.number().int().min(0).optional(),
  security_deposit_cents: z.number().int().min(0).optional(),
  tourist_tax_per_night_cents: z.number().int().min(0).optional(),
  is_published: z.boolean().optional(),
});

async function getOwnerProfile(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", userId)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "agency" && profile.role !== "admin")) {
    throw new ApiError(403, "Accès réservé aux propriétaires");
  }
  return profile;
}

/**
 * GET /api/seasonal/listings/[id] — Détail d'une annonce
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const profile = await getOwnerProfile(supabase, user.id);

    const { data: listing, error: fetchError } = await supabase
      .from("seasonal_listings")
      .select(`
        *,
        property:properties!property_id(
          id, adresse_complete, ville, code_postal, cover_url
        )
      `)
      .eq("id", id)
      .eq("owner_id", profile.id)
      .single();

    if (fetchError || !listing) throw new ApiError(404, "Annonce non trouvée");

    return NextResponse.json({ listing });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/seasonal/listings/[id] — Modifier une annonce
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const profile = await getOwnerProfile(supabase, user.id);
    const body = await request.json();
    const parsed = updateListingSchema.parse(body);

    const { data: listing, error: updateError } = await supabase
      .from("seasonal_listings")
      .update(parsed)
      .eq("id", id)
      .eq("owner_id", profile.id)
      .select()
      .single();

    if (updateError || !listing) throw new ApiError(404, "Annonce non trouvée");

    return NextResponse.json({ listing });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/seasonal/listings/[id] — Supprimer une annonce
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    const profile = await getOwnerProfile(supabase, user.id);

    // Check for active reservations
    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("listing_id", id)
      .in("status", ["pending", "confirmed", "checked_in"]);

    if (count && count > 0) {
      throw new ApiError(409, "Impossible de supprimer : des réservations actives existent");
    }

    const { error: deleteError } = await supabase
      .from("seasonal_listings")
      .delete()
      .eq("id", id)
      .eq("owner_id", profile.id);

    if (deleteError) throw new ApiError(500, deleteError.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
