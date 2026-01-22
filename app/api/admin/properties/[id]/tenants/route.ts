export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";

const propertyIdParamSchema = z.string().uuid("ID propriété invalide");

/**
 * GET /api/admin/properties/[id]/tenants - Locataires d'une propriété
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

    const propertyId = propertyIdParamSchema.parse(id);

    // Vérifier que la propriété existe
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, adresse_complete")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      throw new ApiError(404, "Propriété introuvable", propertyError);
    }

    // Récupérer les baux actifs avec leurs signataires
    const { data: leases, error: leasesError } = await supabase
      .from("leases")
      .select(
        `
        id,
        statut,
        date_debut,
        date_fin,
        lease_signers!inner(
          profile_id,
          role,
          profiles!inner(
            id,
            prenom,
            nom,
            telephone,
            user_id
          )
        )
      `
      )
      .eq("property_id", propertyId)
      .in("statut", ["active", "pending_signature"]);

    if (leasesError) {
      throw new ApiError(500, "Erreur lors de la récupération des baux", leasesError);
    }

    // Extraire les locataires (locataire_principal et colocataire)
    const tenantProfileIds: string[] = [];
    (leases || []).forEach((lease: any) => {
      lease.lease_signers?.forEach((signer: any) => {
        if (["locataire_principal", "colocataire"].includes(signer.role)) {
          tenantProfileIds.push(signer.profile_id);
        }
      });
    });

    // Récupérer les âges depuis la vue
    let ageMap = new Map<string, number | null>();
    if (tenantProfileIds.length > 0) {
      const { data: ages } = await supabase
        .from("v_person_age")
        .select("person_id, age_years")
        .in("person_id", tenantProfileIds);

      ageMap = new Map(
        (ages || []).map((a: any) => [a.person_id, a.age_years])
      );
    }

    // Transformer les données
    const tenants = (leases || []).flatMap((lease: any) =>
      lease.lease_signers
        ?.filter((signer: any) =>
          ["locataire_principal", "colocataire"].includes(signer.role)
        )
        .map((signer: any) => {
          const profile = signer.profiles;
          const fullName = `${profile?.prenom || ""} ${profile?.nom || ""}`.trim();

          return {
            id: profile?.id,
            full_name: fullName || "Sans nom",
            email: undefined, // Non disponible via cette route pour sécurité
            phone: profile?.telephone || undefined,
            age_years: ageMap.get(profile?.id) ?? null,
            lease_id: lease.id,
            lease_status: lease.statut,
            lease_start: lease.date_debut,
            lease_end: lease.date_fin,
            role: signer.role,
          };
        }) || []
    );

    // Dédupliquer par profile_id (au cas où un locataire aurait plusieurs baux)
    type TenantInfo = {
      id: string;
      full_name: string;
      email: undefined;
      phone: string | undefined;
      age_years: number | null;
      lease_id: string;
      lease_status: string;
      lease_start: string | null;
      lease_end: string | null;
      role: string;
    };
    
    const uniqueTenants = Array.from(
      new Map(tenants.map((t: TenantInfo) => [t.id, t])).values()
    ) as TenantInfo[];

    return NextResponse.json({
      property: {
        id: property.id,
        address: property.adresse_complete,
      },
      tenants: uniqueTenants,
      count: uniqueTenants.length,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

