export const runtime = 'nodejs';

/**
 * API Route: Calcul de la retenue sur Dépôt de Garantie
 * POST /api/end-of-lease/:id/dg/retention
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const retentionSchema = z.object({
  damages: z.array(z.object({
    category: z.string(),
    item: z.string(),
    original_cost: z.number(),
    age_years: z.number(),
    damage_cost: z.number(),
  })).optional(),
  apply_vetusty: z.boolean().default(true),
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
    const validatedData = retentionSchema.parse(body);

    // Récupérer le processus avec le type de bail
    const { data: process, error: processError } = await supabase
      .from("lease_end_processes")
      .select(`
        *,
        lease:leases(date_debut, depot_de_garantie, type_bail),
        inspection_items:edl_inspection_items(*)
      `)
      .eq("id", id)
      .single();

    if (processError || !process) {
      return NextResponse.json({ error: "Processus non trouvé" }, { status: 404 });
    }

    // ✅ GAP-003 FIX: Skip retenue DG pour bail mobilité (Art. 25-13 Loi ELAN)
    const typeBail = (process.lease as any)?.type_bail;
    if (typeBail === "bail_mobilite") {
      // Bail mobilité = pas de dépôt de garantie = pas de retenue possible
      await supabase
        .from("lease_end_processes")
        .update({
          status: "dg_calculated",
          progress_percentage: 55,
          dg_retention_amount: 0,
          dg_refund_amount: 0,
        })
        .eq("id", id);

      return NextResponse.json({
        result: {
          dg_amount: 0,
          retention_details: [],
          total_retention: 0,
          total_refund: 0,
          message: "Bail mobilité: pas de dépôt de garantie (Art. 25-13 Loi ELAN)",
        },
      });
    }

    // Récupérer la grille de vétusté
    const { data: vetustyGrid } = await supabase
      .from("vetusty_grid")
      .select("*")
      .eq("is_active", true);

    const vetustyMap = new Map(
      (vetustyGrid || []).map((item) => [`${item.category}_${item.item}`, item])
    );

    // Calculer l'âge du bail
    const leaseStartDate = new Date((process.lease as any).date_debut);
    const defaultAgeYears = Math.floor(
      (Date.now() - leaseStartDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Calculer les retenues
    const retentionDetails: any[] = [];
    let totalRetention = 0;

    // Si des dommages spécifiques sont fournis
    if (validatedData.damages && validatedData.damages.length > 0) {
      for (const damage of validatedData.damages) {
        const vetustyKey = `${damage.category}_${damage.item}`;
        const vetustyItem = vetustyMap.get(vetustyKey);

        let vetustyRate = 0;
        let tenantShare = damage.damage_cost;
        let ownerShare = 0;

        if (validatedData.apply_vetusty && vetustyItem) {
          // Calculer la dépréciation
          vetustyRate = Math.min(
            damage.age_years * vetustyItem.yearly_depreciation,
            1 - vetustyItem.min_residual_value
          );
          
          // La part locataire diminue avec la vétusté
          tenantShare = damage.damage_cost * (1 - vetustyRate);
          ownerShare = damage.damage_cost * vetustyRate;
        }

        retentionDetails.push({
          category: damage.category,
          item: damage.item,
          damage_cost: damage.damage_cost,
          vetusty_rate: Math.round(vetustyRate * 100) / 100,
          tenant_share: Math.round(tenantShare * 100) / 100,
          owner_share: Math.round(ownerShare * 100) / 100,
        });

        totalRetention += tenantShare;
      }
    } else {
      // Sinon, utiliser les items d'inspection
      const inspectionItems = process.inspection_items as any[] || [];
      
      for (const item of inspectionItems) {
        if (item.damage_type === "tenant_damage" && item.estimated_cost > 0) {
          // Trouver la vétusté correspondante
          const categoryMap: Record<string, string> = {
            murs: "peinture",
            sols: "sol",
            salle_de_bain: "equipement",
            cuisine: "equipement",
            fenetres_portes: "menuiserie",
            electricite_plomberie: "equipement",
            meubles: "meuble",
          };

          const vetustyCategory = categoryMap[item.category] || "peinture";
          let vetustyItem = vetustyMap.get(`${vetustyCategory}_Peinture standard`);
          
          // Chercher un item correspondant
          for (const [key, value] of vetustyMap) {
            if (key.startsWith(vetustyCategory)) {
              vetustyItem = value;
              break;
            }
          }

          let vetustyRate = 0;
          let tenantShare = item.estimated_cost;
          let ownerShare = 0;

          if (validatedData.apply_vetusty && vetustyItem) {
            vetustyRate = Math.min(
              defaultAgeYears * vetustyItem.yearly_depreciation,
              1 - vetustyItem.min_residual_value
            );
            tenantShare = item.estimated_cost * (1 - vetustyRate);
            ownerShare = item.estimated_cost * vetustyRate;
          }

          retentionDetails.push({
            category: item.category,
            item: vetustyItem?.item || "Standard",
            damage_cost: item.estimated_cost,
            vetusty_rate: Math.round(vetustyRate * 100) / 100,
            tenant_share: Math.round(tenantShare * 100) / 100,
            owner_share: Math.round(ownerShare * 100) / 100,
          });

          totalRetention += tenantShare;
        }
      }
    }

    // Plafonner la retenue au montant du dépôt de garantie
    const dgAmount = process.dg_amount || (process.lease as any).depot_de_garantie || 0;
    const finalRetention = Math.min(totalRetention, dgAmount);
    const refundAmount = dgAmount - finalRetention;

    // Mettre à jour le processus
    await supabase
      .from("lease_end_processes")
      .update({
        status: "dg_calculated",
        progress_percentage: 55,
        dg_retention_amount: Math.round(finalRetention * 100) / 100,
        dg_refund_amount: Math.round(refundAmount * 100) / 100,
      })
      .eq("id", id);

    const result = {
      dg_amount: dgAmount,
      retention_details: retentionDetails,
      total_retention: Math.round(finalRetention * 100) / 100,
      total_refund: Math.round(refundAmount * 100) / 100,
    };

    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API dg/retention:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

