export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { createExpenseSchema } from "@/features/colocation/types";

/**
 * GET /api/colocation/expenses?property_id=xxx
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property_id");
    if (!propertyId) {
      return NextResponse.json({ error: "property_id requis" }, { status: 400 });
    }

    const { data: expenses, error: dbError } = await supabase
      .from("colocation_expenses")
      .select(`
        *,
        paid_by:paid_by_member_id(
          id,
          tenant_profile_id,
          profiles:tenant_profile_id(prenom, nom, avatar_url)
        )
      `)
      .eq("property_id", propertyId)
      .order("date", { ascending: false });

    if (dbError) throw dbError;
    return NextResponse.json({ expenses: expenses || [] });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/expenses
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const insertData: Record<string, any> = {
      ...parsed.data,
      date: parsed.data.date || new Date().toISOString().split("T")[0],
    };

    if (parsed.data.split_details) {
      insertData.split_details = parsed.data.split_details;
    }

    const { data: expense, error: insertError } = await supabase
      .from("colocation_expenses")
      .insert(insertData)
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
