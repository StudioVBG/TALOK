export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyEDLAccess, canEditEDL } from "@/lib/helpers/edl-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const roomSchema = z.object({
  room_name: z.string().min(1).max(100),
  room_type: z.enum([
    "entree", "salon", "sejour", "cuisine", "chambre", "salle_de_bain",
    "wc", "couloir", "buanderie", "cave", "parking", "balcon", "terrasse",
    "jardin", "garage", "autre",
  ]),
  sort_order: z.number().int().min(0).default(0),
  general_condition: z
    .enum(["neuf", "tres_bon", "bon", "usage_normal", "mauvais", "tres_mauvais"])
    .default("bon"),
  observations: z.string().max(2000).optional().nullable(),
});

const roomsCreateSchema = z.object({
  rooms: z.array(roomSchema).min(1).max(50),
});

/**
 * GET /api/edl/[id]/rooms
 * Liste les pièces de l'EDL avec leurs éléments
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const accessResult = await verifyEDLAccess(
      { edlId, userId: user.id, profileId: profile.id, profileRole: profile.role },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    // Fetch rooms with their items
    const { data: rooms, error } = await serviceClient
      .from("edl_rooms")
      .select("*")
      .eq("edl_id", edlId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[GET /api/edl/[id]/rooms] Error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des pièces" },
        { status: 500 }
      );
    }

    // Fetch items grouped by room_id
    const roomIds = (rooms || []).map((r: Record<string, unknown>) => r.id as string);
    let items: Record<string, unknown>[] = [];
    if (roomIds.length > 0) {
      const { data: itemsData } = await serviceClient
        .from("edl_items")
        .select("*")
        .in("room_id", roomIds)
        .order("sort_order", { ascending: true });
      items = (itemsData || []) as Record<string, unknown>[];
    }

    // Group items by room_id
    const itemsByRoom = new Map<string, Record<string, unknown>[]>();
    for (const item of items) {
      const roomId = item.room_id as string;
      if (!itemsByRoom.has(roomId)) itemsByRoom.set(roomId, []);
      itemsByRoom.get(roomId)!.push(item);
    }

    const roomsWithItems = (rooms || []).map((room: Record<string, unknown>) => ({
      ...room,
      items: itemsByRoom.get(room.id as string) || [],
    }));

    return NextResponse.json({ rooms: roomsWithItems });
  } catch (error: unknown) {
    console.error("[GET /api/edl/[id]/rooms] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/edl/[id]/rooms
 * Créer des pièces pour un EDL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const accessResult = await verifyEDLAccess(
      { edlId, userId: user.id, profileId: profile.id, profileRole: profile.role },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edl = accessResult.edl as Record<string, unknown>;
    const editCheck = canEditEDL(edl);
    if (!editCheck.canEdit) {
      return NextResponse.json({ error: editCheck.reason }, { status: 400 });
    }

    const body = await request.json();
    const validated = roomsCreateSchema.parse(body);

    const roomsToInsert = validated.rooms.map((room, idx) => ({
      edl_id: edlId,
      room_name: room.room_name,
      room_type: room.room_type,
      sort_order: room.sort_order || idx,
      general_condition: room.general_condition,
      observations: room.observations || null,
    }));

    const { data: insertedRooms, error: insertError } = await serviceClient
      .from("edl_rooms")
      .insert(roomsToInsert as Record<string, unknown>[])
      .select();

    if (insertError) {
      console.error("[POST /api/edl/[id]/rooms] Insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de la création des pièces" },
        { status: 500 }
      );
    }

    // Update EDL status to in_progress if it was draft
    await serviceClient
      .from("edl")
      .update({ status: "in_progress" } as Record<string, unknown>)
      .eq("id", edlId)
      .eq("status", "draft");

    return NextResponse.json({
      rooms: insertedRooms,
      count: insertedRooms?.length || 0,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/edl/[id]/rooms] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
