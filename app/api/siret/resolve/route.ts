/**
 * API Route : POST /api/siret/resolve
 *
 * Résout un SIRET via l'API publique Recherche d'entreprises et renvoie
 * les données légales pré-remplies pour le formulaire d'identité artisan.
 *
 * Auth : utilisateur connecté requis (anti-scraping basique).
 * Le résultat n'est pas persisté ici — la persistance se fait au submit
 * du formulaire d'onboarding via /api/provider/legal-identity.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";
import { lookupBySiret } from "@/lib/siret/recherche-entreprises";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  siret: z
    .string()
    .min(14)
    .max(20)
    .transform((v) => v.replace(/\s/g, "")),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const json = await request.json().catch(() => ({}));
    const { siret } = BodySchema.parse(json);

    const result = await lookupBySiret(siret);

    if (!result.ok) {
      const statusByReason: Record<typeof result.reason, number> = {
        invalid_siret: 400,
        not_found: 404,
        ceased: 409,
        api_unavailable: 503,
      };
      return NextResponse.json(
        { error: result.message, reason: result.reason },
        { status: statusByReason[result.reason] },
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return handleApiError(error);
  }
}
