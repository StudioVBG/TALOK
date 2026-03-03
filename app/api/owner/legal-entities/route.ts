/**
 * API Routes pour les entités juridiques
 * GET /api/owner/legal-entities - Liste les entités
 * POST /api/owner/legal-entities - Crée une nouvelle entité
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getLegalEntities,
  getLegalEntitiesWithStats,
  createLegalEntity,
} from "@/features/legal-entities/services/legal-entities.service";
import type { CreateLegalEntityDTO } from "@/lib/types/legal-entity";
import { isValidSiret, isValidSiren } from "@/lib/entities/siret-validation";

/**
 * GET /api/owner/legal-entities
 * Récupère toutes les entités juridiques du propriétaire connecté
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil propriétaire
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

    // Garantir que owner_profiles existe (auto-provisionnement si manquant)
    const { data: ownerProfile } = await supabase
      .from("owner_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (!ownerProfile) {
      const { getServiceClient } = await import("@/lib/supabase/service-client");
      const serviceClient = getServiceClient();
      await serviceClient
        .from("owner_profiles")
        .upsert(
          { profile_id: profile.id, type: "particulier" },
          { onConflict: "profile_id" }
        );
    }

    // Options de filtrage
    const searchParams = request.nextUrl.searchParams;
    const includeStats = searchParams.get("stats") !== "false";

    // M14 fix: respect stats=false param
    const entities = includeStats
      ? await getLegalEntitiesWithStats(profile.id)
      : await getLegalEntities(profile.id);

    return NextResponse.json({
      entities,
      count: entities.length,
    });
  } catch (error) {
    console.error("Error in GET /api/owner/legal-entities:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/legal-entities
 * Crée une nouvelle entité juridique
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le profil propriétaire
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

    // Parser le body
    const body: CreateLegalEntityDTO = await request.json();

    // Validation basique
    if (!body.entity_type) {
      return NextResponse.json(
        { error: "Le type d'entité est requis" },
        { status: 400 }
      );
    }

    if (!body.nom) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      );
    }

    if (!body.regime_fiscal) {
      return NextResponse.json(
        { error: "Le régime fiscal est requis" },
        { status: 400 }
      );
    }

    // M7: Validation du SIREN si fourni (9 chiffres + algorithme de Luhn)
    if (body.siren) {
      if (!/^\d{9}$/.test(body.siren)) {
        return NextResponse.json(
          { error: "Le SIREN doit contenir exactement 9 chiffres" },
          { status: 400 }
        );
      }
      if (!isValidSiren(body.siren)) {
        return NextResponse.json(
          { error: "Le SIREN est invalide (clé de contrôle incorrecte)" },
          { status: 400 }
        );
      }
    }

    // M7: Validation du SIRET si fourni (14 chiffres + algorithme de Luhn)
    if (body.siret) {
      if (!/^\d{14}$/.test(body.siret)) {
        return NextResponse.json(
          { error: "Le SIRET doit contenir exactement 14 chiffres" },
          { status: 400 }
        );
      }
      if (!isValidSiret(body.siret)) {
        return NextResponse.json(
          { error: "Le SIRET est invalide (clé de contrôle incorrecte)" },
          { status: 400 }
        );
      }
    }

    // Créer l'entité
    const entity = await createLegalEntity(profile.id, body);

    return NextResponse.json(
      { entity, message: "Entité créée avec succès" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/owner/legal-entities:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
