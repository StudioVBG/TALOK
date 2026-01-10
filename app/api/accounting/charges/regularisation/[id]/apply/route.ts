/**
 * API Route: Appliquer une régularisation
 * POST /api/accounting/charges/regularisation/[id]/apply
 *
 * Valide et applique une régularisation (crée facture ou avoir)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { ChargeRegularizationService } from "@/features/accounting/services/charge-regularization.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Seuls les propriétaires et admins peuvent appliquer
    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Seuls les propriétaires peuvent appliquer les régularisations");
    }

    // Récupérer la régularisation pour vérifier les permissions
    const { data: regul } = await supabase
      .from("charge_regularisations")
      .select(`
        id,
        lease:leases!inner(
          property:properties!inner(owner_id)
        )
      `)
      .eq("id", id)
      .single();

    if (!regul) {
      throw new ApiError(404, "Régularisation non trouvée");
    }

    const leaseData = regul.lease as any;
    const propertyData = leaseData?.property;

    if (profile.role === "owner" && propertyData?.owner_id !== profile.id) {
      throw new ApiError(403, "Cette régularisation ne vous appartient pas");
    }

    // Appliquer la régularisation
    const service = new ChargeRegularizationService(supabase);
    const result = await service.applyRegularisation(id);

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        applied_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
