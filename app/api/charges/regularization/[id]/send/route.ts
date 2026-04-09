export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * POST /api/charges/regularization/[id]/send - Send regularization to tenant
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile as any).role !== "owner") {
      return NextResponse.json({ error: "Réservé aux propriétaires" }, { status: 403 });
    }

    // Fetch the regularization
    const { data: reg, error: fetchError } = await supabase
      .from("lease_charge_regularizations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reg) {
      return NextResponse.json({ error: "Régularisation introuvable" }, { status: 404 });
    }

    const regData = reg as any;
    if (regData.status !== "calculated") {
      return NextResponse.json(
        { error: "La régularisation doit être calculée avant envoi" },
        { status: 400 }
      );
    }

    // Update status to sent
    const { data: updated, error: updateError } = await supabase
      .from("lease_charge_regularizations")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      } as any)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Emit outbox event for email notification
    try {
      await supabase.from("outbox").insert({
        event_type: "ChargeRegularization.Sent",
        payload: {
          regularization_id: id,
          lease_id: regData.lease_id,
          fiscal_year: regData.fiscal_year,
          balance_cents: regData.balance_cents,
        },
      } as any);
    } catch {
      // Non-blocking: outbox event emission
    }

    return NextResponse.json({ regularization: updated });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
