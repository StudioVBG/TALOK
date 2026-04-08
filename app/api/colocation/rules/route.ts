export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { createRuleSchema } from "@/features/colocation/types";

/**
 * GET /api/colocation/rules?property_id=xxx
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

    const { data: rules, error: dbError } = await supabase
      .from("colocation_rules")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (dbError) throw dbError;
    return NextResponse.json({ rules: rules || [] });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/rules
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: rule, error: insertError } = await supabase
      .from("colocation_rules")
      .insert(parsed.data)
      .select()
      .single();

    if (insertError) throw insertError;
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
