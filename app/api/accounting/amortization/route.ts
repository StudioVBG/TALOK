/**
 * API Route: Amortization Schedules
 * POST /api/accounting/amortization - Cree un plan d'amortissement par composant
 * GET  /api/accounting/amortization - Liste les plans d'amortissement
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import {
  decomposeProperty,
  saveAmortizationSchedule,
  type PropertyComponent,
} from "@/lib/accounting/chart-amort-ocr";

export const dynamic = "force-dynamic";

const ComponentSchema = z.object({
  component: z.string().min(1),
  percent: z.number().min(0).max(100),
  durationYears: z.number().int().min(0),
  amountCents: z.number().int().min(0),
});

const CreateAmortizationSchema = z.object({
  entityId: z.string().uuid(),
  propertyId: z.string().uuid(),
  acquisitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  acquisitionAmountCents: z.number().int().positive(),
  terrainPercentage: z.number().min(0).max(50).optional(),
  components: z.array(ComponentSchema).optional(),
});

/**
 * POST /api/accounting/amortization
 * Cree un plan d'amortissement pour un bien immobilier
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = CreateAmortizationSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const {
      entityId,
      propertyId,
      acquisitionDate,
      acquisitionAmountCents,
      terrainPercentage,
    } = validation.data;

    // Decompose property into components if not provided
    const components: PropertyComponent[] =
      validation.data.components ??
      decomposeProperty(acquisitionAmountCents, terrainPercentage ?? 15);

    const schedules: Array<{ scheduleId: string; lineCount: number; component: string }> = [];
    let totalDepreciable = 0;

    for (const comp of components) {
      // Skip terrain (durationYears === 0) — non amortissable
      if (comp.durationYears === 0) continue;

      totalDepreciable += comp.amountCents;

      const result = await saveAmortizationSchedule(
        supabase,
        entityId,
        propertyId,
        comp.component,
        acquisitionDate,
        comp.amountCents,
        0, // terrainPercent=0 because we already decomposed
        comp.durationYears,
      );

      schedules.push({ ...result, component: comp.component });
    }

    return NextResponse.json(
      { success: true, data: { schedules, totalDepreciable } },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/accounting/amortization
 * Liste les plans d'amortissement d'une entite
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Feature gate
    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const propertyId = searchParams.get("propertyId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    let query = supabase
      .from("amortization_schedules")
      .select("*, amortization_lines(*)")
      .eq("entity_id", entityId)
      .order("component", { ascending: true });

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data: schedules, error } = await query;

    if (error) {
      throw new ApiError(500, "Erreur lors de la recuperation des amortissements");
    }

    // Compute net book value for each schedule
    const enriched = (schedules ?? []).map((schedule) => {
      const lines = (schedule.amortization_lines ?? []) as Array<{
        cumulated_amount_cents: number;
        net_book_value_cents: number;
        exercise_year: number;
      }>;

      // Sort lines by year, take last one for current state
      const sortedLines = [...lines].sort(
        (a, b) => a.exercise_year - b.exercise_year,
      );
      const lastLine = sortedLines[sortedLines.length - 1];

      return {
        ...schedule,
        net_book_value: lastLine?.net_book_value_cents ?? schedule.total_amount_cents,
        cumulated: lastLine?.cumulated_amount_cents ?? 0,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return handleApiError(error);
  }
}
