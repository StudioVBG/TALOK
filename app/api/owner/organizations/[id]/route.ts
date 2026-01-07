import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schema de validation pour mise à jour d'organisation
const updateOrganizationSchema = z.object({
  nom_entite: z.string().min(1).optional(),
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
  ]).optional(),
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
  pays_siege: z.string().optional(),
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
  })).optional(),
  regime_fiscal: z.enum([
    "micro_foncier",
    "reel_simplifie",
    "reel_normal",
    "micro_bic",
    "bic_reel",
    "is",
  ]).optional().nullable(),
  tva_applicable: z.boolean().optional(),
  tva_taux: z.number().optional(),
  cfe_exonere: z.boolean().optional(),
  is_default: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// GET: Détails d'une organisation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
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

    // Récupérer l'organisation
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Compter les biens associés
    const { count: propertyCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id);

    return NextResponse.json({
      organization,
      propertyCount: propertyCount || 0,
    });
  } catch (error) {
    console.error("Erreur GET /api/owner/organizations/[id]:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// PATCH: Mettre à jour une organisation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
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

    // Vérifier que l'organisation appartient au propriétaire
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id, is_default")
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .single();

    if (!existingOrg) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Valider les données
    const body = await request.json();
    const validationResult = updateOrganizationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Si on définit cette org comme par défaut, retirer le défaut des autres
    if (updateData.is_default === true && !existingOrg.is_default) {
      await supabase
        .from("organizations")
        .update({ is_default: false })
        .eq("owner_profile_id", profile.id)
        .neq("id", id);
    }

    // Mettre à jour l'organisation
    const { data: updatedOrg, error: updateError } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Erreur mise à jour organisation:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      organization: updatedOrg,
      message: "Organisation mise à jour avec succès",
    });
  } catch (error) {
    console.error("Erreur PATCH /api/owner/organizations/[id]:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

// DELETE: Supprimer une organisation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { id } = params;

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
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

    // Vérifier que l'organisation appartient au propriétaire
    const { data: org } = await supabase
      .from("organizations")
      .select("id, is_default, nom_entite")
      .eq("id", id)
      .eq("owner_profile_id", profile.id)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organisation non trouvée" },
        { status: 404 }
      );
    }

    // Empêcher la suppression de l'organisation par défaut
    if (org.is_default) {
      return NextResponse.json(
        { error: "Impossible de supprimer l'organisation par défaut. Définissez d'abord une autre organisation par défaut." },
        { status: 400 }
      );
    }

    // Vérifier s'il y a des biens associés
    const { count: propertyCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id);

    if (propertyCount && propertyCount > 0) {
      return NextResponse.json(
        {
          error: "Impossible de supprimer une organisation avec des biens associés",
          propertyCount,
          suggestion: "Transférez d'abord les biens vers une autre organisation"
        },
        { status: 400 }
      );
    }

    // Soft delete (désactiver) plutôt que supprimer
    const { error: deleteError } = await supabase
      .from("organizations")
      .update({ is_active: false })
      .eq("id", id);

    if (deleteError) {
      console.error("Erreur suppression organisation:", deleteError);
      return NextResponse.json(
        { error: "Erreur lors de la suppression" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Organisation "${org.nom_entite}" supprimée avec succès`,
    });
  } catch (error) {
    console.error("Erreur DELETE /api/owner/organizations/[id]:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
