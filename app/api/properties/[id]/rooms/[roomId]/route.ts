export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { roomUpdateSchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const { id, roomId } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = roomUpdateSchema.parse(body);

    const supabaseClient = supabase as any;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("owner_id, type, etat")
      .eq("id", id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier cette pièce" },
        { status: 403 }
      );
    }

    if (!isAdmin && !["draft", "rejected"].includes(property.etat as string)) {
      return NextResponse.json(
        { error: "Impossible de modifier un logement soumis ou publié" },
        { status: 400 }
      );
    }

    const { data: room, error: roomError } = await supabaseClient
      .from("rooms")
      .select("id, property_id")
      .eq("id", roomId as any)
      .eq("property_id", id as any)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Pièce introuvable" }, { status: 404 });
    }

    if ((property.type as string) !== "appartement") {
      return NextResponse.json(
        { error: "Les pièces structurées ne sont disponibles que pour les appartements" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { ...validated, updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(validated, "chauffage_present")) {
      if (!validated.chauffage_present) {
        updates.chauffage_type_emetteur = null;
      } else if (validated.chauffage_type_emetteur === undefined) {
        updates.chauffage_type_emetteur = null;
      }
    }

    const { data: updatedRoom, error: updateError } = await supabaseClient
      .from("rooms")
      .update(updates as any)
      .eq("id", roomId as any)
      .eq("property_id", id as any)
      .select()
      .single();

    if (updateError || !updatedRoom) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de mettre à jour la pièce" },
        { status: 500 }
      );
    }

    return NextResponse.json({ room: updatedRoom });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
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

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const { id, roomId } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseClient = supabase as any;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("owner_id, type, etat")
      .eq("id", id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer cette pièce" },
        { status: 403 }
      );
    }

    if (!isAdmin && property.etat !== "draft") {
      return NextResponse.json(
        { error: "Seuls les brouillons peuvent être modifiés" },
        { status: 400 }
      );
    }

    const { data: room, error: roomError } = await supabaseClient
      .from("rooms")
      .select("id")
      .eq("id", roomId as any)
      .eq("property_id", id as any)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "Pièce introuvable" }, { status: 404 });
    }

    const { data: photos } = await supabaseClient
      .from("photos")
      .select("id")
      .eq("room_id", roomId as any)
      .limit(1);

    if (photos && photos.length > 0) {
      return NextResponse.json(
        {
          error: "room_has_photos",
          details: "Des photos sont associées à cette pièce. Supprimez-les ou réassignez-les avant de continuer.",
        },
        { status: 409 }
      );
    }

    const { error: deleteError } = await supabaseClient
      .from("rooms")
      .delete()
      .eq("id", roomId as any)
      .eq("property_id", id as any);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || "Impossible de supprimer la pièce" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
