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
 * SOTA 2026: owners (Confort+) and admins can create providers
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    // Owners and admins can create providers
    if (!["admin", "owner"].includes(profile.role)) {
      throw new ApiError(403, "Accès refusé");
    }

    const body = await request.json();

    // Basic validation
    if (!body.company_name) throw new ApiError(400, "company_name est requis");
    if (!body.email) throw new ApiError(400, "email est requis");
    if (!body.contact_name) throw new ApiError(400, "contact_name est requis");
    if (!body.phone) throw new ApiError(400, "phone est requis");

    // SIRET validation (14 digits if provided)
    if (body.siret && !/^\d{14}$/.test(body.siret)) {
      throw new ApiError(400, "Le SIRET doit contenir exactement 14 chiffres");
    }

    // Check duplicate email
    const { data: existing } = await supabase
      .from("providers")
      .select("id")
      .eq("email", body.email)
      .single();

    if (existing) {
      throw new ApiError(409, "Un prestataire avec cet email existe déjà");
    }

    // Create provider — owner adds to their personal directory
    const insertData: Record<string, unknown> = {
      company_name: body.company_name,
      contact_name: body.contact_name,
      email: body.email,
      phone: body.phone,
      trade_categories: body.trade_categories || [body.category].filter(Boolean),
      description: body.description || null,
      address: body.address || null,
      city: body.city || null,
      postal_code: body.postal_code || null,
      department: body.department || null,
      service_radius_km: body.service_radius_km || 30,
      certifications: body.certifications || [],
      insurance_number: body.insurance_number || null,
      insurance_expiry: body.insurance_expiry || null,
      decennale_number: body.decennale_number || null,
      decennale_expiry: body.decennale_expiry || null,
      emergency_available: body.emergency_available || false,
      response_time_hours: body.response_time_hours || 48,
      siret: body.siret || null,
      status: "active",
      is_verified: false,
      is_marketplace: false,
      added_by_owner_id: profile.role === "owner" ? profile.id : null,
    };

    const { data: provider, error } = await supabase
      .from("providers")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[Providers API] Erreur création:", error);
      throw new ApiError(500, "Erreur lors de la création du prestataire");
    }

    // Auto-add to owner's address book
    if (profile.role === "owner" && provider) {
      await supabase.from("owner_providers").insert({
        owner_id: profile.id,
        provider_id: provider.id,
        is_favorite: false,
      });
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
