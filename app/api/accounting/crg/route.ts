/**
 * API Route: Compte Rendu de Gestion (CRG)
 *
 * POST /api/accounting/crg - Generate a new CRG for a mandant
 * GET  /api/accounting/crg  - List CRGs (by mandantId or owner_id)
 *
 * Document obligatoire (Loi Hoguet Art. 6)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { generateCRG } from "@/lib/accounting/agency/crg-generator";
import { accountingService } from "@/features/accounting/services/accounting.service";
import { generateCRGPDF } from "@/features/accounting/services/pdf-export.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST — Generate a new CRG for a mandant
// ---------------------------------------------------------------------------

const GenerateCRGSchema = z.object({
  mandantId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = GenerateCRGSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { mandantId, periodStart, periodEnd } = validation.data;

    // Validate period
    if (new Date(periodStart) > new Date(periodEnd)) {
      throw new ApiError(400, "periodStart doit etre anterieure a periodEnd");
    }

    const crg = await generateCRG(supabase, mandantId, periodStart, periodEnd);

    return NextResponse.json(
      { success: true, data: crg },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// GET — List CRGs
// ---------------------------------------------------------------------------

/**
 * GET /api/accounting/crg
 *
 * Query params:
 * - mandantId: string (list CRGs for a specific mandant — agency flow)
 * - owner_id: string (legacy owner flow)
 * - start_date: string (YYYY-MM-DD)
 * - end_date: string (YYYY-MM-DD)
 * - property_id: string (optional — filter on a property)
 * - format: 'json' | 'pdf' (default: json)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "crg");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const mandantId = searchParams.get("mandantId");

    // ------------------------------------------------------------------
    // Agency flow: list CRGs for a mandant
    // ------------------------------------------------------------------
    if (mandantId) {
      const { data: crgs, error } = await supabase
        .from("crg_reports")
        .select("*")
        .eq("mandant_id", mandantId)
        .order("period_end", { ascending: false });

      if (error) {
        throw new ApiError(500, `Erreur chargement CRGs: ${error.message}`);
      }

      return NextResponse.json({
        success: true,
        data: crgs ?? [],
        meta: { count: crgs?.length ?? 0, mandantId },
      });
    }

    // ------------------------------------------------------------------
    // Legacy owner flow: generate CRG from accounting service
    // ------------------------------------------------------------------
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const format = searchParams.get("format") || "json";
    let ownerId = searchParams.get("owner_id");
    const propertyId = searchParams.get("property_id");

    if (!startDate || !endDate) {
      throw new ApiError(400, "start_date et end_date sont requis (format YYYY-MM-DD)");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError(400, "Format de date invalide. Utilisez YYYY-MM-DD");
    }

    if (new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, "start_date doit etre anterieure a end_date");
    }

    if (profile.role === "owner") {
      ownerId = profile.id;
    } else if (profile.role === "admin") {
      if (!ownerId) {
        throw new ApiError(400, "owner_id est requis pour les administrateurs");
      }
    } else {
      throw new ApiError(
        403,
        "Acces non autorise. Seuls les proprietaires et admins peuvent acceder au CRG.",
      );
    }

    const crgs = await accountingService.generateCRG(ownerId!, {
      debut: startDate,
      fin: endDate,
      libelle: `Du ${formatDate(startDate)} au ${formatDate(endDate)}`,
    });

    const filteredCRGs = propertyId
      ? crgs.filter((crg: { bien: { id: string } }) => crg.bien.id === propertyId)
      : crgs;

    if (filteredCRGs.length === 0) {
      throw new ApiError(404, "Aucun CRG trouve pour les criteres specifies");
    }

    if (format === "pdf") {
      const crg = filteredCRGs[0];
      const pdfBytes = await generateCRGPDF(crg);

      return new NextResponse(pdfBytes as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="CRG_${crg.numero || "export"}.pdf"`,
          "Content-Length": pdfBytes.length.toString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: filteredCRGs,
      meta: {
        count: filteredCRGs.length,
        periode: { start_date: startDate, end_date: endDate },
        owner_id: ownerId,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
