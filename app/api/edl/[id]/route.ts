// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/edl/[id] - Récupérer les détails d'un EDL
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

    const edlId = params.id;

    // Récupérer l'EDL
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        *,
        lease:leases(id, property:properties(adresse_complete))
      `)
      .eq("id", edlId as any)
      .single();

    if (edlError || !edl) {
      return NextResponse.json(
        { error: "EDL non trouvé" },
        { status: 404 }
      );
    }

    const edlData = edl as any;

    // Vérifier les permissions
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", edlData.lease_id)
      .eq("user_id", user.id as any)
      .maybeSingle();

    if (!roommate) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Récupérer les items
    const { data: items, error: itemsError } = await supabase
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId as any)
      .order("room_name", { ascending: true });

    if (itemsError) throw itemsError;

    // Récupérer les médias
    const { data: media, error: mediaError } = await supabase
      .from("edl_media")
      .select("*")
      .eq("edl_id", edlId as any)
      .order("created_at", { ascending: true });

    if (mediaError) throw mediaError;

    // Récupérer les signatures
    const { data: signatures, error: sigError } = await supabase
      .from("edl_signatures")
      .select(`
        *,
        signer:profiles!edl_signatures_signer_profile_id_fkey(prenom, nom)
      `)
      .eq("edl_id", edlId as any);

    if (sigError) throw sigError;

    return NextResponse.json({
      edl: edlData,
      items: items || [],
      media: media || [],
      signatures: signatures || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

