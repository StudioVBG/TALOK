// @ts-nocheck
/**
 * API Route: EDL Sortie
 * POST /api/end-of-lease/:id/edl-out - Démarrer/planifier l'EDL de sortie
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const edlOutSchema = z.object({
  scheduled_date: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = edlOutSchema.parse(body);

    // Vérifier que le processus existe
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select("*, lease:leases(id)")
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // Mettre à jour le processus avec la date d'EDL
    const scheduledDate = validatedData.scheduled_date || new Date().toISOString().split("T")[0];
    
    const { data: updatedProcess, error: updateError } = await supabase
      .from("lease_end_processes")
      .update({
        status: validatedData.scheduled_date ? "edl_scheduled" : "edl_in_progress",
        edl_scheduled_date: scheduledDate,
        progress_percentage: validatedData.scheduled_date ? 15 : 25,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Créer un EDL de sortie dans la table edl si elle existe
    const { data: edl } = await supabase
      .from("edl")
      .insert({
        lease_id: (process.lease as any).id,
        type: "sortie",
        status: "draft",
        scheduled_date: scheduledDate,
        created_by: user.id,
      })
      .select()
      .single();

    if (edl) {
      await supabase
        .from("lease_end_processes")
        .update({ edl_sortie_id: edl.id })
        .eq("id", id);
    }

    return NextResponse.json({ 
      process: updatedProcess,
      edl_id: edl?.id 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API edl-out:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

