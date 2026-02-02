export const runtime = 'nodejs';

/**
 * API Route: Processus de Fin de Bail par ID
 * GET /api/end-of-lease/:id - Détails du processus
 * PATCH /api/end-of-lease/:id - Mettre à jour le processus
 * DELETE /api/end-of-lease/:id - Annuler le processus
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateProcessSchema = z.object({
  status: z.enum([
    "pending",
    "triggered",
    "edl_scheduled",
    "edl_in_progress",
    "edl_completed",
    "damages_assessed",
    "dg_calculated",
    "renovation_planned",
    "renovation_in_progress",
    "ready_to_rent",
    "completed",
    "cancelled",
  ]).optional(),
  edl_scheduled_date: z.string().optional(),
  edl_completed_date: z.string().optional(),
  renovation_start_date: z.string().optional(),
  renovation_end_date: z.string().optional(),
  ready_to_rent_date: z.string().optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

// GET - Détails d'un processus
export async function GET(
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

    // Récupérer le processus avec toutes les relations
    const { data: process, error } = await supabase
      .from("lease_end_processes")
      .select(`
        *,
        property:properties(id, adresse_complete, ville, type, surface),
        lease:leases(id, type_bail, loyer, date_debut, date_fin),
        inspection_items:edl_inspection_items(*),
        renovation_items:renovation_items(*, quotes:renovation_quotes(*)),
        timeline:lease_end_timeline(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ process });
  } catch (error) {
    console.error("Erreur API end-of-lease GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// PATCH - Mettre à jour un processus
export async function PATCH(
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
    const validatedData = updateProcessSchema.parse(body);

    // Calculer le pourcentage de progression si le statut change
    let progressPercentage = validatedData.progress_percentage;
    if (validatedData.status && !progressPercentage) {
      const progressMap: Record<string, number> = {
        pending: 0,
        triggered: 10,
        edl_scheduled: 15,
        edl_in_progress: 25,
        edl_completed: 35,
        damages_assessed: 45,
        dg_calculated: 55,
        renovation_planned: 65,
        renovation_in_progress: 75,
        ready_to_rent: 90,
        completed: 100,
        cancelled: 0,
      };
      progressPercentage = progressMap[validatedData.status];
    }

    const { data: process, error } = await supabase
      .from("lease_end_processes")
      .update({
        ...validatedData,
        progress_percentage: progressPercentage,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
      }
      throw error;
    }

    // Si le statut passe à "ready_to_rent", mettre à jour le statut du logement
    if (validatedData.status === "ready_to_rent") {
      await supabase
        .from("properties")
        .update({ rental_status: "ready_to_rent" })
        .eq("id", (process as any).property_id);
    }

    return NextResponse.json({ process });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API end-of-lease PATCH:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// DELETE - Annuler un processus
export async function DELETE(
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

    // Annuler le processus (soft delete)
    const { error } = await supabase
      .from("lease_end_processes")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur API end-of-lease DELETE:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

