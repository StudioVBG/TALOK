export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { withFeatureAccess } from "@/lib/middleware/subscription-check";
import { createMemberSchema } from "@/features/colocation/types";

/**
 * GET /api/colocation/members?property_id=xxx
 * Liste les membres (actifs + historique)
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

    const { data: members, error: dbError } = await supabase
      .from("colocation_members")
      .select(`
        *,
        profiles:tenant_profile_id(id, prenom, nom, avatar_url, email, telephone),
        colocation_rooms:room_id(room_number, room_label)
      `)
      .eq("property_id", propertyId)
      .order("move_in_date", { ascending: false });

    if (dbError) throw dbError;

    const formatted = (members || []).map((m: any) => ({
      ...m,
      profile: m.profiles || null,
      room: m.colocation_rooms || null,
      profiles: undefined,
      colocation_rooms: undefined,
    }));

    return NextResponse.json({ members: formatted });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/colocation/members
 * Ajouter un colocataire
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id, max_colocataires")
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

    // Check max colocataires
    if (property.max_colocataires) {
      const { count } = await supabase
        .from("colocation_members")
        .select("id", { count: "exact", head: true })
        .eq("property_id", parsed.data.property_id)
        .in("status", ["active", "pending"]);

      if (count !== null && count >= (property.max_colocataires as number)) {
        return NextResponse.json(
          { error: `Nombre maximum de colocataires atteint (${property.max_colocataires})` },
          { status: 400 }
        );
      }
    }

    const { data: member, error: insertError } = await supabase
      .from("colocation_members")
      .insert({
        ...parsed.data,
        status: "active",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Mark room as unavailable
    if (parsed.data.room_id) {
      await supabase
        .from("colocation_rooms")
        .update({ is_available: false })
        .eq("id", parsed.data.room_id);
    }

    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
