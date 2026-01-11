/**
 * API Route: Compte Rendu de Gestion (CRG)
 * GET /api/accounting/crg
 *
 * Génère le compte rendu de gestion pour un propriétaire sur une période.
 * Document obligatoire (Loi Hoguet Art. 6)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";
import { generateCRGPDF } from "@/features/accounting/services/pdf-export.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/crg
 *
 * Query params:
 * - owner_id: string (requis pour admin, ignoré pour owner)
 * - start_date: string (YYYY-MM-DD)
 * - end_date: string (YYYY-MM-DD)
 * - property_id: string (optionnel - filtre sur un bien)
 * - format: 'json' | 'pdf' (défaut: json)
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

    // Récupérer le profil utilisateur
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const format = searchParams.get("format") || "json";
    let ownerId = searchParams.get("owner_id");
    const propertyId = searchParams.get("property_id");

    // Validation des dates
    if (!startDate || !endDate) {
      throw new ApiError(400, "start_date et end_date sont requis (format YYYY-MM-DD)");
    }

    // Validation format date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError(400, "Format de date invalide. Utilisez YYYY-MM-DD");
    }

    // Vérifier que start_date < end_date
    if (new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, "start_date doit être antérieure à end_date");
    }

    // Déterminer l'owner_id selon le rôle
    if (profile.role === "owner") {
      ownerId = profile.id; // Force son propre ID
    } else if (profile.role === "admin") {
      if (!ownerId) {
        throw new ApiError(400, "owner_id est requis pour les administrateurs");
      }
    } else {
      throw new ApiError(403, "Accès non autorisé. Seuls les propriétaires et admins peuvent accéder au CRG.");
    }

    // Générer le CRG
    const crgs = await accountingService.generateCRG(ownerId, {
      debut: startDate,
      fin: endDate,
      libelle: `Du ${formatDate(startDate)} au ${formatDate(endDate)}`,
    });

    // Filtrer par property_id si spécifié
    const filteredCRGs = propertyId
      ? crgs.filter((crg) => crg.bien.id === propertyId)
      : crgs;

    if (filteredCRGs.length === 0) {
      throw new ApiError(404, "Aucun CRG trouvé pour les critères spécifiés");
    }

    // Format PDF
    if (format === "pdf") {
      const crg = filteredCRGs[0]; // Prendre le premier CRG
      const pdfBytes = await generateCRGPDF(crg);

      return new NextResponse(pdfBytes, {
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
        periode: {
          start_date: startDate,
          end_date: endDate,
        },
        owner_id: ownerId,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Formate une date ISO en format français
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
