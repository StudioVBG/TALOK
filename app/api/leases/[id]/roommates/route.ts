// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/leases/[id]/roommates - Liste des colocataires d'un bail
 */
export async function GET(
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

    // Vérifier que l'utilisateur a accès au bail
    const { data: lease } = await supabase
      .from("leases")
      .select("id")
      .eq("id", params.id as any)
      .single();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer les colocataires
    const { data: roommates, error } = await supabase
      .from("roommates")
      .select("*")
      .eq("lease_id", params.id as any)
      .is("left_on", null)
      .order("joined_on", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ roommates: roommates || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

