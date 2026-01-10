/**
 * API Route: Tenants Collection
 * GET /api/tenants - Liste les locataires
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenants
 * Liste les locataires avec leurs baux
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
    const ownerId = searchParams.get("owner_id");
    const propertyId = searchParams.get("property_id");
    const leaseId = searchParams.get("lease_id");
    const status = searchParams.get("status"); // active, past, all
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Si un lease_id spécifique est demandé
    if (leaseId) {
      const { data: signers } = await supabase
        .from("lease_signers")
        .select(
          `
          id,
          role,
          signature_status,
          signed_at,
          profile:profiles(
            id,
            prenom,
            nom,
            email,
            telephone,
            avatar_url
          )
        `
        )
        .eq("lease_id", leaseId)
        .in("role", ["locataire_principal", "locataire", "colocataire"]);

      return NextResponse.json({
        success: true,
        data: (signers || []).map((s: any) => ({
          ...s.profile,
          lease_role: s.role,
          signature_status: s.signature_status,
        })),
        meta: { total: signers?.length || 0 },
      });
    }

    // Récupérer les locataires via lease_signers avec leurs baux
    let query = supabase.from("lease_signers").select(
      `
        id,
        role,
        signature_status,
        signed_at,
        profile:profiles!inner(
          id,
          prenom,
          nom,
          email,
          telephone,
          avatar_url,
          created_at
        ),
        lease:leases!inner(
          id,
          statut,
          date_debut,
          date_fin,
          loyer,
          property:properties(
            id,
            nom,
            adresse_ligne1,
            ville,
            owner_id
          ),
          unit:units(
            id,
            nom,
            property:properties(
              id,
              nom,
              adresse_ligne1,
              ville,
              owner_id
            )
          )
        )
      `,
      { count: "exact" }
    );

    // Filtrer par rôle locataire
    query = query.in("role", ["locataire_principal", "locataire", "colocataire"]);

    // Filtrer par propriétaire si spécifié ou si pas admin
    if (ownerId) {
      query = query.or(
        `lease.property.owner_id.eq.${ownerId},lease.unit.property.owner_id.eq.${ownerId}`
      );
    } else if (profile.role !== "admin") {
      query = query.or(
        `lease.property.owner_id.eq.${profile.id},lease.unit.property.owner_id.eq.${profile.id}`
      );
    }

    // Filtrer par propriété
    if (propertyId) {
      query = query.or(
        `lease.property_id.eq.${propertyId},lease.unit.property_id.eq.${propertyId}`
      );
    }

    // Filtrer par statut de bail
    if (status === "active") {
      query = query.eq("lease.statut", "active");
    } else if (status === "past") {
      query = query.eq("lease.statut", "terminated");
    }

    // Pagination et ordre
    query = query
      .order("created_at", { referencedTable: "profiles", ascending: false })
      .range(offset, offset + limit - 1);

    const { data: tenants, error, count } = await query;

    if (error) {
      console.error("[Tenants API] Erreur:", error);
      throw new ApiError(500, "Erreur lors de la récupération des locataires");
    }

    // Transformer les données pour une réponse plus propre
    const formattedTenants = (tenants || []).map((t: any) => {
      const property = t.lease?.property || t.lease?.unit?.property;
      return {
        id: t.profile?.id,
        prenom: t.profile?.prenom,
        nom: t.profile?.nom,
        email: t.profile?.email,
        telephone: t.profile?.telephone,
        avatar_url: t.profile?.avatar_url,
        lease: {
          id: t.lease?.id,
          statut: t.lease?.statut,
          date_debut: t.lease?.date_debut,
          date_fin: t.lease?.date_fin,
          loyer: t.lease?.loyer,
        },
        property: property
          ? {
              id: property.id,
              nom: property.nom,
              adresse: property.adresse_ligne1,
              ville: property.ville,
            }
          : null,
        role: t.role,
        signature_status: t.signature_status,
      };
    });

    // Filtrer les doublons par profile.id
    const uniqueTenants = formattedTenants.filter(
      (t: any, i: number, arr: any[]) =>
        arr.findIndex((x) => x.id === t.id) === i
    );

    // Recherche textuelle côté client (car la recherche Supabase est limitée)
    let filteredTenants = uniqueTenants;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTenants = uniqueTenants.filter(
        (t: any) =>
          t.nom?.toLowerCase().includes(searchLower) ||
          t.prenom?.toLowerCase().includes(searchLower) ||
          t.email?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredTenants,
      meta: {
        total: count || filteredTenants.length,
        limit,
        offset,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
