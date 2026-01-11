/**
 * API Route: Situation Locataire
 * GET /api/accounting/situation/[tenantId]
 *
 * Génère la situation de compte d'un locataire (historique paiements, arriérés).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/situation/[tenantId]
 *
 * Path params:
 * - tenantId: string - ID du locataire
 *
 * Query params:
 * - format: 'json' | 'pdf' (défaut: json)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
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

    // Vérifier les autorisations
    if (profile.role === "tenant") {
      // Un locataire ne peut voir que sa propre situation
      if (profile.id !== tenantId) {
        throw new ApiError(403, "Vous ne pouvez consulter que votre propre situation");
      }
    } else if (profile.role === "owner") {
      // Un propriétaire peut voir la situation de ses locataires
      const { data: lease } = await supabase
        .from("leases")
        .select(`
          property:properties!inner(owner_id)
        `)
        .eq("tenant_id", tenantId)
        .eq("statut", "active")
        .single();

      const propertyData = lease?.property as any;
      if (!lease || propertyData?.owner_id !== profile.id) {
        throw new ApiError(403, "Ce locataire n'est pas associé à l'un de vos biens");
      }
    } else if (profile.role !== "admin") {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "json";

    // Générer la situation
    const situation = await accountingService.generateSituationLocataire(tenantId);

    // Format PDF (à implémenter)
    if (format === "pdf") {
      return NextResponse.json(
        { error: "Export PDF non encore implémenté" },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      data: situation,
      meta: {
        tenant_id: tenantId,
        a_jour: situation.situation.a_jour,
        solde_du: situation.situation.solde_du,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
