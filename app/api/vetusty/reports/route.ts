/**
 * API Route: GET/POST /api/vetusty/reports
 * Gestion des rapports de vétusté
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { z } from "zod";

// Schema de validation pour création
const CreateReportSchema = z.object({
  lease_id: z.string().uuid(),
  edl_entry_id: z.string().uuid().optional(),
  edl_exit_id: z.string().uuid().optional(),
  edl_entry_date: z.string(),
  edl_exit_date: z.string(),
  notes: z.string().optional(),
});

/**
 * GET /api/vetusty/reports
 * Liste tous les rapports de vétusté du propriétaire
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les rapports
    const { data: reports, error } = await supabase
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
            ville
          )
        ),
        items:vetusty_items(*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur récupération rapports:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des rapports" },
        { status: 500 }
      );
    }

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Erreur API vetusty/reports GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vetusty/reports
 * Créer un nouveau rapport de vétusté
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Parser et valider le body
    const body = await request.json();
    const validation = CreateReportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Vérifier que le bail existe et appartient au propriétaire
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        date_debut,
        date_fin,
        property:properties!inner(
          id,
          owner_id
        )
      `)
      .eq("id", data.lease_id)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    if (lease.property.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas le propriétaire de ce bien" },
        { status: 403 }
      );
    }

    // Vérifier qu'il n'y a pas déjà un rapport pour ce bail
    const { data: existingReport } = await supabase
      .from("vetusty_reports")
      .select("id")
      .eq("lease_id", data.lease_id)
      .single();

    if (existingReport) {
      return NextResponse.json(
        { error: "Un rapport de vétusté existe déjà pour ce bail", existing_id: existingReport.id },
        { status: 409 }
      );
    }

    // Calculer la durée du bail
    const startDate = new Date(data.edl_entry_date);
    const endDate = new Date(data.edl_exit_date);
    const durationYears = Math.round(
      ((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)) * 10
    ) / 10;

    // Créer le rapport
    const { data: report, error: createError } = await supabase
      .from("vetusty_reports")
      .insert({
        lease_id: data.lease_id,
        edl_entry_id: data.edl_entry_id,
        edl_exit_id: data.edl_exit_id,
        edl_entry_date: data.edl_entry_date,
        edl_exit_date: data.edl_exit_date,
        lease_duration_years: durationYears,
        notes: data.notes,
        status: "draft",
        created_by: profile.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création rapport:", createError);
      return NextResponse.json(
        { error: "Erreur lors de la création du rapport" },
        { status: 500 }
      );
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Erreur API vetusty/reports POST:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
