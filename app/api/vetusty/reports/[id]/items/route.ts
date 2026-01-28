/**
 * API Route: GET/POST /api/vetusty/reports/[id]/items
 * Gestion des éléments d'un rapport de vétusté
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour création d'item
const CreateItemSchema = z.object({
  vetusty_grid_item_id: z.string(),
  item_name: z.string(),
  category: z.string(),
  age_years: z.number().min(0),
  lifespan_years: z.number().min(1),
  franchise_years: z.number().min(0),
  vetusty_rate: z.number().min(0).max(100),
  repair_cost: z.number().min(0),
  owner_share: z.number().min(0),
  tenant_share: z.number().min(0),
  room_name: z.string().optional(),
  edl_entry_item_id: z.string().uuid().optional(),
  edl_exit_item_id: z.string().uuid().optional(),
  is_degradation: z.boolean().default(true),
  notes: z.string().optional(),
  photo_urls: z.array(z.string()).optional(),
  invoice_url: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/vetusty/reports/[id]/items
 * Liste tous les items d'un rapport
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const reportId = params.id;

    // Récupérer les items
    const { data: items, error } = await supabase
      .from("vetusty_items")
      .select("*")
      .eq("report_id", reportId)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erreur récupération items:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id]/items GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vetusty/reports/[id]/items
 * Ajouter un élément au rapport
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const reportId = params.id;

    // Vérifier que le rapport existe et est en brouillon
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
        { error: "Impossible d'ajouter des items à un rapport non brouillon" },
        { status: 400 }
      );
    }

    // Parser et valider le body
    const body = await request.json();
    const validation = CreateItemSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Créer l'item
    const { data: item, error } = await supabase
      .from("vetusty_items")
      .insert({
        report_id: reportId,
        vetusty_grid_item_id: data.vetusty_grid_item_id,
        item_name: data.item_name,
        category: data.category,
        age_years: data.age_years,
        lifespan_years: data.lifespan_years,
        franchise_years: data.franchise_years,
        vetusty_rate: data.vetusty_rate,
        repair_cost: data.repair_cost,
        owner_share: data.owner_share,
        tenant_share: data.tenant_share,
        room_name: data.room_name,
        edl_entry_item_id: data.edl_entry_item_id,
        edl_exit_item_id: data.edl_exit_item_id,
        is_degradation: data.is_degradation,
        notes: data.notes,
        photo_urls: data.photo_urls,
        invoice_url: data.invoice_url,
      })
      .select()
      .single();

    if (error) {
      console.error("Erreur création item:", error);
      return NextResponse.json(
        { error: "Erreur lors de la création de l'item" },
        { status: 500 }
      );
    }

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Erreur API vetusty/reports/[id]/items POST:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
