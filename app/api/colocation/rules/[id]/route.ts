export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { updateRuleSchema } from "@/features/colocation/types";

/**
 * PATCH /api/colocation/rules/[id]
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: rule, error: updateError } = await supabase
      .from("colocation_rules")
      .update(parsed.data)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ rule });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/colocation/rules/[id]
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    // Soft delete: set is_active to false
    const { error: deleteError } = await supabase
      .from("colocation_rules")
      .update({ is_active: false })
      .eq("id", params.id);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
