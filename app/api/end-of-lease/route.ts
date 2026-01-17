export const runtime = 'nodejs';

/**
 * API Route: Processus de Fin de Bail
 * GET /api/end-of-lease - Liste des processus
 * POST /api/end-of-lease - Créer un nouveau processus
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const createProcessSchema = z.object({
  lease_id: z.string().uuid(),
  property_id: z.string().uuid(),
  lease_end_date: z.string(),
  notes: z.string().optional(),
});

// GET - Liste des processus de fin de bail
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profile_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer les processus via RPC
    const { data: processes, error } = await supabase.rpc(
      "get_owner_lease_end_processes",
      { p_owner_id: profile.id }
    );

    if (error) {
      console.error("Erreur récupération processus:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ processes: processes || [] });
  } catch (error) {
    console.error("Erreur API end-of-lease GET:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST - Créer un nouveau processus
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profile_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json({ error: "Accès réservé aux propriétaires" }, { status: 403 });
    }

    // Parser et valider le body
    const body = await request.json();
    const validatedData = createProcessSchema.parse(body);

    // Vérifier que le bail appartient bien au propriétaire
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        property_id,
        type_bail,
        date_fin,
        depot_de_garantie,
        properties!inner(owner_id)
      `)
      .eq("id", validatedData.lease_id)
      .single();

    if (leaseError || !lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    if ((lease.properties as any).owner_id !== profile.id) {
      return NextResponse.json({ error: "Ce bail ne vous appartient pas" }, { status: 403 });
    }

    // Vérifier qu'il n'existe pas déjà un processus pour ce bail
    const { data: existingProcess } = await supabase
      .from("lease_end_processes")
      .select("id")
      .eq("lease_id", validatedData.lease_id)
      .not("status", "in", '("completed","cancelled")')
      .single();

    if (existingProcess) {
      return NextResponse.json(
        { error: "Un processus de fin de bail existe déjà pour ce bail" },
        { status: 409 }
      );
    }

    // Calculer la date de déclenchement
    const triggerDaysMap: Record<string, number> = {
      nu: 90,
      meuble: 30,
      colocation: 30,
      saisonnier: 0,
      mobilite: 15,
      etudiant: 30,
      commercial: 180,
    };
    const triggerDays = triggerDaysMap[lease.type_bail] || 30;
    const endDate = new Date(validatedData.lease_end_date);
    const triggerDate = new Date(endDate);
    triggerDate.setDate(triggerDate.getDate() - triggerDays);

    // Créer le processus
    const { data: process, error: createError } = await supabase
      .from("lease_end_processes")
      .insert({
        lease_id: validatedData.lease_id,
        property_id: validatedData.property_id,
        status: "triggered",
        lease_end_date: validatedData.lease_end_date,
        trigger_date: triggerDate.toISOString().split("T")[0],
        dg_amount: lease.depot_de_garantie || 0,
        notes: validatedData.notes,
        created_by: profile.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création processus:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Créer les items d'inspection par défaut
    const categories = [
      "murs",
      "sols",
      "salle_de_bain",
      "cuisine",
      "fenetres_portes",
      "electricite_plomberie",
    ];

    // Ajouter "meubles" si location meublée
    if (["meuble", "colocation", "etudiant", "mobilite"].includes(lease.type_bail)) {
      categories.push("meubles");
    }

    const inspectionItems = categories.map((category) => ({
      lease_end_process_id: process.id,
      category,
      status: "pending",
    }));

    await supabase.from("edl_inspection_items").insert(inspectionItems);

    return NextResponse.json({ process }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API end-of-lease POST:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

