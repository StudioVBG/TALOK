/**
 * API Route: Seed Chart of Accounts
 * POST /api/accounting/chart/seed - Initialize chart + journals for an entity
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { initializeChartOfAccounts } from "@/lib/accounting/chart-amort-ocr";
import { initializeJournals } from "@/lib/accounting/engine";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SeedSchema = z.object({
  planType: z.enum(["pcg", "copro"]),
  entityId: z.string().uuid(),
});

/**
 * POST /api/accounting/chart/seed
 * Seed chart of accounts and initialize journals for an entity.
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
    const validation = SeedSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { planType, entityId } = validation.data;

    const accounts = await initializeChartOfAccounts(supabase, entityId, planType);
    await initializeJournals(supabase, entityId);

    return NextResponse.json({
      success: true,
      data: {
        accounts: { inserted: accounts.inserted, skipped: accounts.skipped },
        journals: "initialized",
      },
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
