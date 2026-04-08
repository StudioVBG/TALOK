export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { declareDepartureSchema } from "@/features/colocation/types";

/**
 * POST /api/colocation/members/[id]/departure
 * Declarer le depart d'un colocataire
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
    const parsed = declareDepartureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Get current member
    const { data: member, error: fetchError } = await supabase
      .from("colocation_members")
      .select("*, properties:property_id(colocation_type, has_solidarity_clause)")
      .eq("id", params.id)
      .single();

    if (fetchError || !member) {
      return NextResponse.json({ error: "Membre non trouve" }, { status: 404 });
    }

    if (member.status !== "active") {
      return NextResponse.json(
        { error: "Seul un membre actif peut declarer un depart" },
        { status: 400 }
      );
    }

    const effectiveDate = new Date(parsed.data.notice_effective_date);

    // Calculate solidarity end date (move_out + 6 months for bail_unique)
    // The trigger handles this automatically, but we set move_out_date
    const updateData: Record<string, any> = {
      status: "departing",
      notice_given_at: new Date().toISOString(),
      notice_effective_date: parsed.data.notice_effective_date,
      move_out_date: parsed.data.notice_effective_date,
    };

    const { data: updated, error: updateError } = await supabase
      .from("colocation_members")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ member: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
