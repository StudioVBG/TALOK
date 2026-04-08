export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyEDLAccess } from "@/lib/helpers/edl-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/edl/[id]/compare
 * Compare l'EDL sortie avec l'EDL d'entrée correspondant.
 * Retourne les éléments côte à côte avec dégradations identifiées.
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

    // Get user profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Verify access
    const accessResult = await verifyEDLAccess(
      {
        edlId,
        userId: user.id,
        profileId: profile.id,
        profileRole: profile.role,
      },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edl = accessResult.edl as Record<string, unknown>;

    // This endpoint only works for sortie EDL
    if (edl.type !== "sortie") {
      return NextResponse.json(
        { error: "La comparaison n'est disponible que pour les EDL de sortie" },
        { status: 400 }
      );
    }

    // Find linked entry EDL
    let entryEdlId = edl.linked_entry_edl_id as string | null;

    if (!entryEdlId) {
      // Try to find entry EDL for the same lease
      const { data: entryEdl } = await serviceClient
        .from("edl")
        .select("id")
        .eq("lease_id", edl.lease_id as string)
        .eq("type", "entree")
        .in("status", ["signed", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!entryEdl) {
        return NextResponse.json(
          { error: "Aucun EDL d'entrée trouvé pour ce bail" },
          { status: 404 }
        );
      }
      entryEdlId = entryEdl.id;
    }

    // Fetch both EDLs with their rooms and items
    const [sortieRooms, entreeRooms, sortieItems, entreeItems, sortieMedia, entreeMedia] =
      await Promise.all([
        serviceClient
          .from("edl_rooms")
          .select("*")
          .eq("edl_id", edlId)
          .order("sort_order"),
        serviceClient
          .from("edl_rooms")
          .select("*")
          .eq("edl_id", entryEdlId)
          .order("sort_order"),
        serviceClient
          .from("edl_items")
          .select("*")
          .eq("edl_id", edlId)
          .order("sort_order"),
        serviceClient
          .from("edl_items")
          .select("*")
          .eq("edl_id", entryEdlId)
          .order("sort_order"),
        serviceClient
          .from("edl_media")
          .select("*")
          .eq("edl_id", edlId),
        serviceClient
          .from("edl_media")
          .select("*")
          .eq("edl_id", entryEdlId),
      ]);

    // Group items by room_name for both EDLs
    const sortieByRoom = groupItemsByRoom(sortieItems.data || []);
    const entreeByRoom = groupItemsByRoom(entreeItems.data || []);

    // Build comparison data
    const allRoomNames = new Set([
      ...Object.keys(sortieByRoom),
      ...Object.keys(entreeByRoom),
    ]);

    const comparison = Array.from(allRoomNames).map((roomName) => {
      const entreeRoomItems = entreeByRoom[roomName] || [];
      const sortieRoomItems = sortieByRoom[roomName] || [];

      // Match items by item_name or element_type
      const elements = mergeElements(entreeRoomItems, sortieRoomItems);

      return {
        room_name: roomName,
        entree_room: (entreeRooms.data || []).find(
          (r: Record<string, unknown>) => r.room_name === roomName
        ),
        sortie_room: (sortieRooms.data || []).find(
          (r: Record<string, unknown>) => r.room_name === roomName
        ),
        elements,
        has_degradations: elements.some((e) => e.degradation_noted),
      };
    });

    // Calculate total retenues
    const totalRetenueCents = (sortieItems.data || []).reduce(
      (sum: number, item: Record<string, unknown>) =>
        sum + ((item.retenue_cents as number) || 0),
      0
    );

    return NextResponse.json({
      edl_sortie_id: edlId,
      edl_entree_id: entryEdlId,
      comparison,
      summary: {
        total_rooms: allRoomNames.size,
        rooms_with_degradations: comparison.filter((r) => r.has_degradations)
          .length,
        total_retenue_cents: totalRetenueCents,
        depot_garantie_cents: edl.depot_garantie_cents || null,
        montant_restitue_cents: edl.montant_restitue_cents || null,
      },
      media: {
        entree: entreeMedia.data || [],
        sortie: sortieMedia.data || [],
      },
    });
  } catch (error: unknown) {
    console.error("[GET /api/edl/[id]/compare] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

function groupItemsByRoom(
  items: Record<string, unknown>[]
): Record<string, Record<string, unknown>[]> {
  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const item of items) {
    const roomName = (item.room_name as string) || "Autres";
    if (!grouped[roomName]) grouped[roomName] = [];
    grouped[roomName].push(item);
  }
  return grouped;
}

function mergeElements(
  entreeItems: Record<string, unknown>[],
  sortieItems: Record<string, unknown>[]
) {
  const merged: Array<{
    item_name: string;
    element_type: string | null;
    entree: Record<string, unknown> | null;
    sortie: Record<string, unknown> | null;
    degradation_noted: boolean;
    condition_changed: boolean;
  }> = [];

  const matchedSortieIds = new Set<string>();

  for (const entreeItem of entreeItems) {
    const itemName = entreeItem.item_name as string;
    const elementType = entreeItem.element_type as string | null;

    // Find matching sortie item
    const sortieMatch = sortieItems.find((s) => {
      if (matchedSortieIds.has(s.id as string)) return false;
      if (elementType && s.element_type === elementType) return true;
      return s.item_name === itemName;
    });

    if (sortieMatch) {
      matchedSortieIds.add(sortieMatch.id as string);
    }

    merged.push({
      item_name: itemName,
      element_type: elementType,
      entree: entreeItem,
      sortie: sortieMatch || null,
      degradation_noted: (sortieMatch?.degradation_noted as boolean) || false,
      condition_changed:
        sortieMatch != null &&
        entreeItem.condition !== sortieMatch.condition,
    });
  }

  // Add unmatched sortie items
  for (const sortieItem of sortieItems) {
    if (!matchedSortieIds.has(sortieItem.id as string)) {
      merged.push({
        item_name: sortieItem.item_name as string,
        element_type: sortieItem.element_type as string | null,
        entree: null,
        sortie: sortieItem,
        degradation_noted:
          (sortieItem.degradation_noted as boolean) || false,
        condition_changed: true,
      });
    }
  }

  return merged;
}
