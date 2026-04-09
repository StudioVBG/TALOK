export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const rateSchema = z.object({
  season_name: z.enum(["haute", "basse", "moyenne", "fetes"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nightly_rate_cents: z.number().int().positive(),
  weekly_rate_cents: z.number().int().positive().optional(),
  monthly_rate_cents: z.number().int().positive().optional(),
  min_nights_override: z.number().int().min(1).optional(),
});

async function verifyListingOwnership(supabase: any, listingId: string, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!profile) throw new ApiError(403, "Accès refusé");

  const { data: listing } = await supabase
    .from("seasonal_listings")
    .select("id")
    .eq("id", listingId)
    .eq("owner_id", profile.id)
    .single();

  if (!listing) throw new ApiError(404, "Annonce non trouvée");
  return profile;
}

/**
 * GET /api/seasonal/listings/[id]/rates — Tarifs de l'annonce
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    await verifyListingOwnership(supabase, id, user.id);

    const { data: rates, error: fetchError } = await supabase
      .from("seasonal_rates")
      .select("*")
      .eq("listing_id", id)
      .order("start_date", { ascending: true });

    if (fetchError) throw new ApiError(500, fetchError.message);

    return NextResponse.json({ rates: rates ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/seasonal/listings/[id]/rates — Ajouter un tarif
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    await verifyListingOwnership(supabase, id, user.id);

    const body = await request.json();
    const parsed = rateSchema.parse(body);

    if (new Date(parsed.end_date) <= new Date(parsed.start_date)) {
      throw new ApiError(400, "La date de fin doit être postérieure à la date de début");
    }

    const { data: rate, error: insertError } = await supabase
      .from("seasonal_rates")
      .insert({ ...parsed, listing_id: id })
      .select()
      .single();

    if (insertError) throw new ApiError(500, insertError.message);

    return NextResponse.json({ rate }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/seasonal/listings/[id]/rates — Modifier un tarif (rate_id dans le body)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) throw new ApiError(401, "Non authentifié");

    await verifyListingOwnership(supabase, id, user.id);

    const body = await request.json();
    const { rate_id, ...fields } = body;

    if (!rate_id) throw new ApiError(400, "rate_id requis");

    const parsed = rateSchema.partial().parse(fields);

    const { data: rate, error: updateError } = await supabase
      .from("seasonal_rates")
      .update(parsed)
      .eq("id", rate_id)
      .eq("listing_id", id)
      .select()
      .single();

    if (updateError || !rate) throw new ApiError(404, "Tarif non trouvé");

    return NextResponse.json({ rate });
  } catch (err) {
    return handleApiError(err);
  }
}
