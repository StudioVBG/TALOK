export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { verifyEDLAccess } from "@/lib/helpers/edl-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const retenueSchema = z.object({
  items: z.array(
    z.object({
      item_id: z.string().uuid(),
      cout_reparation_cents: z.number().int().min(0),
      vetuste_applicable: z.boolean().default(false),
    })
  ),
});

/**
 * GET /api/edl/[id]/retenues
 * Calcule automatiquement les retenues avec vétusté pour un EDL sortie
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const accessResult = await verifyEDLAccess(
      { edlId, userId: user.id, profileId: profile.id, profileRole: profile.role },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edl = accessResult.edl as Record<string, unknown>;

    if (edl.type !== "sortie") {
      return NextResponse.json(
        { error: "Les retenues ne s'appliquent qu'aux EDL de sortie" },
        { status: 400 }
      );
    }

    // Find entry EDL for date calculation
    let entryEdlId = edl.linked_entry_edl_id as string | null;
    if (!entryEdlId) {
      const { data: entryEdl } = await serviceClient
        .from("edl")
        .select("id, completed_date, scheduled_date, created_at")
        .eq("lease_id", edl.lease_id as string)
        .eq("type", "entree")
        .in("status", ["signed", "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (entryEdl) {
        entryEdlId = entryEdl.id;
      }
    }

    // Get entry EDL date for duration calculation
    let dateEntree: Date | null = null;
    if (entryEdlId) {
      const { data: entryEdl } = await serviceClient
        .from("edl")
        .select("completed_date, scheduled_date, created_at")
        .eq("id", entryEdlId)
        .single();

      if (entryEdl) {
        const ed = entryEdl as Record<string, unknown>;
        dateEntree = new Date(
          (ed.completed_date || ed.scheduled_date || ed.created_at) as string
        );
      }
    }

    const dateSortie = new Date(
      (edl.completed_date || edl.scheduled_date || edl.created_at) as string
    );

    // Duration in years
    const dureeOccupationAns = dateEntree
      ? (dateSortie.getTime() - dateEntree.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    // Get items with degradations
    const { data: items } = await serviceClient
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId)
      .eq("degradation_noted", true);

    // Get vetuste grid
    const { data: vetusteGrid } = await serviceClient
      .from("vetuste_grid")
      .select("*");

    const gridMap = new Map<string, Record<string, unknown>>();
    for (const g of vetusteGrid || []) {
      gridMap.set(g.element_type as string, g as Record<string, unknown>);
    }

    // Calculate retenues for each degraded item
    const retenues = (items || []).map((item: Record<string, unknown>) => {
      const elementType = item.element_type as string | null;
      const coutReparation = (item.cout_reparation_cents as number) || 0;
      const gridEntry = elementType ? gridMap.get(elementType) : null;

      let coefficient = 1.0;
      let vetusteApplicable = false;

      if (gridEntry && dureeOccupationAns > 0) {
        const dureeVie = gridEntry.duree_vie_ans as number;
        const valeurResiduelleMin = (gridEntry.valeur_residuelle_min as number) || 0.1;
        coefficient = Math.max(
          valeurResiduelleMin,
          1 - dureeOccupationAns / dureeVie
        );
        vetusteApplicable = true;
      }

      const retenueNette = Math.round(coutReparation * coefficient);

      return {
        item_id: item.id,
        room_name: item.room_name,
        item_name: item.item_name,
        element_type: elementType,
        entry_condition: item.entry_condition,
        exit_condition: item.condition,
        cout_reparation_cents: coutReparation,
        vetuste_applicable: vetusteApplicable,
        vetuste_coefficient: Math.round(coefficient * 100) / 100,
        duree_vie_ans: gridEntry ? (gridEntry.duree_vie_ans as number) : null,
        retenue_cents: retenueNette,
        photos: item.photos,
      };
    });

    const totalRetenue = retenues.reduce((s, r) => s + r.retenue_cents, 0);

    // Get deposit from lease
    const { data: lease } = await serviceClient
      .from("leases")
      .select("depot_garantie")
      .eq("id", edl.lease_id as string)
      .single();

    const depotGarantieCents = lease
      ? Math.round(((lease as Record<string, unknown>).depot_garantie as number || 0) * 100)
      : (edl.depot_garantie_cents as number) || 0;

    const montantRestitue = Math.max(0, depotGarantieCents - totalRetenue);

    return NextResponse.json({
      edl_id: edlId,
      duree_occupation_ans: Math.round(dureeOccupationAns * 100) / 100,
      date_entree: dateEntree?.toISOString() || null,
      date_sortie: dateSortie.toISOString(),
      retenues,
      summary: {
        total_retenue_cents: totalRetenue,
        depot_garantie_cents: depotGarantieCents,
        montant_restitue_cents: montantRestitue,
        nb_degradations: retenues.length,
      },
    });
  } catch (error: unknown) {
    console.error("[GET /api/edl/[id]/retenues] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/edl/[id]/retenues
 * Enregistre les retenues calculées et met à jour l'EDL sortie
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: edlId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const accessResult = await verifyEDLAccess(
      { edlId, userId: user.id, profileId: profile.id, profileRole: profile.role },
      serviceClient
    );

    if (!accessResult.authorized) {
      return NextResponse.json(
        { error: accessResult.reason || "Accès non autorisé" },
        { status: accessResult.edl ? 403 : 404 }
      );
    }

    const edl = accessResult.edl as Record<string, unknown>;

    if (edl.type !== "sortie") {
      return NextResponse.json(
        { error: "Les retenues ne s'appliquent qu'aux EDL de sortie" },
        { status: 400 }
      );
    }

    if (edl.status === "signed") {
      return NextResponse.json(
        { error: "Impossible de modifier un EDL signé" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = retenueSchema.parse(body);

    // Get vetuste grid
    const { data: vetusteGrid } = await serviceClient
      .from("vetuste_grid")
      .select("*");

    const gridMap = new Map<string, Record<string, unknown>>();
    for (const g of vetusteGrid || []) {
      gridMap.set(g.element_type as string, g as Record<string, unknown>);
    }

    // Calculate duration
    let dateEntree: Date | null = null;
    const entryEdlId = edl.linked_entry_edl_id as string | null;
    if (entryEdlId) {
      const { data: entryEdl } = await serviceClient
        .from("edl")
        .select("completed_date, scheduled_date, created_at")
        .eq("id", entryEdlId)
        .single();

      if (entryEdl) {
        const ed = entryEdl as Record<string, unknown>;
        dateEntree = new Date(
          (ed.completed_date || ed.scheduled_date || ed.created_at) as string
        );
      }
    }

    const dateSortie = new Date(
      (edl.completed_date || edl.scheduled_date || edl.created_at) as string
    );
    const dureeAns = dateEntree
      ? (dateSortie.getTime() - dateEntree.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    // Update each item with retenue
    let totalRetenue = 0;
    const retenueDetails: Array<Record<string, unknown>> = [];

    for (const item of validated.items) {
      // Get the item to find element_type
      const { data: dbItem } = await serviceClient
        .from("edl_items")
        .select("element_type, room_name, item_name")
        .eq("id", item.item_id)
        .eq("edl_id", edlId)
        .single();

      if (!dbItem) continue;

      const elementType = (dbItem as Record<string, unknown>).element_type as string | null;
      const gridEntry = elementType ? gridMap.get(elementType) : null;

      let coefficient = 1.0;
      if (item.vetuste_applicable && gridEntry && dureeAns > 0) {
        const dureeVie = gridEntry.duree_vie_ans as number;
        const minResiduelle = (gridEntry.valeur_residuelle_min as number) || 0.1;
        coefficient = Math.max(minResiduelle, 1 - dureeAns / dureeVie);
      }

      const retenueNette = Math.round(item.cout_reparation_cents * coefficient);
      totalRetenue += retenueNette;

      // Update item
      await serviceClient
        .from("edl_items")
        .update({
          cout_reparation_cents: item.cout_reparation_cents,
          vetuste_applicable: item.vetuste_applicable,
          vetuste_coefficient: Math.round(coefficient * 100) / 100,
          retenue_cents: retenueNette,
          degradation_noted: true,
        } as Record<string, unknown>)
        .eq("id", item.item_id);

      retenueDetails.push({
        room: (dbItem as Record<string, unknown>).room_name,
        element: (dbItem as Record<string, unknown>).item_name,
        cout_reparation_cents: item.cout_reparation_cents,
        vetuste_coefficient: coefficient,
        retenue_cents: retenueNette,
      });
    }

    // Get deposit from lease
    const { data: lease } = await serviceClient
      .from("leases")
      .select("depot_garantie")
      .eq("id", edl.lease_id as string)
      .single();

    const depotGarantieCents = lease
      ? Math.round(((lease as Record<string, unknown>).depot_garantie as number || 0) * 100)
      : 0;
    const montantRestitue = Math.max(0, depotGarantieCents - totalRetenue);

    // Update EDL with totals
    await serviceClient
      .from("edl")
      .update({
        total_retenue_cents: totalRetenue,
        retenue_details: retenueDetails,
        depot_garantie_cents: depotGarantieCents,
        montant_restitue_cents: montantRestitue,
      } as Record<string, unknown>)
      .eq("id", edlId);

    return NextResponse.json({
      total_retenue_cents: totalRetenue,
      depot_garantie_cents: depotGarantieCents,
      montant_restitue_cents: montantRestitue,
      retenue_details: retenueDetails,
    });
  } catch (error: unknown) {
    console.error("[POST /api/edl/[id]/retenues] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
