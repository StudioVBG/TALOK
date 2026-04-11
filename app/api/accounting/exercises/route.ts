/**
 * API Route: Accounting Exercises
 * GET  /api/accounting/exercises - List exercises for an entity
 * POST /api/accounting/exercises - Create a new exercise
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { createExercise } from "@/lib/accounting/engine";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateExerciseSchema = z.object({
  entityId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * GET /api/accounting/exercises?entityId=...
 * List all exercises for an entity, ordered by start_date DESC.
 *
 * Auth via user-scoped client, DB reads via service client to avoid RLS
 * recursion (42P17) on profiles that otherwise produces 500s.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const { data: exercises, error } = await (serviceClient as any)
      .from("accounting_exercises")
      .select("*")
      .eq("entity_id", entityId)
      .order("start_date", { ascending: false });

    if (error) {
      console.error("[Exercises API] DB error:", error);
      throw new ApiError(500, "Erreur lors de la recuperation des exercices");
    }

    return NextResponse.json({ success: true, data: { exercises: exercises || [] } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/exercises
 * Create a new accounting exercise. Validates no date overlap with existing exercises.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateExerciseSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, startDate, endDate } = validation.data;

    if (startDate >= endDate) {
      throw new ApiError(400, "La date de debut doit etre anterieure a la date de fin");
    }

    // Check for overlapping exercises
    const { data: overlapping } = await (supabase as any)
      .from("accounting_exercises")
      .select("id")
      .eq("entity_id", entityId)
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .limit(1);

    if (overlapping && overlapping.length > 0) {
      throw new ApiError(409, "Un exercice existe deja sur cette periode");
    }

    const exercise = await createExercise(supabase, entityId, startDate, endDate);

    return NextResponse.json({ success: true, data: exercise }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
