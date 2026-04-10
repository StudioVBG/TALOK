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
import { requireAccountingAccess } from '@/lib/accounting/feature-gates';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/fec/export
 *
 * Query params:
 * - year: number (requis) - Année fiscale
 * - entityId: string (requis) - UUID de l'entité juridique (legal_entities.id)
 *     Utilisé pour renseigner le SIREN dans le nom de fichier FEC conforme
 *     à l'article A47 A-1 LPF (format {SIREN}FEC{YYYYMMDD}).
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

    // Feature gate: check subscription plan
    const featureGate = await requireAccountingAccess(profile.id, 'fec');
    if (featureGate) return featureGate;

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const entityId = searchParams.get("entityId");
    const format = searchParams.get("format") || "csv";

    if (!yearParam) {
      throw new ApiError(400, "L'année (year) est requise");
    }
    if (!entityId) {
      throw new ApiError(
        400,
        "Le paramètre entityId est requis pour identifier l'entité juridique (SIREN)."
      );
    }

    const year = parseInt(yearParam);
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    // Récupérer l'entité juridique — le SIREN est obligatoire pour un FEC légal.
    // Noms de colonnes issus de supabase/migrations/20260115010000_multi_entity_architecture.sql.
    const { data: entity } = await supabase
      .from("legal_entities")
      .select("id, siren, nom, adresse_siege, regime_fiscal")
      .eq("id", entityId)
      .single();

    if (!entity) {
      throw new ApiError(404, "Entité juridique introuvable");
    }

    const entitySiren = (entity as { siren: string | null }).siren;
    if (!entitySiren || entitySiren.length !== 9) {
      return NextResponse.json(
        {
          error:
            "SIREN manquant pour cette entité. Renseignez-le dans Paramètres > Entité juridique.",
        },
        { status: 422 }
      );
    }

    // Générer l'export FEC
    const ecritures = await accountingService.generateExportFEC(year);

    if (ecritures.length === 0) {
      throw new ApiError(404, `Aucune écriture comptable pour l'année ${year}`);
    }

    // Convertir en CSV
    const csvContent = accountingService.exportFECToCSV(ecritures);

    // Générer le nom de fichier conforme à l'art. A47 A-1 LPF
    // Format: {SIREN}FEC{YYYYMMDD}.txt
    const dateExport = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `${entitySiren}FEC${dateExport}.${format === "txt" ? "txt" : "csv"}`;

    // Retourner le fichier
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": format === "txt" ? "text/plain" : "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-FEC-Year": year.toString(),
        "X-FEC-Records": ecritures.length.toString(),
        "X-FEC-Siren": entitySiren,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
