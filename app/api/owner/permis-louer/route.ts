import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  checkPermisLouerRequired,
  checkPropertyPermisCompliance,
  getAllPermisZones,
  searchPermisZones,
} from "@/lib/services/permis-louer.service";

// GET: Vérifier le permis de louer pour un code postal ou un bien
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const codePostal = searchParams.get("code_postal");
    const propertyId = searchParams.get("property_id");
    const search = searchParams.get("search");
    const listAll = searchParams.get("list_all");

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Liste toutes les zones
    if (listAll === "true") {
      const zones = await getAllPermisZones();
      return NextResponse.json({ zones });
    }

    // Recherche de zones
    if (search) {
      const zones = await searchPermisZones(search);
      return NextResponse.json({ zones });
    }

    // Vérifier par code postal
    if (codePostal) {
      const result = await checkPermisLouerRequired(codePostal);
      return NextResponse.json(result);
    }

    // Vérifier la conformité d'un bien
    if (propertyId) {
      // Vérifier que le bien appartient à l'utilisateur
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }

      const { data: property } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("owner_id", profile.id)
        .single();

      if (!property) {
        return NextResponse.json(
          { error: "Bien non trouvé ou non autorisé" },
          { status: 404 }
        );
      }

      const compliance = await checkPropertyPermisCompliance(propertyId);
      return NextResponse.json(compliance);
    }

    return NextResponse.json(
      { error: "Paramètre requis: code_postal, property_id, search ou list_all" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur GET /api/owner/permis-louer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Créer/mettre à jour la conformité permis de louer d'un bien
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { property_id, ...complianceData } = body;

    if (!property_id) {
      return NextResponse.json(
        { error: "property_id requis" },
        { status: 400 }
      );
    }

    // Vérifier que le bien appartient à l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: property } = await supabase
      .from("properties")
      .select("id, code_postal")
      .eq("id", property_id)
      .eq("owner_id", profile.id)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Bien non trouvé ou non autorisé" },
        { status: 404 }
      );
    }

    // Vérifier si le permis est requis
    const requirement = await checkPermisLouerRequired(property.code_postal);

    // Vérifier si une entrée existe déjà
    const { data: existing } = await supabase
      .from("property_permis_compliance")
      .select("id")
      .eq("property_id", property_id)
      .single();

    if (existing) {
      // Mise à jour
      const { data: updated, error: updateError } = await supabase
        .from("property_permis_compliance")
        .update({
          ...complianceData,
          permis_requis: requirement.required,
          permis_type: requirement.type,
          permis_zone_id: requirement.zone?.id || null,
        })
        .eq("property_id", property_id)
        .select()
        .single();

      if (updateError) {
        console.error("Erreur mise à jour conformité:", updateError);
        return NextResponse.json(
          { error: "Erreur lors de la mise à jour" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        compliance: updated,
        message: "Conformité mise à jour",
      });
    } else {
      // Création
      const { data: created, error: createError } = await supabase
        .from("property_permis_compliance")
        .insert({
          property_id,
          ...complianceData,
          permis_requis: requirement.required,
          permis_type: requirement.type,
          permis_zone_id: requirement.zone?.id || null,
        })
        .select()
        .single();

      if (createError) {
        console.error("Erreur création conformité:", createError);
        return NextResponse.json(
          { error: "Erreur lors de la création" },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          compliance: created,
          message: "Conformité créée",
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Erreur POST /api/owner/permis-louer:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
