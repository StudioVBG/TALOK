export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les mandats de gestion
 * GET /api/agency/mandates - Liste des mandats
 * POST /api/agency/mandates - Créer un mandat
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma de validation
const createMandateSchema = z.object({
  owner_profile_id: z.string().uuid("ID propriétaire invalide"),
  type_mandat: z.enum(["gestion", "location", "vente", "syndic"]).default("gestion"),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  duree_mois: z.number().positive().optional(),
  tacite_reconduction: z.boolean().default(true),
  preavis_resiliation_mois: z.number().default(3),
  properties_ids: z.array(z.string().uuid()).optional(),
  inclut_tous_biens: z.boolean().default(true),
  commission_pourcentage: z.number().min(0).max(100).default(7),
  commission_fixe_mensuelle: z.number().optional(),
  honoraires_mise_en_location: z.number().optional(),
  honoraires_edl: z.number().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Construire la requête
    let query = supabase
      .from("mandates")
      .select(`
        *,
        owner:profiles!mandates_owner_profile_id_fkey(
          id, prenom, nom, telephone
        )
      `, { count: "exact" })
      .eq("agency_profile_id", profile.id);

    if (statut && statut !== "all") {
      query = query.eq("statut", statut);
    }

    if (type && type !== "all") {
      query = query.eq("type_mandat", type);
    }

    const { data: mandates, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erreur récupération mandats:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({
      mandates: mandates || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Erreur API agency mandates GET:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier que le profil agence existe
    const { data: agencyProfile } = await supabase
      .from("agency_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .single();

    if (!agencyProfile) {
      return NextResponse.json(
        { error: "Profil agence requis. Veuillez compléter votre profil." },
        { status: 400 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createMandateSchema.parse(body);

    // Vérifier que le propriétaire existe
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", validatedData.owner_profile_id)
      .eq("role", "owner")
      .single();

    if (!owner) {
      return NextResponse.json(
        { error: "Propriétaire non trouvé" },
        { status: 404 }
      );
    }

    // Générer un numéro de mandat
    const { count } = await supabase
      .from("mandates")
      .select("id", { count: "exact", head: true })
      .eq("agency_profile_id", profile.id);

    const numeroMandat = `MAN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, "0")}`;

    // Créer le mandat
    const { data: mandate, error: createError } = await supabase
      .from("mandates")
      .insert({
        agency_profile_id: profile.id,
        owner_profile_id: validatedData.owner_profile_id,
        numero_mandat: numeroMandat,
        type_mandat: validatedData.type_mandat,
        date_debut: validatedData.date_debut,
        date_fin: validatedData.date_fin,
        duree_mois: validatedData.duree_mois,
        tacite_reconduction: validatedData.tacite_reconduction,
        preavis_resiliation_mois: validatedData.preavis_resiliation_mois,
        properties_ids: validatedData.properties_ids || [],
        inclut_tous_biens: validatedData.inclut_tous_biens,
        commission_pourcentage: validatedData.commission_pourcentage,
        commission_fixe_mensuelle: validatedData.commission_fixe_mensuelle,
        honoraires_mise_en_location: validatedData.honoraires_mise_en_location,
        honoraires_edl: validatedData.honoraires_edl,
        notes: validatedData.notes,
        statut: "draft",
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création mandat:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(mandate, { status: 201 });
  } catch (error: unknown) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Erreur API agency mandates POST:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

