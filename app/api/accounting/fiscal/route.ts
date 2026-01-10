/**
 * API Route: Récapitulatif Fiscal
 * GET /api/accounting/fiscal
 *
 * Génère le récapitulatif fiscal annuel pour aider à remplir la déclaration 2044.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/fiscal
 *
 * Query params:
 * - year: number (YYYY) - Année fiscale (défaut: année précédente)
 * - owner_id: string (admin only)
 * - format: 'json' | 'pdf' | 'csv' (défaut: json)
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
    const yearParam = searchParams.get("year");
    const year = yearParam
      ? parseInt(yearParam)
      : new Date().getFullYear() - 1; // Année précédente par défaut
    const format = searchParams.get("format") || "json";
    let ownerId = searchParams.get("owner_id");

    // Validation année
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    // Déterminer owner_id selon le rôle
    if (profile.role === "owner") {
      ownerId = profile.id;
    } else if (profile.role === "admin") {
      if (!ownerId) {
        throw new ApiError(400, "owner_id est requis pour les administrateurs");
      }
    } else {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Générer le récapitulatif fiscal
    const recap = await accountingService.generateRecapFiscal(ownerId, year);

    // Format CSV
    if (format === "csv") {
      const csv = generateFiscalCSV(recap);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="recap_fiscal_${year}.csv"`,
        },
      });
    }

    // Format PDF (à implémenter)
    if (format === "pdf") {
      return NextResponse.json(
        { error: "Export PDF non encore implémenté" },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      data: recap,
      meta: {
        year,
        owner_id: ownerId,
        nb_biens: recap.biens.length,
        generated_at: new Date().toISOString(),
        disclaimer:
          "Ce document est fourni à titre indicatif pour vous aider à remplir votre déclaration 2044. Veuillez vérifier les montants avec votre expert-comptable.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Génère le CSV du récapitulatif fiscal
 */
function generateFiscalCSV(recap: any): string {
  const lines: string[] = [];

  // En-tête
  lines.push(`RÉCAPITULATIF FISCAL ${recap.annee}`);
  lines.push(`Propriétaire: ${recap.proprietaire.prenom || ""} ${recap.proprietaire.nom || recap.proprietaire.raison_sociale || ""}`);
  lines.push("");

  // Revenus bruts
  lines.push("REVENUS BRUTS (Ligne 211)");
  lines.push(`Loyers bruts;${recap.revenus_bruts.loyers.toFixed(2).replace(".", ",")}`);
  lines.push(`Charges récupérées;${recap.revenus_bruts.charges_recuperees.toFixed(2).replace(".", ",")}`);
  lines.push(`TOTAL;${recap.revenus_bruts.total.toFixed(2).replace(".", ",")}`);
  lines.push("");

  // Détail par bien
  lines.push("DÉTAIL PAR BIEN");
  lines.push("Adresse;Locataire;Loyers;Charges");
  for (const bien of recap.biens) {
    lines.push(
      `${bien.adresse};${bien.locataire || "Vacant"};${bien.loyers_bruts.toFixed(2).replace(".", ",")};${bien.charges_recuperees.toFixed(2).replace(".", ",")}`
    );
  }
  lines.push("");

  // Charges déductibles
  lines.push("CHARGES DÉDUCTIBLES");
  lines.push(`Ligne 221 - Honoraires de gestion;${recap.charges_deductibles.ligne_221_honoraires_gestion.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 222 - Frais de gestion forfaitaires;${recap.charges_deductibles.ligne_222_frais_gestion_forfait.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 223 - Assurances;${recap.charges_deductibles.ligne_223_assurances.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 224 - Réparations et entretien;${recap.charges_deductibles.ligne_224_total.toFixed(2).replace(".", ",")}`);

  // Détail réparations
  if (recap.charges_deductibles.ligne_224_reparations.length > 0) {
    for (const rep of recap.charges_deductibles.ligne_224_reparations) {
      lines.push(`  - ${rep.date} ${rep.libelle};${rep.montant.toFixed(2).replace(".", ",")}`);
    }
  }

  lines.push(`Ligne 225 - Charges non récupérées;${recap.charges_deductibles.ligne_225_charges_non_recuperees.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 226 - Indemnités;${recap.charges_deductibles.ligne_226_indemnites.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 227 - Taxe foncière;${recap.charges_deductibles.ligne_227_taxe_fonciere.toFixed(2).replace(".", ",")}`);
  lines.push(`Ligne 229 - Provisions copropriété;${recap.charges_deductibles.ligne_229_provisions_copro.toFixed(2).replace(".", ",")}`);
  lines.push(`TOTAL CHARGES;${recap.charges_deductibles.total.toFixed(2).replace(".", ",")}`);
  lines.push("");

  // Régularisation N-1
  if (recap.regularisation_n_moins_1) {
    lines.push("RÉGULARISATION N-1 (Ligne 230)");
    lines.push(`Provisions déduites N-1;${recap.regularisation_n_moins_1.provisions_deduites.toFixed(2).replace(".", ",")}`);
    lines.push(`Charges réelles;${recap.regularisation_n_moins_1.charges_reelles.toFixed(2).replace(".", ",")}`);
    lines.push(`Régularisation;${recap.regularisation_n_moins_1.regularisation.toFixed(2).replace(".", ",")}`);
    lines.push("");
  }

  // Résultat
  lines.push("REVENU FONCIER NET");
  lines.push(`Revenus bruts;${recap.revenus_bruts.total.toFixed(2).replace(".", ",")}`);
  lines.push(`- Charges déductibles;${recap.charges_deductibles.total.toFixed(2).replace(".", ",")}`);
  if (recap.regularisation_n_moins_1) {
    lines.push(`+ Régularisation N-1;${recap.regularisation_n_moins_1.regularisation.toFixed(2).replace(".", ",")}`);
  }
  lines.push(`= REVENU FONCIER NET;${recap.revenu_foncier_net.toFixed(2).replace(".", ",")}`);

  return lines.join("\n");
}
