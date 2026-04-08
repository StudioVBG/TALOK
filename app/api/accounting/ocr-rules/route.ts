/**
 * API Route: OCR Category Rules
 * GET /api/accounting/ocr-rules — List rules for entity
 * POST /api/accounting/ocr-rules — Create/update rule
 * DELETE /api/accounting/ocr-rules — Delete rule
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    if (!entityId) throw new ApiError(400, "entityId requis");

    const { data, error } = await (supabase as any)
      .from("ocr_category_rules")
      .select("*")
      .eq("entity_id", entityId)
      .order("hit_count", { ascending: false });

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const { entityId, matchType, matchValue, targetAccount, targetJournal } = body;

    const { data, error } = await (supabase as any)
      .from("ocr_category_rules")
      .upsert({
        entity_id: entityId,
        match_type: matchType,
        match_value: matchValue.toLowerCase().trim(),
        target_account: targetAccount,
        target_journal: targetJournal,
        hit_count: 1,
      }, { onConflict: "entity_id,match_type,match_value" })
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("id");
    if (!ruleId) throw new ApiError(400, "id requis");

    const { error } = await (supabase as any).from("ocr_category_rules").delete().eq("id", ruleId);
    if (error) throw new ApiError(500, error.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
