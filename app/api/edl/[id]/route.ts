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

    // 🔧 FIX: Générer des URLs signées pour les photos de compteurs (bucket privé)
    if (meterReadings && meterReadings.length > 0) {
      for (const reading of meterReadings) {
        if (reading.photo_path) {
          const { data: signedUrlData } = await serviceClient.storage
            .from("documents")
            .createSignedUrl(reading.photo_path, 3600);

          if (signedUrlData?.signedUrl) {
            (reading as any).photo_signed_url = signedUrlData.signedUrl;
          }
        }
      }
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
    console.error("[GET /api/edl/[id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
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

    // Mettre à jour les sections (items)
    if (sections && Array.isArray(sections) && sections.length > 0) {
      console.log(`[PUT /api/edl/${edlId}] Updating ${sections.length} sections`);
      try {
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
              const { error: itemError } = await serviceClient
                .from("edl_items")
                .update(itemData as any)
                .eq("id", item.id);
              if (itemError) {
                console.error(`[PUT /api/edl/${edlId}] Item update error:`, itemError);
              }
            } else {
              const { error: itemError } = await serviceClient
                .from("edl_items")
                .insert({
                  ...itemData,
                  edl_id: edlId,
                } as any);
              if (itemError) {
                console.error(`[PUT /api/edl/${edlId}] Item insert error:`, itemError);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[PUT /api/edl/${edlId}] Sections exception:`, err);
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
  } catch (error: any) {
    console.error("[DELETE /api/edl/[id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
