export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/chores/rotate - Faire tourner les tâches ménagères
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
    const { lease_id, chore_id } = body;

    if (!lease_id || !chore_id) {
      return NextResponse.json(
        { error: "lease_id et chore_id requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur est membre du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
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

    // Récupérer la tâche
    const { data: chore, error: choreError } = await supabase
      .from("chore_schedule")
      .select("*")
      .eq("id", chore_id)
      .eq("lease_id", lease_id as any)
      .single();

    if (choreError || !chore) {
      return NextResponse.json(
        { error: "Tâche non trouvée" },
        { status: 404 }
      );
    }

    const choreData = chore as any;

    // Récupérer tous les colocataires actifs
    const { data: roommates, error: roommatesError } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", lease_id as any)
      .is("left_on", null)
      .order("joined_on", { ascending: true });

    if (roommatesError || !roommates || roommates.length === 0) {
      return NextResponse.json(
        { error: "Aucun colocataire trouvé" },
        { status: 404 }
      );
    }

    // Déterminer le prochain assigné
    let rotationOrder = choreData.rotation_order || [];
    if (rotationOrder.length === 0) {
      // Initialiser avec l'ordre des roommates
      rotationOrder = roommates.map((r: any) => r.id);
    }

    // Trouver l'index actuel
    const currentIndex = rotationOrder.indexOf(choreData.current_assignee_id);
    const nextIndex = (currentIndex + 1) % rotationOrder.length;
    const nextAssigneeId = rotationOrder[nextIndex];

    // Mettre à jour la tâche
    const { data: updatedChore, error: updateError } = await supabase
      .from("chore_schedule")
      .update({
        current_assignee_id: nextAssigneeId,
        rotation_order: rotationOrder,
        last_rotated_at: new Date().toISOString(),
      } as any)
      .eq("id", chore_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ chore: updatedChore });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





