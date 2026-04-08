/**
 * API Route: Syndic Copropriété — Appels de fonds
 * GET  /api/accounting/syndic/appels  - List fund calls for entity
 * POST /api/accounting/syndic/appels  - Generate fund calls from voted budget
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { generateFundCalls } from "@/lib/accounting/syndic/fund-calls";

export const dynamic = "force-dynamic";

const GenerateCallsSchema = z.object({
  budgetId: z.string().uuid(),
  periodicity: z.enum(["trimester", "semester", "annual"]),
});

/**
 * GET /api/accounting/syndic/appels?entityId=xxx&exerciseId=xxx
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const exerciseId = searchParams.get("exerciseId");
    const budgetId = searchParams.get("budgetId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    let query = (supabase as any)
      .from("copro_fund_calls")
      .select("*")
      .eq("entity_id", entityId)
      .order("call_date", { ascending: false });

    if (exerciseId) {
      query = query.eq("exercise_id", exerciseId);
    }
    if (budgetId) {
      query = query.eq("budget_id", budgetId);
    }

    const { data: calls, error } = await query;

    if (error) {
      throw new ApiError(
        500,
        `Erreur chargement appels de fonds: ${error.message}`,
      );
    }

    return NextResponse.json({ success: true, data: calls ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/syndic/appels
 * Generate fund calls from a voted budget.
 * Body: { budgetId, periodicity }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = GenerateCallsSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { budgetId, periodicity } = validation.data;

    const results = await generateFundCalls(
      supabase,
      budgetId,
      periodicity,
      user.id,
    );

    return NextResponse.json(
      {
        success: true,
        message: `${results.length} appel(s) de fonds genere(s)`,
        data: results,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
