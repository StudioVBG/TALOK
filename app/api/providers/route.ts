/**
 * API Route: Providers Collection
 * GET /api/providers - Liste les prestataires
 * POST /api/providers - Crée un prestataire
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/providers
 * Liste les prestataires avec filtrage
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
    const category = searchParams.get("category");
    const specialty = searchParams.get("specialty");
    const status = searchParams.get("status");
    const verified = searchParams.get("verified");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Construire la requête
    let query = supabase
      .from("providers")
      .select(
        `
        *,
        work_orders:work_orders(count)
      `,
        { count: "exact" }
      );

    // Filtrer par catégorie
    if (category) {
      query = query.eq("category", category);
    }

    // Filtrer par spécialité (dans le JSON specialties)
    if (specialty) {
      query = query.contains("specialties", [specialty]);
    }

    // Filtrer par statut
    if (status) {
      query = query.eq("status", status);
    }

    // Filtrer par vérification
    if (verified === "true") {
      query = query.eq("is_verified", true);
    } else if (verified === "false") {
      query = query.eq("is_verified", false);
    }

    // Recherche textuelle
    if (search) {
      query = query.or(
        `company_name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Pagination et ordre
    query = query
      .order("is_verified", { ascending: false })
      .order("rating", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: providers, error, count } = await query;

    if (error) {
      console.error("[Providers API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des prestataires");
    }

    return NextResponse.json({
      success: true,
      data: providers || [],
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
 * POST /api/providers
 * Crée un nouveau prestataire
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

    // Récupérer le profil - seuls les admins peuvent créer des prestataires
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(403, "Seuls les administrateurs peuvent créer des prestataires");
    }

    const body = await request.json();
    const {
      company_name,
      contact_name,
      email,
      phone,
      category,
      specialties,
      address,
      city,
      postal_code,
      siret,
      insurance_number,
      insurance_expiry,
      hourly_rate,
      intervention_zone,
      notes,
    } = body;

    // Validation
    if (!company_name) {
      throw new ApiError(400, "company_name est requis");
    }
    if (!email) {
      throw new ApiError(400, "email est requis");
    }
    if (!category) {
      throw new ApiError(400, "category est requis");
    }

    // Vérifier si le prestataire existe déjà
    const { data: existing } = await supabase
      .from("providers")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      throw new ApiError(409, "Un prestataire avec cet email existe déjà");
    }

    // Créer le prestataire
    const { data: provider, error } = await supabase
      .from("providers")
      .insert({
        company_name,
        contact_name,
        email,
        phone,
        category,
        specialties: specialties || [],
        address,
        city,
        postal_code,
        siret,
        insurance_number,
        insurance_expiry,
        hourly_rate,
        intervention_zone: intervention_zone || [],
        notes,
        status: "active",
        is_verified: false,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[Providers API] Erreur création:", error);
      throw new ApiError(500, "Erreur lors de la création du prestataire");
    }

    return NextResponse.json(
      {
        success: true,
        data: provider,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
