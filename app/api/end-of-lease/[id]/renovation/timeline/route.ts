// @ts-nocheck
/**
 * API Route: Génération du planning de rénovation
 * POST /api/end-of-lease/:id/renovation/timeline
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const timelineSchema = z.object({
  start_date: z.string().optional(),
  renovation_items_count: z.number().optional(),
  include_quotes: z.boolean().default(true),
});

// Actions par défaut du plan en 7 jours
const DEFAULT_TIMELINE_ACTIONS = [
  {
    day_offset: 0,
    action_type: "dg_retention",
    title: "Déduire la retenue sur DG",
    description: "Calcul automatique + génération du justificatif PDF",
  },
  {
    day_offset: 1,
    action_type: "request_quotes",
    title: "Demander des devis",
    description: "Contacter 2 artisans locaux pour les travaux identifiés",
  },
  {
    day_offset: 2,
    action_type: "select_quote",
    title: "Choisir le devis",
    description: "Sélectionner le meilleur rapport qualité/prix",
  },
  {
    day_offset: 3,
    action_type: "start_renovation",
    title: "Début des travaux",
    description: "Travaux rapides : peinture, joints, nettoyage",
  },
  {
    day_offset: 5,
    action_type: "start_renovation",
    title: "Fin des travaux",
    description: "Vérification finale de la qualité",
  },
  {
    day_offset: 6,
    action_type: "take_photos",
    title: "Nouvelles photos",
    description: "Séance photos pour la remise en location",
  },
  {
    day_offset: 7,
    action_type: "mark_ready",
    title: "Logement prêt",
    description: "Activer le workflow nouveau locataire",
  },
];

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
    const validatedData = timelineSchema.parse(body);

    // Récupérer le processus
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select(`
        *,
        renovation_items:renovation_items(*)
      `)
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // Date de départ (aujourd'hui par défaut)
    const startDate = validatedData.start_date
      ? new Date(validatedData.start_date)
      : new Date();

    // Supprimer l'ancienne timeline si elle existe
    await supabase
      .from("lease_end_timeline")
      .delete()
      .eq("lease_end_process_id", id);

    // Adapter le timeline selon le nombre de travaux
    const renovationItems = process.renovation_items as any[] || [];
    const hasRenovation = renovationItems.length > 0;

    // Créer les actions de la timeline
    const timelineItems: any[] = [];
    let maxDayOffset = 0;

    for (const action of DEFAULT_TIMELINE_ACTIONS) {
      // Si pas de rénovation, skip les étapes liées aux travaux
      if (!hasRenovation && ["request_quotes", "select_quote", "start_renovation"].includes(action.action_type)) {
        continue;
      }

      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + action.day_offset);

      timelineItems.push({
        lease_end_process_id: id,
        day_offset: action.day_offset,
        action_type: action.action_type,
        title: action.title,
        description: action.description,
        status: "pending",
        scheduled_date: scheduledDate.toISOString().split("T")[0],
      });

      if (action.day_offset > maxDayOffset) {
        maxDayOffset = action.day_offset;
      }
    }

    // Si beaucoup de travaux, ajouter des jours supplémentaires
    if (renovationItems.length > 3) {
      const extraDays = Math.min(renovationItems.length - 3, 7); // Max 7 jours supplémentaires
      
      // Décaler les dernières actions
      for (const item of timelineItems) {
        if (item.action_type === "take_photos" || item.action_type === "mark_ready") {
          item.day_offset += extraDays;
          const newDate = new Date(startDate);
          newDate.setDate(newDate.getDate() + item.day_offset);
          item.scheduled_date = newDate.toISOString().split("T")[0];
        }
      }
      maxDayOffset += extraDays;
    }

    // Insérer la timeline
    const { data: insertedItems, error: insertError } = await supabase
      .from("lease_end_timeline")
      .insert(timelineItems)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Calculer la date estimée de disponibilité
    const estimatedReadyDate = new Date(startDate);
    estimatedReadyDate.setDate(estimatedReadyDate.getDate() + maxDayOffset);

    // Mettre à jour le processus
    await supabase
      .from("lease_end_processes")
      .update({
        status: "renovation_planned",
        progress_percentage: 65,
        renovation_start_date: startDate.toISOString().split("T")[0],
      })
      .eq("id", id);

    const timeline = {
      items: insertedItems || [],
      estimated_ready_date: estimatedReadyDate.toISOString().split("T")[0],
      total_days: maxDayOffset,
    };

    return NextResponse.json({ timeline });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API renovation/timeline:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

