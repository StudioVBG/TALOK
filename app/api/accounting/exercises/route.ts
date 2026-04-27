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

    let rows: Array<Record<string, unknown>> = exercises ?? [];

    // Defensive bootstrap: if an entity somehow has no exercise (e.g. it
    // pre-dates the trigger added in 20260418170000_enforce_fiscal_year_dates,
    // or the trigger raced on a transient failure), create one on the fly
    // from the entity's fiscal-year fields. The dashboard, balance and
    // grand-livre all depend on having at least one exercise to render
    // anything — without this, the user gets a "Aucun exercice" wall.
    if (rows.length === 0) {
      const { data: entity } = await (serviceClient as any)
        .from("legal_entities")
        .select("premier_exercice_debut, premier_exercice_fin")
        .eq("id", entityId)
        .maybeSingle();

      const today = new Date();
      const currentYear = today.getUTCFullYear();
      const startDate =
        (entity?.premier_exercice_debut as string | undefined) ??
        `${currentYear}-01-01`;
      const endDate =
        (entity?.premier_exercice_fin as string | undefined) ??
        `${currentYear}-12-31`;

      const { data: created, error: createErr } = await (serviceClient as any)
        .from("accounting_exercises")
        .insert({
          entity_id: entityId,
          start_date: startDate,
          end_date: endDate,
          status: "open",
        })
        .select("*")
        .single();

      if (!createErr && created) {
        rows = [created];
      } else if (createErr) {
        console.error("[Exercises API] bootstrap exercise failed:", createErr);
        // Fall through with the empty list — the client will render the
        // "Créez un exercice" empty state. Never block the GET on a
        // bootstrap failure.
      }
    }

    // Expose BOTH camelCase (for BalancePageClient, GrandLivrePageClient,
    // useAccountingDashboard, RendementPageClient, ExportsPageClient) and
    // snake_case (for ExercisesClient, DeclarationsClient, ECClientView)
    // so every existing consumer keeps working without a sweeping refactor.
    // Synthesize a `label` like "Exercice 2026" since the table has no
    // such column and the dashboard subtitle needs one.
    const exercisesOut = rows.map((row) => {
      const start = (row.start_date as string) ?? "";
      const end = (row.end_date as string) ?? "";
      const startYear = start.slice(0, 4);
      const endYear = end.slice(0, 4);
      const label =
        startYear && startYear === endYear
          ? `Exercice ${startYear}`
          : `Exercice ${startYear || "?"}–${endYear || "?"}`;
      return {
        ...row,
        id: row.id as string,
        entityId: row.entity_id as string,
        startDate: start,
        endDate: end,
        status: row.status as string,
        closedBy: (row.closed_by as string | null) ?? null,
        closedAt: (row.closed_at as string | null) ?? null,
        label,
      };
    });

    return NextResponse.json({
      success: true,
      data: { exercises: exercisesOut },
    });
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
