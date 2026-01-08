export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Routes pour un relevé de compteur spécifique
 * 
 * GET    /api/edl/[id]/meter-readings/[readingId] - Détails d'un relevé
 * PATCH  /api/edl/[id]/meter-readings/[readingId] - Valider/corriger un relevé
 * DELETE /api/edl/[id]/meter-readings/[readingId] - Supprimer un relevé
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { validateEDLMeterReadingSchema } from "@/lib/validations/edl-meters";

// ============================================
// GET - Détails d'un relevé
// ============================================

export async function GET(
  request: Request,
  { params }: { params: { id: string; readingId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: edlId, readingId } = params;

    // Récupérer le relevé avec les infos du compteur
    const { data: reading, error } = await supabase
      .from("edl_meter_readings")
      .select(`
        *,
        meter:meters(*)
      `)
      .eq("id", readingId)
      .eq("edl_id", edlId)
      .single();

    if (error || !reading) {
      return NextResponse.json(
        { error: "Relevé non trouvé" },
        { status: 404 }
      );
    }

    // Générer l'URL signée pour la photo
    const { data: signedUrl } = await supabase.storage
      .from("documents")
      .createSignedUrl((reading as any).photo_path, 3600); // 1 heure

    return NextResponse.json({
      reading: {
        ...reading,
        photo_url: signedUrl?.signedUrl || null,
      },
    });

  } catch (error: any) {
    console.error("[EDL Meter Reading] GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH - Valider/corriger un relevé
// ============================================

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; readingId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: edlId, readingId } = params;
    const body = await request.json();

    // Valider les données
    const validation = validateEDLMeterReadingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { corrected_value, comment, meter_number, location } = validation.data;

    // Vérifier que le relevé existe et que l'EDL est modifiable
    const { data: reading, error: readingError } = await supabase
      .from("edl_meter_readings")
      .select(`
        *,
        edl:edl!inner(
          id,
          status
        )
      `)
      .eq("id", readingId)
      .eq("edl_id", edlId)
      .single();

    if (readingError || !reading) {
      return NextResponse.json(
        { error: "Relevé non trouvé" },
        { status: 404 }
      );
    }

    const readingData = reading as any;
    if (!["draft", "in_progress", "completed", "scheduled"].includes(readingData.edl.status)) {
      return NextResponse.json(
        { error: "L'EDL est déjà signé et ne peut plus être modifié" },
        { status: 400 }
      );
    }

    // 🔧 Mettre à jour les infos du compteur si fournies
    if (meter_number || location) {
      await supabase
        .from("meters")
        .update({
          meter_number: meter_number,
          serial_number: meter_number, // Sync serial_number as well
          location: location,
        } as any)
        .eq("id", readingData.meter_id);
    }

    // Mettre à jour le relevé avec validation
    // 💡 Approche résiliente pour les colonnes de validation
    const readingUpdate: any = {
      reading_value: corrected_value,
      updated_at: new Date().toISOString(),
    };

    // On n'ajoute les colonnes de validation que si elles ne provoquent pas d'erreur 
    // (ou on les ajoute toutes et on gère l'erreur)
    try {
      const { data: updatedReading, error: updateError } = await supabase
        .from("edl_meter_readings")
        .update({
          ...readingUpdate,
          is_validated: true,
          validated_by: user.id,
          validated_at: new Date().toISOString(),
          validation_comment: comment || null,
        })
        .eq("id", readingId)
        .select(`
          *,
          meter:meters(*)
        `)
        .single();

      if (updateError) {
        console.warn("[PATCH /api/edl/[id]/meter-readings/[readingId]] Main update failed, attempting fallback:", updateError);
        if ((updateError as any).code === '42703') {
          const { data: fallbackReading, error: fallbackError } = await supabase
            .from("edl_meter_readings")
            .update(readingUpdate)
            .eq("id", readingId)
            .select(`
              *,
              meter:meters(*)
            `)
            .single();
          if (fallbackError) throw fallbackError;
          return NextResponse.json({ reading: fallbackReading });
        }
        throw updateError;
      }

      return NextResponse.json({ reading: updatedReading });
    } catch (err) {
      console.error("[PATCH /api/edl/[id]/meter-readings/[readingId]] Exception:", err);
      throw err;
    }

  } catch (error: any) {
    console.error("[EDL Meter Reading] PATCH Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Supprimer un relevé (propriétaire uniquement)
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; readingId: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: edlId, readingId } = params;

    // Vérifier le rôle de l'utilisateur (seul le propriétaire peut supprimer)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((profile as any)?.role !== "owner" && (profile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul le propriétaire peut supprimer un relevé" },
        { status: 403 }
      );
    }

    // Vérifier que l'EDL est modifiable
    const { data: reading, error: readingError } = await supabase
      .from("edl_meter_readings")
      .select(`
        *,
        edl:edl!inner(
          id,
          status
        )
      `)
      .eq("id", readingId)
      .eq("edl_id", edlId)
      .single();

    if (readingError || !reading) {
      return NextResponse.json(
        { error: "Relevé non trouvé" },
        { status: 404 }
      );
    }

    const readingData = reading as any;
    if (!["draft", "in_progress"].includes(readingData.edl.status)) {
      return NextResponse.json(
        { error: "L'EDL ne peut plus être modifié à ce stade" },
        { status: 400 }
      );
    }

    // Supprimer la photo du storage
    if (readingData.photo_path) {
      await supabase.storage
        .from("documents")
        .remove([readingData.photo_path]);
    }

    // Supprimer le relevé
    const { error: deleteError } = await supabase
      .from("edl_meter_readings")
      .delete()
      .eq("id", readingId);

    if (deleteError) throw deleteError;

    // Journaliser la suppression
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_meter_reading_deleted",
      entity_type: "edl_meter_reading",
      entity_id: readingId,
      metadata: {
        edl_id: edlId,
        meter_id: readingData.meter_id,
        reading_value: readingData.reading_value,
      },
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("[EDL Meter Reading] DELETE Error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

