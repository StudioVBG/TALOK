// @ts-nocheck
/**
 * API Route: Soumission d'un item d'inspection EDL
 * POST /api/end-of-lease/:id/inspection
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const inspectionSchema = z.object({
  category: z.enum([
    "murs",
    "sols",
    "salle_de_bain",
    "cuisine",
    "fenetres_portes",
    "electricite_plomberie",
    "meubles",
  ]),
  status: z.enum(["pending", "ok", "problem"]),
  problem_description: z.string().optional(),
  photos: z.array(z.string()).optional(),
  estimated_cost: z.number().optional(),
  notes: z.string().optional(),
});

// GET - Récupérer les items d'inspection
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

    const { data: items, error } = await supabase
      .from("edl_inspection_items")
      .select("*")
      .eq("lease_end_process_id", id)
      .order("category");

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: items || [] });
  } catch (error) {
    console.error("Erreur API inspection GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST - Soumettre ou mettre à jour un item d'inspection
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
    const validatedData = inspectionSchema.parse(body);

    // Vérifier que le processus existe
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select("id")
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // Chercher si l'item existe déjà
    const { data: existingItem } = await supabase
      .from("edl_inspection_items")
      .select("id, photos")
      .eq("lease_end_process_id", id)
      .eq("category", validatedData.category)
      .single();

    let item;

    if (existingItem) {
      // Fusionner les photos existantes avec les nouvelles
      const existingPhotos = existingItem.photos || [];
      const newPhotos = validatedData.photos || [];
      const allPhotos = [...existingPhotos, ...newPhotos];

      // Mettre à jour l'item existant
      const { data, error } = await supabase
        .from("edl_inspection_items")
        .update({
          status: validatedData.status,
          problem_description: validatedData.problem_description,
          photos: allPhotos,
          estimated_cost: validatedData.estimated_cost || 0,
          notes: validatedData.notes,
        })
        .eq("id", existingItem.id)
        .select()
        .single();

      if (error) throw error;
      item = data;
    } else {
      // Créer un nouvel item
      const { data, error } = await supabase
        .from("edl_inspection_items")
        .insert({
          lease_end_process_id: id,
          category: validatedData.category,
          status: validatedData.status,
          problem_description: validatedData.problem_description,
          photos: validatedData.photos || [],
          estimated_cost: validatedData.estimated_cost || 0,
          notes: validatedData.notes,
        })
        .select()
        .single();

      if (error) throw error;
      item = data;
    }

    // Vérifier si tous les items sont complétés
    const { data: allItems } = await supabase
      .from("edl_inspection_items")
      .select("status")
      .eq("lease_end_process_id", id);

    const allCompleted = allItems?.every((i) => i.status !== "pending");

    if (allCompleted) {
      // Mettre à jour le processus
      await supabase
        .from("lease_end_processes")
        .update({
          status: "edl_completed",
          edl_completed_date: new Date().toISOString().split("T")[0],
          progress_percentage: 35,
        })
        .eq("id", id);
    } else {
      // S'assurer que le statut est "edl_in_progress"
      await supabase
        .from("lease_end_processes")
        .update({
          status: "edl_in_progress",
          progress_percentage: 25,
        })
        .eq("id", id);
    }

    return NextResponse.json({ item });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API inspection POST:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

