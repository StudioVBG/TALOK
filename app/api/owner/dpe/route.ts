import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  verifyDPE,
  searchDPEByAddress,
  checkRentalEligibility,
  updatePropertyDPE,
  getExpiringDPEs,
} from "@/lib/services/dpe-ademe.service";

// GET: Vérifier un DPE ou rechercher par adresse
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const numeroDpe = searchParams.get("numero");
    const codePostal = searchParams.get("code_postal");
    const ville = searchParams.get("ville");
    const classeEnergie = searchParams.get("classe");
    const getExpiring = searchParams.get("expiring");

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
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

    // Obtenir les DPE expirant bientôt
    if (getExpiring === "true" && profile.role === "owner") {
      const days = parseInt(searchParams.get("days") || "90");
      const expiring = await getExpiringDPEs(profile.id, days);
      return NextResponse.json({ expiringDPEs: expiring });
    }

    // Vérifier l'éligibilité d'une classe énergétique
    if (classeEnergie) {
      const eligibility = checkRentalEligibility(classeEnergie);
      return NextResponse.json(eligibility);
    }

    // Vérifier un DPE par son numéro
    if (numeroDpe) {
      const result = await verifyDPE(numeroDpe);
      return NextResponse.json(result);
    }

    // Rechercher des DPE par adresse
    if (codePostal || ville) {
      const results = await searchDPEByAddress({
        codePostal: codePostal || undefined,
        ville: ville || undefined,
      });
      return NextResponse.json({ dpes: results });
    }

    return NextResponse.json(
      { error: "Paramètre requis: numero, code_postal, ville, classe ou expiring" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erreur GET /api/owner/dpe:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Vérifier et enregistrer un DPE pour un bien
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { property_id, numero_dpe } = body;

    if (!property_id || !numero_dpe) {
      return NextResponse.json(
        { error: "property_id et numero_dpe requis" },
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
      .select("id, adresse_complete")
      .eq("id", property_id)
      .eq("owner_id", profile.id)
      .single();

    if (!property) {
      return NextResponse.json(
        { error: "Bien non trouvé ou non autorisé" },
        { status: 404 }
      );
    }

    // Vérifier le DPE via l'API ADEME
    const verification = await verifyDPE(numero_dpe);

    if (!verification.valid) {
      return NextResponse.json({
        success: false,
        verification,
        message: verification.message,
      });
    }

    // Mettre à jour les données DPE du bien
    const updated = await updatePropertyDPE(property_id, verification.data!, true);

    if (!updated) {
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du bien" },
        { status: 500 }
      );
    }

    // Vérifier si le bien peut être loué
    if (!verification.rentalEligibility.eligible) {
      return NextResponse.json({
        success: true,
        verification,
        warning: true,
        message: `DPE vérifié et enregistré. ATTENTION: ${verification.rentalEligibility.reason}`,
      });
    }

    return NextResponse.json({
      success: true,
      verification,
      message: "DPE vérifié et enregistré avec succès",
    });
  } catch (error) {
    console.error("Erreur POST /api/owner/dpe:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
