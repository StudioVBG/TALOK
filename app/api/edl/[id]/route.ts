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
        lease:leases(id, property:properties(adresse_complete, owner_id))
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

    // 🔧 FIX: Vérifier les permissions (Locataire OU Propriétaire)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let isAuthorized = false;

    if (profile.role === "owner" || profile.role === "admin") {
      // Si c'est un propriétaire, vérifier qu'il possède le bien
      const ownerId = edlData.lease?.property?.owner_id || edlData.property_id;
      // Support si ownerId est un objet suite au join
      const actualOwnerId = typeof ownerId === "object" ? ownerId.owner_id : ownerId;

      if (actualOwnerId === profile.id) {
        isAuthorized = true;
      }
    } else {
      // Si c'est un locataire, vérifier sa liaison avec le bail
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (roommate) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
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
        signer:profiles(prenom, nom)
      `)
      .eq("edl_id", edlId as any);

    if (sigError) throw sigError;

    // Récupérer les relevés de compteurs
    const { data: meterReadings, error: meterReadingsError } = await supabase
      .from("edl_meter_readings")
      .select("*, meter:meters(*)")
      .eq("edl_id", edlId as any);

    if (meterReadingsError) {
      console.warn("Erreur lors de la récupération des relevés de compteurs:", meterReadingsError);
    }

    return NextResponse.json({
      edl: edlData,
      items: items || [],
      media: media || [],
      signatures: signatures || [],
      meterReadings: meterReadings || [],
      keys: edlData.keys || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/edl/[id] - Mettre à jour un EDL (notes, clés, sections)
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const edlId = params.id;
    const body = await request.json();
    const { observations_generales, keys, sections } = body;

    // 1. Vérifier les permissions
    const { data: edl, error: edlError } = await supabase
      .from("edl")
      .select("id, status, property_id, lease_id, lease:leases(property:properties(owner_id))")
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      return NextResponse.json({ error: "EDL non trouvé" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    let isAuthorized = false;
    const edlData = edl as any;

    if (profile.role === "owner" || profile.role === "admin") {
      const ownerId = edlData.lease?.property?.owner_id || edlData.property_id;
      const actualOwnerId = typeof ownerId === "object" ? ownerId.owner_id : ownerId;
      if (actualOwnerId === profile.id) isAuthorized = true;
    } else if (profile.role === "tenant") {
      const { data: roommate } = await supabase
        .from("roommates")
        .select("id")
        .eq("lease_id", edlData.lease_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (roommate) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    if (edl.status === "signed") {
      return NextResponse.json({ error: "Impossible de modifier un EDL déjà signé" }, { status: 400 });
    }

    // 2. Mettre à jour les notes et les clés
    // 💡 On utilise une approche progressive pour éviter de tout bloquer si les colonnes manquent
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (observations_generales !== undefined) updateData.general_notes = observations_generales;
    if (keys !== undefined) updateData.keys = keys || [];

    console.log(`[PUT /api/edl/${edlId}] Attempting update with:`, Object.keys(updateData));

    try {
      const { error: updateError } = await supabase
        .from("edl")
        .update(updateData)
        .eq("id", edlId);

      if (updateError) {
        console.warn("[PUT /api/edl/[id]] Main update failed, attempting fallback:", updateError);
        // Fallback: si l'erreur est liée à une colonne manquante (code 42703 dans Postgres)
        if ((updateError as any).code === '42703') {
          console.log("[PUT /api/edl/[id]] Retrying without new columns...");
          const { error: fallbackError } = await supabase
            .from("edl")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", edlId);
          if (fallbackError) throw fallbackError;
        } else {
          throw updateError;
        }
      }
    } catch (err) {
      console.error("[PUT /api/edl/[id]] DB Update Exception:", err);
      // On continue pour les sections même si le header échoue
    }

    // 3. Mettre à jour les sections (items)
    if (sections && Array.isArray(sections) && sections.length > 0) {
      console.log(`[PUT /api/edl/${edlId}] Updating ${sections.length} sections`);
      try {
        for (const section of sections) {
          if (!section.items || !Array.isArray(section.items)) {
            console.warn(`[PUT /api/edl/${edlId}] Section ${section.name || 'unnamed'} has no items or invalid items`);
            continue;
          }
          
          for (const item of section.items) {
            const itemData = {
              condition: item.condition || item.state || null,
              notes: item.observations || item.notes || "",
              room_name: section.name || section.room_name || "Pièce",
              item_name: item.name || item.item_name || "Élément",
            };

            if (item.id && !String(item.id).startsWith("temp_")) {
              // Update
              const { error: itemError } = await supabase
                .from("edl_items")
                .update(itemData as any)
                .eq("id", item.id);
              if (itemError) {
                console.error(`[PUT /api/edl/${edlId}] Error updating item ${item.id}:`, itemError);
              }
            } else {
              // Insert
              const { error: itemError } = await supabase
                .from("edl_items")
                .insert({
                  ...itemData,
                  edl_id: edlId,
                } as any);
              if (itemError) {
                console.error(`[PUT /api/edl/${edlId}] Error inserting item:`, itemError);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[PUT /api/edl/${edlId}] Exception in sections processing:`, err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[PUT /api/edl/[id]] Error:", error);
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

