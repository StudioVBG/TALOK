// @ts-nocheck
/**
 * API Route: Comparaison EDL Entrée/Sortie
 * POST /api/end-of-lease/:id/compare - Comparer automatiquement les EDL
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const compareSchema = z.object({
  edl_entree_id: z.string().uuid().optional(),
});

interface ComparisonItem {
  category: string;
  entry_status: string;
  exit_status: string;
  has_degradation: boolean;
  damage_type: string | null;
  estimated_cost: number;
  photos_comparison: {
    entry: string[];
    exit: string[];
  };
}

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
    const validatedData = compareSchema.parse(body);

    // Récupérer le processus
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select(`
        *,
        lease:leases(id, date_debut),
        inspection_items:edl_inspection_items(*)
      `)
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // Récupérer l'EDL d'entrée (le plus récent pour ce bail)
    let edlEntreeId = validatedData.edl_entree_id;
    if (!edlEntreeId) {
      const { data: edlEntree } = await supabase
        .from("edl")
        .select("id")
        .eq("lease_id", (process.lease as any).id)
        .eq("type", "entree")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      edlEntreeId = edlEntree?.id;
    }

    // Récupérer les items de l'EDL d'entrée
    let entryItems: any[] = [];
    if (edlEntreeId) {
      const { data } = await supabase
        .from("edl_items")
        .select("*")
        .eq("edl_id", edlEntreeId);
      entryItems = data || [];
    }

    // Comparer les items d'inspection
    const inspectionItems = process.inspection_items as any[] || [];
    const comparisonItems: ComparisonItem[] = [];
    let totalTenantDamage = 0;
    let totalVetusty = 0;
    let tenantDamageCount = 0;
    let normalWearCount = 0;

    for (const exitItem of inspectionItems) {
      // Trouver l'item correspondant dans l'EDL d'entrée
      const entryItem = entryItems.find(
        (e) => e.room_name === exitItem.category || e.item_name === exitItem.category
      );

      const entryStatus = entryItem?.condition || "bon";
      const exitStatus = exitItem.status === "ok" ? "bon" : "problem";
      const hasDegradation = exitStatus === "problem" && entryStatus === "bon";

      // Déterminer le type de dommage
      let damageType: string | null = null;
      let estimatedCost = exitItem.estimated_cost || 0;

      if (hasDegradation) {
        // Calculer l'âge en années depuis le début du bail
        const leaseStartDate = new Date((process.lease as any).date_debut);
        const ageYears = Math.floor(
          (Date.now() - leaseStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
        );

        // Si le bail a plus de 5 ans, c'est plus probablement de la vétusté
        if (ageYears > 5) {
          damageType = "normal_wear";
          normalWearCount++;
          totalVetusty += estimatedCost * 0.6; // 60% vétusté
          estimatedCost = estimatedCost * 0.4; // 40% locataire
        } else {
          damageType = "tenant_damage";
          tenantDamageCount++;
          totalTenantDamage += estimatedCost;
        }
      }

      comparisonItems.push({
        category: exitItem.category,
        entry_status: entryStatus,
        exit_status: exitStatus,
        has_degradation: hasDegradation,
        damage_type: damageType,
        estimated_cost: estimatedCost,
        photos_comparison: {
          entry: entryItem?.photos || [],
          exit: exitItem.photos || [],
        },
      });

      // Mettre à jour l'item d'inspection avec le type de dommage
      if (damageType) {
        await supabase
          .from("edl_inspection_items")
          .update({
            damage_type: damageType,
            entry_condition: entryStatus,
            estimated_cost: estimatedCost,
          })
          .eq("id", exitItem.id);
      }
    }

    // Mettre à jour le processus avec les totaux
    await supabase
      .from("lease_end_processes")
      .update({
        status: "damages_assessed",
        progress_percentage: 45,
        tenant_damage_cost: totalTenantDamage,
        vetusty_cost: totalVetusty,
      })
      .eq("id", id);

    const comparison = {
      items: comparisonItems,
      summary: {
        total_items: comparisonItems.length,
        items_degraded: comparisonItems.filter((i) => i.has_degradation).length,
        tenant_damage_count: tenantDamageCount,
        normal_wear_count: normalWearCount,
        tenant_damage_cost: totalTenantDamage,
        vetusty_cost: totalVetusty,
      },
    };

    return NextResponse.json({ comparison });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API compare:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

