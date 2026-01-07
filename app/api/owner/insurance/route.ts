import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour création d'assurance
const createInsuranceSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  building_id: z.string().uuid().optional().nullable(),
  lease_id: z.string().uuid().optional().nullable(),
  organization_id: z.string().uuid().optional().nullable(),

  type_assurance: z.enum([
    "pno",
    "mri",
    "habitation",
    "loyers_impayes",
    "protection_juridique",
    "rc_proprietaire",
    "dommages_ouvrage",
  ]),

  assureur_nom: z.string().min(1, "Le nom de l'assureur est requis"),
  assureur_type: z.enum(["traditionnel", "digital", "mutuelle", "courtier"]).optional().nullable(),

  numero_contrat: z.string().optional().nullable(),
  date_effet: z.string(), // Date ISO
  date_echeance: z.string(), // Date ISO

  prime_annuelle: z.number().optional().nullable(),
  prime_mensuelle: z.number().optional().nullable(),
  periodicite_paiement: z.enum(["mensuelle", "trimestrielle", "semestrielle", "annuelle"]).optional().nullable(),
  jour_prelevement: z.number().min(1).max(28).optional().nullable(),

  garanties: z.array(z.object({
    nom: z.string(),
    plafond: z.number().optional(),
    franchise: z.number().optional(),
  })).default([]),
  franchise_generale: z.number().optional().nullable(),
  plafond_general: z.number().optional().nullable(),

  contact_nom: z.string().optional().nullable(),
  contact_telephone: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  espace_client_url: z.string().url().optional().nullable(),

  rappel_echeance_jours: z.number().default(30),
  notes: z.string().optional().nullable(),
});

// GET: Liste des assurances du propriétaire
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const buildingId = searchParams.get("building_id");
    const leaseId = searchParams.get("lease_id");
    const type = searchParams.get("type");

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
      .from("insurance_policies")
      .select(`
        *,
        property:properties(id, adresse_complete, type),
        building:buildings(id, nom, adresse)
      `)
      .eq("owner_profile_id", profile.id)
      .order("date_echeance", { ascending: true });

    // Filtres optionnels
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
    if (buildingId) {
      query = query.eq("building_id", buildingId);
    }
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (type) {
      query = query.eq("type_assurance", type);
    }

    const { data: policies, error } = await query;

    if (error) {
      console.error("Erreur récupération assurances:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération des assurances" },
        { status: 500 }
      );
    }

    // Calculer les statistiques
    const now = new Date();
    const stats = {
      total: policies?.length || 0,
      active: policies?.filter((p: any) => p.statut === "active").length || 0,
      expiringSoon: policies?.filter((p: any) => {
        const echeance = new Date(p.date_echeance);
        const daysUntil = Math.ceil(
          (echeance.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntil <= 30 && daysUntil > 0 && p.statut === "active";
      }).length || 0,
      totalPremiumAnnual: policies
        ?.filter((p: any) => p.statut === "active")
        .reduce((sum: number, p: any) => sum + (p.prime_annuelle || 0), 0) || 0,
    };

    return NextResponse.json({
      policies: policies || [],
      stats,
    });
  } catch (error) {
    console.error("Erreur GET /api/owner/insurance:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Créer une nouvelle assurance
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
    const validationResult = createInsuranceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const insuranceData = validationResult.data;

    // Vérifier qu'au moins un rattachement est fourni
    if (
      !insuranceData.property_id &&
      !insuranceData.building_id &&
      !insuranceData.lease_id &&
      !insuranceData.organization_id
    ) {
      return NextResponse.json(
        {
          error:
            "L'assurance doit être rattachée à un bien, un immeuble, un bail ou une organisation",
        },
        { status: 400 }
      );
    }

    // Vérifier que le bien/immeuble/bail appartient au propriétaire
    if (insuranceData.property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", insuranceData.property_id)
        .eq("owner_id", profile.id)
        .single();

      if (!property) {
        return NextResponse.json(
          { error: "Bien non trouvé ou non autorisé" },
          { status: 404 }
        );
      }
    }

    if (insuranceData.building_id) {
      const { data: building } = await supabase
        .from("buildings")
        .select("id")
        .eq("id", insuranceData.building_id)
        .eq("owner_profile_id", profile.id)
        .single();

      if (!building) {
        return NextResponse.json(
          { error: "Immeuble non trouvé ou non autorisé" },
          { status: 404 }
        );
      }
    }

    // Créer l'assurance
    const { data: newPolicy, error: createError } = await supabase
      .from("insurance_policies")
      .insert({
        owner_profile_id: profile.id,
        ...insuranceData,
        statut: "active",
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création assurance:", createError);
      return NextResponse.json(
        { error: "Erreur lors de la création de l'assurance" },
        { status: 500 }
      );
    }

    // Créer un rappel pour l'échéance
    const echeanceDate = new Date(insuranceData.date_echeance);
    const reminderDate = new Date(echeanceDate);
    reminderDate.setDate(
      reminderDate.getDate() - (insuranceData.rappel_echeance_jours || 30)
    );

    await supabase.from("insurance_reminders").insert({
      insurance_policy_id: newPolicy.id,
      reminder_type: "echeance",
      reminder_date: reminderDate.toISOString().split("T")[0],
    });

    return NextResponse.json(
      {
        policy: newPolicy,
        message: "Assurance créée avec succès",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur POST /api/owner/insurance:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
