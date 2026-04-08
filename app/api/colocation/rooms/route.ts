export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";
import { createRoomSchema } from "@/features/colocation/types";

/**
 * GET /api/colocation/rooms?property_id=xxx
 * Liste les chambres d'un bien en colocation
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

    const { data: rooms, error: dbError } = await supabase
      .from("colocation_rooms")
      .select("*")
      .eq("property_id", propertyId)
      .order("room_number", { ascending: true });

    if (dbError) throw dbError;

    // Fetch occupants for each room
    const { data: members } = await supabase
      .from("colocation_members")
      .select("id, room_id, tenant_profile_id, status, move_in_date, profiles:tenant_profile_id(prenom, nom, avatar_url, email)")
      .eq("property_id", propertyId)
      .in("status", ["active", "departing"]);

    const roomsWithOccupants = (rooms || []).map((room: any) => {
      const occupant = (members || []).find((m: any) => m.room_id === room.id) || null;
      return { ...room, occupant };
    });

    return NextResponse.json({ rooms: roomsWithOccupants });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/rooms
 * Creer une chambre
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", parsed.data.property_id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Bien non trouve" }, { status: 404 });
    }

    // Check feature access
    const featureCheck = await withFeatureAccess(property.owner_id as string, "colocation");
    if (!featureCheck.allowed) {
      return NextResponse.json({ error: featureCheck.message }, { status: 403 });
    }

    // Validate surface >= 9m2
    if (parsed.data.surface_m2 !== undefined && parsed.data.surface_m2 < 9) {
      return NextResponse.json(
        { error: "Surface minimum 9m2 par chambre (loi ELAN)" },
        { status: 400 }
      );
    }

    const { data: room, error: insertError } = await supabase
      .from("colocation_rooms")
      .insert(parsed.data)
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
