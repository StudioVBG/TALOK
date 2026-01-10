/**
 * API Route: Units Collection
 * GET /api/units - Liste les lots
 * POST /api/units - Crée un lot
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/units
 * Liste les lots avec filtrage
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    // Paramètres de requête
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Construire la requête
    let query = supabase
      .from("units")
      .select(
        `
        *,
        property:properties!inner(
          id,
          nom,
          adresse_ligne1,
          ville,
          code_postal,
          owner_id
        ),
        leases:leases(
          id,
          statut,
          date_debut,
          date_fin
        )
      `,
        { count: "exact" }
      );

    // Filtrer par propriété
    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    // Filtrer par propriétaire si pas admin
    if (profile.role !== "admin") {
      query = query.eq("property.owner_id", profile.id);
    }

    // Filtre de recherche
    if (search) {
      query = query.or(`nom.ilike.%${search}%,numero.ilike.%${search}%`);
    }

    // Filtrer par statut
    if (status) {
      query = query.eq("statut", status);
    }

    // Pagination et ordre
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: units, error, count } = await query;

    if (error) {
      console.error("[Units API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des lots");
    }

    return NextResponse.json({
      success: true,
      data: units || [],
      meta: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/units
 * Crée un nouveau lot
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    const body = await request.json();
    const { property_id, nom, numero, etage, surface, capacite_max, type_lot } =
      body;

    // Validation
    if (!property_id) {
      throw new ApiError(400, "property_id est requis");
    }

    // Vérifier que l'utilisateur a accès à la propriété
    const { data: property } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", property_id)
      .single();

    if (!property) {
      throw new ApiError(404, "Propriété non trouvée");
    }

    if (profile.role !== "admin" && property.owner_id !== profile.id) {
      throw new ApiError(403, "Vous n'avez pas accès à cette propriété");
    }

    // Créer le lot
    const { data: unit, error } = await supabase
      .from("units")
      .insert({
        property_id,
        nom: nom || `Lot ${numero || ""}`.trim(),
        numero,
        etage,
        surface,
        capacite_max: capacite_max || 1,
        type_lot: type_lot || "appartement",
      })
      .select()
      .single();

    if (error) {
      console.error("[Units API] Erreur création:", error);
      throw new ApiError(500, "Erreur lors de la création du lot");
    }

    return NextResponse.json(
      {
        success: true,
        data: unit,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
