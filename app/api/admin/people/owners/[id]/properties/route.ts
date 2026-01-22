export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

const ownerIdParamSchema = z.string().uuid("ID propriétaire invalide");

/**
 * GET /api/admin/people/owners/[id]/properties - Propriétés d'un propriétaire
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, user, supabase } = await requireAdmin(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    const ownerId = ownerIdParamSchema.parse(id);

    // Récupérer les propriétés avec leurs baux actifs
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select(
        `
        id,
        unique_code,
        type,
        type_bien,
        adresse_complete,
        code_postal,
        ville,
        surface,
        nb_pieces,
        loyer_base,
        charges_mensuelles,
        etat,
        created_at,
        leases!inner(
          id,
          statut,
          date_debut,
          date_fin,
          lease_signers!inner(
            profile_id,
            role
          )
        )
      `
      )
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (propertiesError) {
      throw new ApiError(500, "Erreur lors de la récupération des propriétés", propertiesError);
    }

    // Transformer les données pour inclure le nombre de locataires
    const propertiesWithTenants = (properties || []).map((property: any) => {
      const activeLeases = property.leases?.filter((l: any) =>
        ["active", "pending_signature"].includes(l.statut)
      ) || [];

      const tenantsCount = new Set(
        activeLeases.flatMap((l: any) =>
          l.lease_signers
            ?.filter((ls: any) =>
              ["locataire_principal", "colocataire"].includes(ls.role)
            )
            .map((ls: any) => ls.profile_id)
        )
      ).size;

      // Déterminer le statut basé sur l'état et les baux
      let status = property.etat || "draft";
      if (activeLeases.length > 0) {
        status = "occupied";
      } else if (property.etat === "published") {
        status = "available";
      }

      return {
        id: property.id,
        ref: property.unique_code,
        address: property.adresse_complete,
        type: property.type || property.type_bien,
        surface: property.surface,
        nb_pieces: property.nb_pieces,
        loyer_base: property.loyer_base,
        charges_mensuelles: property.charges_mensuelles,
        status,
        tenants_count: tenantsCount,
        owner_id: ownerId,
        created_at: property.created_at,
      };
    });

    return NextResponse.json({
      properties: propertiesWithTenants,
      count: propertiesWithTenants.length,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

