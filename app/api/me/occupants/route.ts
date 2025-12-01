// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/me/occupants - Récupérer les occupants du foyer
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer les colocataires actifs de tous les baux de l'utilisateur
    const { data: roommates, error } = await supabase
      .from("roommates")
      .select(`
        *,
        lease:leases(id, property:properties(adresse_complete))
      `)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .order("joined_on", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ occupants: roommates });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/me/occupants - Ajouter un occupant au foyer
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { lease_id, first_name, last_name, relationship } = body;

    if (!lease_id || !first_name || !last_name) {
      return NextResponse.json(
        { error: "lease_id, first_name et last_name requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id, role")
      .eq("lease_id", lease_id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas membre de ce bail" },
        { status: 403 }
      );
    }

    // Seul le locataire principal peut ajouter des occupants
    const roommateData = roommate as any;
    if (roommateData.role !== "principal") {
      return NextResponse.json(
        { error: "Seul le locataire principal peut ajouter des occupants" },
        { status: 403 }
      );
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Créer l'occupant (sans user_id, car c'est juste un occupant)
    const { data: newOccupant, error: insertError } = await supabase
      .from("roommates")
      .insert({
        lease_id,
        user_id: user.id, // Temporaire, sera mis à jour si l'occupant crée un compte
        profile_id: (profile as any).id,
        role: "occupant",
        first_name,
        last_name,
        weight: 0, // Pas de part de paiement par défaut
      } as any)
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ occupant: newOccupant });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/me/occupants/[id] - Supprimer un occupant
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const occupantId = params.id;

    // Récupérer l'occupant
    const { data: occupant } = await supabase
      .from("roommates")
      .select("*, lease:leases(id)")
      .eq("id", occupantId as any)
      .single();

    if (!occupant) {
      return NextResponse.json(
        { error: "Occupant non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier les permissions
    const { data: userRoommate } = await supabase
      .from("roommates")
      .select("role")
      .eq("lease_id", (occupant as any).lease_id)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    const userRoommateData = userRoommate as any;
    if (!userRoommateData || userRoommateData.role !== "principal") {
      return NextResponse.json(
        { error: "Seul le locataire principal peut supprimer des occupants" },
        { status: 403 }
      );
    }

    // Marquer comme parti au lieu de supprimer
    const { error } = await supabase
      .from("roommates")
      .update({ left_on: new Date().toISOString().split("T")[0] } as any)
      .eq("id", occupantId as any);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





