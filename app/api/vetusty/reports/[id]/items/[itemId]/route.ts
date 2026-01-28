/**
 * API Route: PUT/DELETE /api/vetusty/reports/[id]/items/[itemId]
 * Gestion d'un élément spécifique du rapport de vétusté
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour mise à jour
const UpdateItemSchema = z.object({
  age_years: z.number().min(0).optional(),
  repair_cost: z.number().min(0).optional(),
  notes: z.string().optional(),
  photo_urls: z.array(z.string()).optional(),
  invoice_url: z.string().optional(),
  is_contested: z.boolean().optional(),
  contest_reason: z.string().optional(),
});

interface RouteParams {
  params: { id: string; itemId: string };
}

/**
 * PUT /api/vetusty/reports/[id]/items/[itemId]
 * Mettre à jour un élément
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: reportId, itemId } = params;

    // Vérifier que le rapport existe
    const { data: report } = await supabase
      .from("vetusty_reports")
      .select("status")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Rapport non trouvé" }, { status: 404 });
    }

    // Parser et valider le body
    const body = await request.json();
    const validation = UpdateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Si le rapport n'est plus en brouillon, seule la contestation est autorisée
    if (report.status !== "draft") {
      const allowedFields = ["is_contested", "contest_reason"];
      const hasOtherFields = Object.keys(data).some(
        (key) => !allowedFields.includes(key)
      );

      if (hasOtherFields) {
        return NextResponse.json(
          { error: "Seule la contestation est autorisée sur un rapport validé" },
          { status: 400 }
        );
      }
    }

    // Mettre à jour
    const { data: item, error } = await supabase
      .from("vetusty_items")
      .update(data)
      .eq("id", itemId)
      .eq("report_id", reportId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Item non trouvé" }, { status: 404 });
      }
      console.error("Erreur mise à jour item:", error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id]/items/[itemId] PUT:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vetusty/reports/[id]/items/[itemId]
 * Supprimer un élément
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id: reportId, itemId } = params;

    // Vérifier que le rapport est en brouillon
    const { data: report } = await supabase
      .from("vetusty_reports")
      .select("status")
      .eq("id", reportId)
      .single();

    if (!report) {
      return NextResponse.json({ error: "Rapport non trouvé" }, { status: 404 });
    }

    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Impossible de supprimer des items d'un rapport non brouillon" },
        { status: 400 }
      );
    }

    // Supprimer
    const { error } = await supabase
      .from("vetusty_items")
      .delete()
      .eq("id", itemId)
      .eq("report_id", reportId);

    if (error) {
      console.error("Erreur suppression item:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id]/items/[itemId] DELETE:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
