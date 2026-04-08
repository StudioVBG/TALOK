export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/agency/crg/[id]/send — Send CRG to mandant
 *
 * Marks the CRG as sent and records the sent timestamp.
 * In production, this would also trigger an email notification.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "agency") {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    // Verify CRG belongs to this agency's mandate
    const { data: crg } = await supabase
      .from("agency_crg")
      .select(`
        id, status,
        mandate:agency_mandates!agency_crg_mandate_id_fkey(
          agency_profile_id,
          owner_profile_id,
          owner:profiles!agency_mandates_owner_profile_id_fkey(
            email, prenom, nom
          )
        )
      `)
      .eq("id", id)
      .single();

    if (!crg) {
      return NextResponse.json({ error: "CRG non trouve" }, { status: 404 });
    }

    const mandate = crg.mandate as any;
    if (mandate?.agency_profile_id !== profile.id) {
      return NextResponse.json({ error: "Acces non autorise" }, { status: 403 });
    }

    if (crg.status === "sent" || crg.status === "acknowledged") {
      return NextResponse.json({ error: "CRG deja envoye" }, { status: 400 });
    }

    if (crg.status === "draft") {
      return NextResponse.json(
        { error: "Le CRG doit etre genere avant l'envoi" },
        { status: 400 }
      );
    }

    // Update CRG status
    const { data: updated, error: updateError } = await supabase
      .from("agency_crg")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // TODO: Send email notification to mandant
    // const owner = mandate?.owner;
    // if (owner?.email) {
    //   await sendCRGEmail(owner.email, crg);
    // }

    return NextResponse.json({ crg: updated });
  } catch (error: unknown) {
    console.error("[agency/crg/[id]/send]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
