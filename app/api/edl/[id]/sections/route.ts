export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const sectionSchema = z.object({
  sections: z.array(
    z.object({
      room_name: z.string().min(1),
      items: z.array(
        z.object({
          room_name: z.string(),
          item_name: z.string(),
          condition: z.enum(["neuf", "bon", "moyen", "mauvais", "tres_mauvais"]).nullable().optional(),
          notes: z.string().optional().nullable(),
        })
      ),
    })
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Verify EDL exists and user has access
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select("id, lease_id, created_by")
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // Check if user is the creator or the owner of the property
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // If not the creator, check if owner of the property
    if (edl.created_by !== user.id) {
      const { data: lease } = await supabase
        .from("leases")
        .select(`
          properties!inner(owner_id)
        `)
        .eq("id", edl.lease_id)
        .single();

      if (!lease || (lease.properties as any)?.owner_id !== profile.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
    }

    // Parse and validate body
    const body = await request.json();
    const validated = sectionSchema.parse(body);

    // Flatten all items
    const allItems: any[] = [];
    for (const section of validated.sections) {
      for (const item of section.items) {
        allItems.push({
          edl_id: edlId,
          room_name: item.room_name || section.room_name,
          item_name: item.item_name,
          condition: item.condition || null,
          notes: item.notes || null,
        });
      }
    }

    // Insert items
    const { data: insertedItems, error: insertError } = await supabase
      .from("edl_items")
      .insert(allItems)
      .select();

    if (insertError) {
      console.error("[POST /api/edl/[id]/sections] Insert error:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de l'ajout des éléments" },
        { status: 500 }
      );
    }

    // Update EDL status to in_progress if it was draft
    await supabase
      .from("edl")
      .update({ status: "in_progress" })
      .eq("id", edlId)
      .eq("status", "draft");

    return NextResponse.json({
      items: insertedItems,
      count: insertedItems?.length || 0,
    });
  } catch (error: unknown) {
    console.error("[POST /api/edl/[id]/sections] Error:", error);

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Fetch EDL items grouped by room
    const { data: items, error } = await supabase
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId)
      .order("room_name", { ascending: true })
      .order("item_name", { ascending: true });

    if (error) {
      console.error("[GET /api/edl/[id]/sections] Error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des éléments" },
        { status: 500 }
      );
    }

    // Group by room
    const sections: Record<string, any[]> = {};
    for (const item of items || []) {
      if (!sections[item.room_name]) {
        sections[item.room_name] = [];
      }
      sections[item.room_name].push(item);
    }

    return NextResponse.json({
      sections: Object.entries(sections).map(([room_name, items]) => ({
        room_name,
        items,
      })),
    });
  } catch (error: unknown) {
    console.error("[GET /api/edl/[id]/sections] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
