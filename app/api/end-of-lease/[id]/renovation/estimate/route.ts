export const runtime = 'nodejs';

/**
 * API Route: Estimation des coûts de rénovation
 * POST /api/end-of-lease/:id/renovation/estimate
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const estimateSchema = z.object({
  items: z.array(z.object({
    work_type: z.string(),
    surface_or_quantity: z.number(),
    description: z.string().optional(),
  })).optional(),
  zone: z.string().optional().default("france"),
});

// Coefficients par zone
const ZONE_COEFFICIENTS: Record<string, number> = {
  paris: 1.30,
  idf: 1.20,
  lyon: 1.10,
  marseille: 1.05,
  drom: 1.15,
  france: 1.0,
};

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
    const validatedData = estimateSchema.parse(body);
    const zoneCoef = ZONE_COEFFICIENTS[validatedData.zone || "france"] || 1.0;

    // Récupérer le processus avec les items d'inspection
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select(`
        *,
        inspection_items:edl_inspection_items(*),
        property:properties(surface, ville, departement)
      `)
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // Récupérer la grille des coûts
    const { data: costGrid } = await supabase
      .from("repair_cost_grid")
      .select("*")
      .eq("is_active", true);

    const costGridMap = new Map(
      (costGrid || []).map((item) => [item.work_type, item])
    );

    // Calculer les estimations
    const estimatedItems: any[] = [];
    let totalTenantResponsibility = 0;
    let totalOwnerResponsibility = 0;
    let totalRecommendedRenovation = 0;

    // Si des items spécifiques sont fournis
    if (validatedData.items && validatedData.items.length > 0) {
      for (const item of validatedData.items) {
        const gridItem = costGridMap.get(item.work_type);
        if (gridItem) {
          const typedItem = gridItem as Record<string, any>;
          const costMin = typedItem.cost_min * item.surface_or_quantity * zoneCoef;
          const costMax = typedItem.cost_max * item.surface_or_quantity * zoneCoef;
          const costAvg = typedItem.cost_avg * item.surface_or_quantity * zoneCoef;

          estimatedItems.push({
            work_type: item.work_type,
            description: item.description || gridItem.description,
            unit: gridItem.unit,
            quantity: item.surface_or_quantity,
            cost_min: Math.round(costMin * 100) / 100,
            cost_max: Math.round(costMax * 100) / 100,
            cost_avg: Math.round(costAvg * 100) / 100,
          });

          totalRecommendedRenovation += costAvg;
        }
      }
    }

    // Sinon, estimer à partir des items d'inspection
    const inspectionItems = process.inspection_items as any[] || [];
    const surface = (process.property as any)?.surface || 50; // Surface par défaut

    for (const item of inspectionItems) {
      if (item.status === "problem" && item.estimated_cost > 0) {
        // Mapper la catégorie au type de travaux
        const workTypeMap: Record<string, string> = {
          murs: "peinture",
          sols: "sol",
          salle_de_bain: "salle_de_bain",
          cuisine: "cuisine",
          fenetres_portes: "menuiserie",
          electricite_plomberie: "plomberie",
          meubles: "autres",
        };

        const workType = workTypeMap[item.category] || "autres";
        const gridItem = costGridMap.get(workType);

        if (gridItem) {
          const typedItem = gridItem as Record<string, any>;
          // Estimer la surface/quantité concernée (environ 20% de la surface totale par défaut)
          const quantity = typedItem.unit === "m2" ? Math.ceil(surface * 0.2) : 1;
          const costAvg = typedItem.cost_avg * quantity * zoneCoef;

          estimatedItems.push({
            work_type: workType,
            description: `${typedItem.description} (${item.category})`,
            unit: typedItem.unit,
            quantity,
            cost_min: Math.round(typedItem.cost_min * quantity * zoneCoef * 100) / 100,
            cost_max: Math.round(typedItem.cost_max * quantity * zoneCoef * 100) / 100,
            cost_avg: Math.round(costAvg * 100) / 100,
          });

          // Répartir selon le type de dommage
          if (item.damage_type === "tenant_damage") {
            totalTenantResponsibility += costAvg;
          } else if (item.damage_type === "normal_wear") {
            totalOwnerResponsibility += costAvg;
          } else {
            totalRecommendedRenovation += costAvg;
          }
        }
      }
    }

    // Utiliser les valeurs du processus si disponibles
    if ((process as any).tenant_damage_cost > 0) {
      totalTenantResponsibility = (process as any).tenant_damage_cost;
    }
    if ((process as any).vetusty_cost > 0) {
      totalOwnerResponsibility = (process as any).vetusty_cost;
    }

    const estimate = {
      items: estimatedItems,
      totals: {
        tenant_responsibility: Math.round(totalTenantResponsibility * 100) / 100,
        owner_responsibility: Math.round(totalOwnerResponsibility * 100) / 100,
        recommended_renovation: Math.round(totalRecommendedRenovation * 100) / 100,
        total_budget: Math.round(
          (totalTenantResponsibility + totalOwnerResponsibility + totalRecommendedRenovation) * 100
        ) / 100,
      },
    };

    // Mettre à jour le processus avec les coûts estimés
    await supabase
      .from("lease_end_processes")
      .update({
        renovation_cost: estimate.totals.recommended_renovation,
        total_budget: estimate.totals.total_budget,
      })
      .eq("id", id);

    return NextResponse.json({ estimate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API renovation/estimate:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

