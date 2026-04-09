export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { regularizationContestSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * POST /api/charges/regularization/[id]/contest - Tenant contests a regularization
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

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Verify tenant has access to this regularization via lease
    const { data: reg } = await supabase
      .from("lease_charge_regularizations")
      .select("*, lease:leases!inner(id)")
      .eq("id", id)
      .single();

    if (!reg) {
      return NextResponse.json({ error: "Régularisation introuvable" }, { status: 404 });
    }

    const regData = reg as any;
    if (regData.status !== "sent") {
      return NextResponse.json(
        { error: "Seule une régularisation envoyée peut être contestée" },
        { status: 400 }
      );
    }

    // Verify tenant is on the lease
    const { data: signer } = await supabase
      .from("lease_signers")
      .select("id")
      .eq("lease_id", regData.lease_id)
      .eq("profile_id", (profile as any).id)
      .in("role", ["locataire_principal", "colocataire"])
      .maybeSingle();

    if (!signer) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = regularizationContestSchema.parse(body);

    const { data: updated, error } = await supabase
      .from("lease_charge_regularizations")
      .update({
        status: "contested",
        contested: true,
        contest_reason: validated.contest_reason,
        contest_date: new Date().toISOString(),
      } as any)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Emit outbox event
    try {
      await supabase.from("outbox").insert({
        event_type: "ChargeRegularization.Contested",
        payload: {
          regularization_id: id,
          lease_id: regData.lease_id,
          reason: validated.contest_reason,
        },
      } as any);
    } catch {
      // Non-blocking
    }

    return NextResponse.json({ regularization: updated });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
