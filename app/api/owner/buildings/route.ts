import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour création d'immeuble
const createBuildingSchema = z.object({
  organization_id: z.string().uuid().optional().nullable(),
  nom: z.string().min(1, "Le nom est requis"),
  code_interne: z.string().optional().nullable(),
  adresse: z.string().min(1, "L'adresse est requise"),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().min(5, "Code postal invalide"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().optional().nullable(),
  pays: z.string().default("France"),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  annee_construction: z.number().optional().nullable(),
  nb_etages: z.number().optional().nullable(),
  nb_lots_total: z.number().optional().nullable(),
  nb_lots_proprio: z.number().optional().nullable(),
  surface_totale_m2: z.number().optional().nullable(),
  type_immeuble: z.enum([
    "residence",
    "copropriete",
    "mono_proprietaire",
    "mixte",
    "bureaux",
    "commercial",
  ]).optional().nullable(),
  syndic_nom: z.string().optional().nullable(),
  syndic_contact: z.string().optional().nullable(),
  syndic_email: z.string().email().optional().nullable(),
  syndic_telephone: z.string().optional().nullable(),
  numero_immatriculation_copro: z.string().optional().nullable(),
  tantieme_total: z.number().optional().nullable(),
  has_ascenseur: z.boolean().default(false),
  has_parking_commun: z.boolean().default(false),
  has_local_velo: z.boolean().default(false),
  has_local_poubelles: z.boolean().default(false),
  has_interphone: z.boolean().default(false),
  has_digicode: z.boolean().default(false),
  has_videosurveillance: z.boolean().default(false),
  has_gardien: z.boolean().default(false),
  notes: z.string().optional().nullable(),
});

// GET: Liste des immeubles du propriétaire
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil owner
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Construire la requête
    let query = supabase
      .from("buildings")
      .select(`
        *,
        organization:organizations(id, nom_entite, type),
        caretaker:caretakers(id, nom, prenom, telephone),
        properties:properties(count)
      `)
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("nom", { ascending: true });

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data: buildings, error } = await query;

    if (error) {
      console.error("Erreur récupération immeubles:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des immeubles" },
        { status: 500 }
      );
    }

    return NextResponse.json({ buildings: buildings || [] });
  } catch (error) {
    console.error("Erreur GET /api/owner/buildings:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Créer un nouvel immeuble
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil owner
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validationResult = createBuildingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const buildingData = validationResult.data;

    // Vérifier que l'organisation appartient au propriétaire si spécifiée
    if (buildingData.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", buildingData.organization_id)
        .eq("owner_profile_id", profile.id)
        .single();

      if (!org) {
        return NextResponse.json(
          { error: "Organisation non trouvée ou non autorisée" },
          { status: 404 }
        );
      }
    }

    // Créer l'immeuble
    const { data: newBuilding, error: createError } = await supabase
      .from("buildings")
      .insert({
        owner_profile_id: profile.id,
        ...buildingData,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création immeuble:", createError);
      return NextResponse.json(
        { error: "Erreur lors de la création de l'immeuble" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        building: newBuilding,
        message: "Immeuble créé avec succès",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur POST /api/owner/buildings:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
