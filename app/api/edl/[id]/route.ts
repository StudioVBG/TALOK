export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { 
  verifyEDLAccess, 
  createServiceClient, 
  getUserProfile,
  canEditEDL 
} from "@/lib/helpers/edl-auth";

/**
 * GET /api/edl/[id] - Récupérer les détails d'un EDL
 * SOTA 2026: Utilise le helper centralisé pour la vérification des permissions
 */
export async function GET(
  request: Request,
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
    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edlData = accessResult.edl;

    // Récupérer les items
    const { data: items, error: itemsError } = await serviceClient
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId)
      .order("room_name", { ascending: true });

    if (itemsError) {
      console.error("[GET /api/edl/[id]] Items error:", itemsError);
    }

    // Récupérer les médias
    const { data: media, error: mediaError } = await serviceClient
      .from("edl_media")
      .select("*")
      .eq("edl_id", edlId)
      .order("created_at", { ascending: true });

    if (mediaError) {
      console.error("[GET /api/edl/[id]] Media error:", mediaError);
    }

    // Récupérer les signatures avec les profils
    const { data: signatures, error: sigError } = await serviceClient
      .from("edl_signatures")
      .select(`
        *,
        signer:profiles(prenom, nom)
      `)
      .eq("edl_id", edlId);

    if (sigError) {
      console.error("[GET /api/edl/[id]] Signatures error:", sigError);
    }

    // Récupérer les relevés de compteurs
    const { data: meterReadings, error: meterReadingsError } = await serviceClient
      .from("edl_meter_readings")
      .select("*, meter:meters(*)")
      .eq("edl_id", edlId);

    if (meterReadingsError) {
      console.warn("[GET /api/edl/[id]] Meter readings error:", meterReadingsError);
    }

    return NextResponse.json({
      edl: edlData,
      items: items || [],
      media: media || [],
      signatures: signatures || [],
      meterReadings: meterReadings || [],
      keys: edlData.keys || [],
    });
  } catch (error: unknown) {
    console.error("[GET /api/edl/[id]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/edl/[id] - Mettre à jour un EDL (notes, clés, sections)
 * SOTA 2026: Utilise le helper centralisé pour la vérification des permissions
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { observations_generales, keys, sections } = body;

    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    // Vérifier si l'EDL peut être modifié
    const editCheck = canEditEDL(accessResult.edl);
    if (!editCheck.canEdit) {
      return NextResponse.json({ error: editCheck.reason }, { status: 400 });
    }

    // Mettre à jour les notes et les clés
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (observations_generales !== undefined) updateData.general_notes = observations_generales;
    if (keys !== undefined) updateData.keys = keys || [];

    console.log(`[PUT /api/edl/${edlId}] Updating with:`, Object.keys(updateData));

    try {
      const { error: updateError } = await serviceClient
        .from("edl")
        .update(updateData)
        .eq("id", edlId);

      if (updateError) {
        console.warn("[PUT /api/edl/[id]] Update failed:", updateError);
        if ((updateError as any).code === '42703') {
          const { error: fallbackError } = await serviceClient
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
    }

    // Mettre à jour les sections (items) - batch operations to avoid timeout
    const sectionErrors: string[] = [];
    if (sections && Array.isArray(sections) && sections.length > 0) {
      console.log(`[PUT /api/edl/${edlId}] Updating ${sections.length} sections`);
      try {
        // Collect all items to update and insert separately
        const itemsToUpdate: Array<{ id: string; data: any }> = [];
        const itemsToInsert: any[] = [];

        for (const section of sections) {
          if (!section.items || !Array.isArray(section.items)) {
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
              itemsToUpdate.push({ id: item.id, data: itemData });
            } else {
              itemsToInsert.push({ ...itemData, edl_id: edlId });
            }
          }
        }

        // Batch insert new items in a single call
        if (itemsToInsert.length > 0) {
          const { error: batchInsertError } = await serviceClient
            .from("edl_items")
            .insert(itemsToInsert as any);
          if (batchInsertError) {
            console.error(`[PUT /api/edl/${edlId}] Batch insert error:`, batchInsertError);
            sectionErrors.push(`Insertion de ${itemsToInsert.length} éléments : ${batchInsertError.message}`);
          }
        }

        // Update existing items in parallel batches (max 10 concurrent)
        if (itemsToUpdate.length > 0) {
          const BATCH_SIZE = 10;
          for (let i = 0; i < itemsToUpdate.length; i += BATCH_SIZE) {
            const batch = itemsToUpdate.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(({ id, data }) =>
                serviceClient
                  .from("edl_items")
                  .update(data as any)
                  .eq("id", id)
              )
            );
            const failures = results.filter((r) => r.status === "rejected");
            if (failures.length > 0) {
              console.error(`[PUT /api/edl/${edlId}] ${failures.length} item updates failed in batch`);
              sectionErrors.push(`${failures.length} mises à jour échouées`);
            }
          }
        }
      } catch (err) {
        console.error(`[PUT /api/edl/${edlId}] Sections exception:`, err);
        sectionErrors.push(err instanceof Error ? err.message : "Erreur inattendue");
      }
    }

    // Return explicit partial failure if some section saves failed
    if (sectionErrors.length > 0) {
      return NextResponse.json({
        success: false,
        partial: true,
        errors: sectionErrors,
        message: "Certaines modifications n'ont pas pu être sauvegardées",
      }, { status: 207 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[PUT /api/edl/[id]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/edl/[id] - Supprimer un EDL
 * SOTA 2026: Utilise le helper centralisé pour la vérification des permissions
 */
export async function DELETE(
  request: Request,
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
    const serviceClient = createServiceClient();

    // Récupérer le profil
    const profile = await getUserProfile(serviceClient, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Vérifier les permissions avec le helper SOTA
    const accessResult = await verifyEDLAccess({
      edlId,
      userId: user.id,
      profileId: profile.id,
      profileRole: profile.role
    }, serviceClient);

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    // Seul le propriétaire ou admin peut supprimer
    if (accessResult.accessType !== "owner" && accessResult.accessType !== "admin" && accessResult.accessType !== "creator") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut supprimer cet EDL" },
        { status: 403 }
      );
    }

    // Interdire la suppression d'un EDL signé
    if (accessResult.edl.status === "signed") {
      return NextResponse.json(
        { error: "Impossible de supprimer un état des lieux déjà signé" },
        { status: 400 }
      );
    }

    // Supprimer l'EDL
    const { error: deleteError } = await serviceClient
      .from("edl")
      .delete()
      .eq("id", edlId);

    if (deleteError) throw deleteError;

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "edl_deleted",
      entity_type: "edl",
      entity_id: edlId,
      metadata: { status: accessResult.edl.status },
    } as any);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/edl/[id]] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
