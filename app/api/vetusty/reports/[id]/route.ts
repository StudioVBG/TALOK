/**
 * API Route: GET/PUT/DELETE /api/vetusty/reports/[id]
 * Gestion d'un rapport de vétusté spécifique
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { z } from "zod";

// Schema de validation pour mise à jour
const UpdateReportSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(["draft", "validated", "contested", "final"]).optional(),
});

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/vetusty/reports/[id]
 * Récupérer un rapport de vétusté avec ses items
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const reportId = params.id;

    // Récupérer le rapport avec ses items
    const { data: report, error } = await supabase
      .from("vetusty_reports")
      .select(`
        *,
        lease:leases(
          id,
          type_bail,
          loyer,
          depot_de_garantie,
          date_debut,
          date_fin,
          property:properties(
            id,
            adresse_complete,
            ville,
            surface
          )
        ),
        items:vetusty_items(*)
      `)
      .eq("id", reportId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Rapport non trouvé" }, { status: 404 });
      }
      console.error("Erreur récupération rapport:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération du rapport" },
        { status: 500 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id] GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vetusty/reports/[id]
 * Mettre à jour un rapport de vétusté
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const reportId = params.id;

    // Parser et valider le body
    const body = await request.json();
    const validation = UpdateReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Préparer les données de mise à jour
    const updateData: Record<string, any> = {};
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === "validated") {
        updateData.validated_at = new Date().toISOString();
      }
    }

    // Mettre à jour
    const { data: report, error } = await supabase
      .from("vetusty_reports")
      .update(updateData)
      .eq("id", reportId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Rapport non trouvé" }, { status: 404 });
      }
      console.error("Erreur mise à jour rapport:", error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id] PUT:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vetusty/reports/[id]
 * Supprimer un rapport de vétusté (uniquement si brouillon)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const reportId = params.id;

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
        { error: "Seuls les rapports en brouillon peuvent être supprimés" },
        { status: 400 }
      );
    }

    // Supprimer (cascade sur les items)
    const { error } = await supabase
      .from("vetusty_reports")
      .delete()
      .eq("id", reportId);

    if (error) {
      console.error("Erreur suppression rapport:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id] DELETE:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
