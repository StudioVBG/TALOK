export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

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

/**
 * DELETE /api/edl/[id] - Supprimer un EDL
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

    const edlId = params.id;

    // 1. Récupérer l'EDL et vérifier son statut
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select(`
        id,
        status,
        property_id,
        lease:leases(property:properties(owner_id))
      `)
      .eq("id", edlId as any)
      .single();

    if (edlError || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    // 2. Vérifier les permissions (Doit être le propriétaire)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const edlData = edl as any;
    const ownerId = edlData.lease?.property?.owner_id || edlData.property_id; // Supporte les 2 cas

    // Si on a récupéré le owner_id via le join ou direct property_id
    let actualOwnerId = ownerId;
    if (typeof ownerId === 'object' && ownerId !== null) {
      // Cas où property_id est un objet suite au join
      actualOwnerId = (ownerId as any).owner_id;
    }

    // Si on n'a toujours pas le owner_id, on le cherche via property_id
    if (!actualOwnerId && edlData.property_id) {
      const { data: prop } = await supabase.from("properties").select("owner_id").eq("id", edlData.property_id).single();
      actualOwnerId = prop?.owner_id;
    }

    if (actualOwnerId !== profile.id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // 3. Interdire la suppression d'un EDL signé
    if (edlData.status === "signed") {
      return NextResponse.json(
        { error: "Impossible de supprimer un état des lieux déjà signé" },
        { status: 400 }
      );
    }

    // 4. Supprimer l'EDL (Cascade s'occupera des items et signatures en DB)
    const { error: deleteError } = await supabase
      .from("edl")
      .delete()
      .eq("id", edlId as any);

    if (deleteError) throw deleteError;

    // 5. Journaliser l'action
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_deleted",
      entity_type: "edl",
      entity_id: edlId,
      metadata: { status: edlData.status },
    } as any);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

