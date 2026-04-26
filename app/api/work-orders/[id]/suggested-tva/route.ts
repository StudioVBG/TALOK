export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import {
  resolveWorkOrderTVA,
  type WorkType,
} from "@/lib/work-orders/tva-travaux";

/**
 * GET /api/work-orders/[id]/suggested-tva?work_type=entretien&commercial=false
 *
 * Calcule le taux de TVA recommandé pour le devis selon :
 *  - Code postal du bien associé (DROM vs métropole)
 *  - Année de construction (règle 2 ans)
 *  - Type de travaux
 *  - Caractère commercial
 *
 * Utilisé par l'UI prestataire pour pré-remplir tax_rate à la création
 * d'un provider_quote, modifiable par le prestataire.
 */
const querySchema = z.object({
  work_type: z
    .enum([
      "entretien",
      "amelioration",
      "renovation_energetique",
      "construction",
      "autre",
    ])
    .default("entretien"),
  commercial: z.coerce.boolean().default(false),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError) throw new ApiError(authError.status || 401, authError.message);
    if (!user) throw new ApiError(401, "Non authentifié");

    const { id: workOrderId } = await context.params;
    const url = new URL(request.url);
    const { work_type, commercial } = querySchema.parse({
      work_type: url.searchParams.get("work_type") ?? undefined,
      commercial: url.searchParams.get("commercial") ?? undefined,
    });

    const serviceClient = getServiceClient();

    const { data: wo } = await serviceClient
      .from("work_orders")
      .select("id, property_id")
      .eq("id", workOrderId)
      .maybeSingle();

    if (!wo) throw new ApiError(404, "Intervention introuvable");

    const propertyId = (wo as { property_id: string }).property_id;
    const { data: property } = await serviceClient
      .from("properties")
      .select("code_postal, annee_construction")
      .eq("id", propertyId)
      .maybeSingle();

    const prop = property as {
      code_postal: string | null;
      annee_construction: number | null;
    } | null;

    const tva = resolveWorkOrderTVA({
      codePostal: prop?.code_postal ?? null,
      propertyBuildYear: prop?.annee_construction ?? null,
      workType: work_type as WorkType,
      isCommercial: commercial,
    });

    return NextResponse.json({
      rate: tva.rate,
      rate_percent: Math.round(tva.rate * 10000) / 100, // 10.0, 8.5, 5.5...
      formatted: tva.formatted,
      regime: tva.regime,
      reference: tva.reference,
      property: {
        code_postal: prop?.code_postal,
        annee_construction: prop?.annee_construction,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
