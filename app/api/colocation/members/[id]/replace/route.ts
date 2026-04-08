export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { replaceMemberSchema } from "@/features/colocation/types";

/**
 * POST /api/colocation/members/[id]/replace
 * Remplacer un colocataire sortant
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = replaceMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get departing member
    const { data: departing, error: fetchError } = await supabase
      .from("colocation_members")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !departing) {
      return NextResponse.json({ error: "Membre non trouve" }, { status: 404 });
    }

    if (!["active", "departing"].includes(departing.status as string)) {
      return NextResponse.json(
        { error: "Le membre doit etre actif ou en cours de depart" },
        { status: 400 }
      );
    }

    // Create the replacement member
    const { data: replacement, error: insertError } = await supabase
      .from("colocation_members")
      .insert({
        property_id: departing.property_id,
        room_id: departing.room_id,
        lease_id: departing.lease_id,
        tenant_profile_id: parsed.data.new_tenant_profile_id,
        status: "active",
        move_in_date: parsed.data.new_move_in_date,
        rent_share_cents: parsed.data.new_rent_share_cents ?? departing.rent_share_cents,
        charges_share_cents: parsed.data.new_charges_share_cents ?? departing.charges_share_cents,
        deposit_cents: parsed.data.new_deposit_cents ?? departing.deposit_cents,
        replaces_member_id: departing.id,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update departing member: link to replacement, solidarity ends immediately
    const { data: updatedDeparting, error: updateError } = await supabase
      .from("colocation_members")
      .update({
        status: "departed",
        replaced_by_member_id: replacement.id,
        move_out_date: departing.move_out_date || parsed.data.new_move_in_date,
        // Solidarity ends immediately when replaced (trigger handles this)
        solidarity_end_date: departing.move_out_date || parsed.data.new_move_in_date,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      departing: updatedDeparting,
      replacement,
    }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
