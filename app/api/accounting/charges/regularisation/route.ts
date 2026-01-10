/**
 * API Route: Régularisation des charges
 * GET /api/accounting/charges/regularisation - Liste les régularisations
 * POST /api/accounting/charges/regularisation - Crée une régularisation
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { ChargeRegularizationService } from "@/features/accounting/services/charge-regularization.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/charges/regularisation
 *
 * Query params:
 * - lease_id: string (requis) - ID du bail
 * - year: number (optionnel) - Année spécifique
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
      throw new ApiError(404, "Profil non trouvé");
    }

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get("lease_id");
    const year = searchParams.get("year");

    if (!leaseId) {
      throw new ApiError(400, "lease_id est requis");
    }

    // Vérifier les permissions
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        tenant_id,
        property:properties!inner(owner_id)
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      throw new ApiError(404, "Bail non trouvé");
    }

    const propertyData = lease.property as any;
    const isOwner = propertyData?.owner_id === profile.id;
    const isTenant = lease.tenant_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isTenant && !isAdmin) {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Récupérer les régularisations
    const service = new ChargeRegularizationService(supabase);
    const regularisations = await service.getRegularisationHistory(leaseId);

    // Filtrer par année si spécifié
    const filtered = year
      ? regularisations.filter((r) => r.year === parseInt(year))
      : regularisations;

    return NextResponse.json({
      success: true,
      data: filtered,
      meta: {
        lease_id: leaseId,
        count: filtered.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/charges/regularisation
 *
 * Body:
 * - lease_id: string (requis)
 * - year: number (requis)
 * - charges_reelles: array (optionnel) - Charges réelles saisies manuellement
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
      throw new ApiError(404, "Profil non trouvé");
    }

    // Seuls les propriétaires et admins peuvent créer des régularisations
    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Seuls les propriétaires peuvent créer des régularisations");
    }

    // Parser le body
    const body = await request.json();
    const { lease_id, year, charges_reelles } = body;

    if (!lease_id || !year) {
      throw new ApiError(400, "lease_id et year sont requis");
    }

    // Vérifier les permissions
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        property:properties!inner(owner_id)
      `)
      .eq("id", lease_id)
      .single();

    if (!lease) {
      throw new ApiError(404, "Bail non trouvé");
    }

    const propertyData = lease.property as any;
    if (profile.role === "owner" && propertyData?.owner_id !== profile.id) {
      throw new ApiError(403, "Ce bail n'appartient pas à l'un de vos biens");
    }

    // Créer la régularisation
    const service = new ChargeRegularizationService(supabase);
    const result = await service.createRegularisation({
      leaseId: lease_id,
      annee: year,
      chargesReelles: charges_reelles || [],
    });

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
