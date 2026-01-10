/**
 * API Route: Export FEC (Fichier des Écritures Comptables)
 * GET /api/accounting/fec/export
 *
 * Génère l'export FEC conforme aux normes fiscales françaises
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/fec/export
 *
 * Query params:
 * - year: number (requis) - Année fiscale
 * - format: 'csv' | 'txt' (défaut: csv)
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

    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      throw new ApiError(
        403,
        "Accès réservé aux administrateurs. L'export FEC est un document officiel."
      );
    }

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const format = searchParams.get("format") || "csv";

    if (!yearParam) {
      throw new ApiError(400, "L'année (year) est requise");
    }

    const year = parseInt(yearParam);
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    // Générer l'export FEC
    const ecritures = await accountingService.generateExportFEC(year);

    if (ecritures.length === 0) {
      throw new ApiError(404, `Aucune écriture comptable pour l'année ${year}`);
    }

    // Convertir en CSV
    const csvContent = accountingService.exportFECToCSV(ecritures);

    // Générer le nom de fichier conforme
    // Format: {SIREN}FEC{YYYYMMDD}.txt
    const siren = "123456789"; // À remplacer par le vrai SIREN
    const dateExport = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `${siren}FEC${dateExport}.${format === "txt" ? "txt" : "csv"}`;

    // Retourner le fichier
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": format === "txt" ? "text/plain" : "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-FEC-Year": year.toString(),
        "X-FEC-Records": ecritures.length.toString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
