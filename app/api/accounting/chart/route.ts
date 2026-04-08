/**
 * API Route: Chart of Accounts
 * GET  /api/accounting/chart - List accounts for an entity
 * POST /api/accounting/chart - Add a custom account
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { addCustomAccount } from "@/lib/accounting/chart-amort-ocr";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AddAccountSchema = z.object({
  entityId: z.string().uuid(),
  accountNumber: z.string().min(3).max(10),
  label: z.string().min(1).max(255),
  accountType: z.enum(["asset", "liability", "equity", "income", "expense"]),
});

/**
 * GET /api/accounting/chart?entityId=...
 * List all accounts for an entity, ordered by account_number.
 */
export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const { data: accounts, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .eq("entity_id", entityId)
      .order("account_number", { ascending: true });

    if (error) {
      throw new ApiError(500, "Erreur lors de la recuperation du plan comptable");
    }

    return NextResponse.json({ success: true, data: { accounts: accounts || [] } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/chart
 * Add a custom account to the chart.
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
    const validation = AddAccountSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, accountNumber, label, accountType } = validation.data;
    const account = await addCustomAccount(supabase, entityId, accountNumber, label, accountType);

    return NextResponse.json({ success: true, data: account }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
