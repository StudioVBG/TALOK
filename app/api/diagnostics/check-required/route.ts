export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import {
  checkRequiredSchema,
  getRequiredDiagnostics,
} from "@/lib/validations/diagnostics";

/**
 * POST /api/diagnostics/check-required
 * Returns which diagnostics are required for a given property.
 */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    if (!user) throw new ApiError(401, "Non authentifié");

    const body = await request.json();
    const parsed = checkRequiredSchema.parse(body);

    // If annee_construction is not provided, fetch from property
    let anneeConstruction = parsed.annee_construction;
    let codePostal = parsed.code_postal;

    if (anneeConstruction === undefined || codePostal === undefined) {
      const { data: property } = await supabase
        .from("properties")
        .select("annee_construction, code_postal")
        .eq("id", parsed.property_id)
        .single();

      if (property) {
        anneeConstruction = anneeConstruction ?? property.annee_construction;
        codePostal = codePostal ?? property.code_postal;
      }
    }

    const required = getRequiredDiagnostics(anneeConstruction, codePostal);

    // Also fetch existing diagnostics for this property
    const { data: existing } = await supabase
      .from("property_diagnostics")
      .select("diagnostic_type, performed_date, expiry_date, is_valid, result")
      .eq("property_id", parsed.property_id);

    const today = new Date().toISOString().split("T")[0];
    const existingMap = new Map(
      (existing ?? []).map((d) => [d.diagnostic_type, d])
    );

    const checklist = required.map((req) => {
      const diag = existingMap.get(req.type);
      let status: "missing" | "valid" | "expired" = "missing";

      if (diag) {
        if (diag.expiry_date && diag.expiry_date < today) {
          status = "expired";
        } else if (diag.is_valid) {
          status = "valid";
        } else {
          status = "expired";
        }
      }

      return {
        ...req,
        status,
        performed_date: diag?.performed_date ?? null,
        expiry_date: diag?.expiry_date ?? null,
      };
    });

    return NextResponse.json({ checklist });
  } catch (error) {
    return handleApiError(error);
  }
}
