import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour création d'organisation
const createOrganizationSchema = z.object({
  nom_entite: z.string().min(1, "Le nom est requis"),
  type: z.enum([
    "particulier",
    "sci_ir",
    "sci_is",
    "sarl_famille",
    "sas",
    "indivision",
    "usufruit",
    "nue_propriete",
    "lmnp",
    "lmp",
  ]),
  siret: z.string().optional().nullable(),
  siren: z.string().optional().nullable(),
  tva_intracom: z.string().optional().nullable(),
  rcs_ville: z.string().optional().nullable(),
  capital_social: z.number().optional().nullable(),
  date_creation: z.string().optional().nullable(),
  forme_juridique: z.string().optional().nullable(),
  objet_social: z.string().optional().nullable(),
  adresse_siege: z.string().optional().nullable(),
  code_postal_siege: z.string().optional().nullable(),
  ville_siege: z.string().optional().nullable(),
  pays_siege: z.string().default("France"),
  email_contact: z.string().email().optional().nullable(),
  telephone_contact: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  bic: z.string().optional().nullable(),
  banque_nom: z.string().optional().nullable(),
  titulaire_compte: z.string().optional().nullable(),
  representant_nom: z.string().optional().nullable(),
  representant_prenom: z.string().optional().nullable(),
  representant_fonction: z.string().optional().nullable(),
  associes: z.array(z.object({
    nom: z.string(),
    prenom: z.string(),
    parts_pct: z.number(),
    role: z.string().optional(),
  })).default([]),
  regime_fiscal: z.enum([
    "micro_foncier",
    "reel_simplifie",
    "reel_normal",
    "micro_bic",
    "bic_reel",
    "is",
  ]).optional().nullable(),
  tva_applicable: z.boolean().default(false),
  tva_taux: z.number().default(0.20),
  cfe_exonere: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

// GET: Liste des organisations du propriétaire
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil owner
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Récupérer les organisations
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (orgsError) {
      console.error("Erreur récupération organisations:", orgsError);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des organisations" },
        { status: 500 }
      );
    }

    // Compter les biens par organisation
    const { data: propertyCounts, error: countError } = await supabase
      .from("properties")
      .select("organization_id")
      .eq("owner_id", profile.id);

    const propertyCountByOrg: Record<string, number> = {};
    if (propertyCounts) {
      propertyCounts.forEach((p: any) => {
        if (p.organization_id) {
          propertyCountByOrg[p.organization_id] = (propertyCountByOrg[p.organization_id] || 0) + 1;
        }
      });
    }

    return NextResponse.json({
      organizations: organizations || [],
      propertyCountByOrg,
    });
  } catch (error) {
    console.error("Erreur GET /api/owner/organizations:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// POST: Créer une nouvelle organisation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil owner
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    if (profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validationResult = createOrganizationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const orgData = validationResult.data;

    // Vérifier si une organisation avec ce nom existe déjà
    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .eq("nom_entite", orgData.nom_entite)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Une organisation avec ce nom existe déjà" },
        { status: 409 }
      );
    }

    // Vérifier si c'est la première organisation (sera par défaut)
    const { count } = await supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("owner_profile_id", profile.id);

    const isDefault = count === 0;

    // Créer l'organisation
    const { data: newOrg, error: createError } = await supabase
      .from("organizations")
      .insert({
        owner_profile_id: profile.id,
        ...orgData,
        is_default: isDefault,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création organisation:", createError);
      return NextResponse.json(
        { error: "Erreur lors de la création de l'organisation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organization: newOrg,
      message: "Organisation créée avec succès",
    }, { status: 201 });
  } catch (error) {
    console.error("Erreur POST /api/owner/organizations:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
