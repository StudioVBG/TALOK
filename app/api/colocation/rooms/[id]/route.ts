export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { updateRoomSchema } from "@/features/colocation/types";

/**
 * PATCH /api/colocation/rooms/[id]
 * Modifier une chambre
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
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate surface >= 9m2
    if (parsed.data.surface_m2 !== undefined && parsed.data.surface_m2 < 9) {
      return NextResponse.json(
        { error: "Surface minimum 9m2 par chambre (loi ELAN)" },
        { status: 400 }
      );
    }

    const { data: room, error: updateError } = await supabase
      .from("colocation_rooms")
      .update(parsed.data)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    if (!room) {
      return NextResponse.json({ error: "Chambre non trouvee" }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/colocation/rooms/[id]
 * Supprimer une chambre (si non occupee)
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

    // Check if room is occupied
    const { data: occupant } = await supabase
      .from("colocation_members")
      .select("id")
      .eq("room_id", params.id)
      .in("status", ["active", "pending", "departing"])
      .limit(1)
      .single();

    if (occupant) {
      return NextResponse.json(
        { error: "Impossible de supprimer une chambre occupee" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("colocation_rooms")
      .delete()
      .eq("id", params.id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
