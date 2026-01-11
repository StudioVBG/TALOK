/**
 * API Route: Balance des Mandants
 * GET /api/accounting/balance
 *
 * Génère la balance des mandants (comptes propriétaires et locataires).
 * Document de contrôle interne pour l'attestation de représentation des fonds.
 * Accès réservé aux administrateurs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { accountingService } from "@/features/accounting/services/accounting.service";
import { generateBalancePDF } from "@/features/accounting/services/pdf-export.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/balance
 *
 * Query params:
 * - date: string (YYYY-MM-DD) - Date de la balance (défaut: aujourd'hui)
 * - format: 'json' | 'csv' | 'pdf' (défaut: json)
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
        "Accès réservé aux administrateurs. La balance des mandants est un document de contrôle interne."
      );
    }

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const format = searchParams.get("format") || "json";

    // Validation format date
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ApiError(400, "Format de date invalide. Utilisez YYYY-MM-DD");
    }

    // Générer la balance
    const balance = await accountingService.generateBalanceMandants(date);

    // Format CSV
    if (format === "csv") {
      const csv = generateBalanceCSV(balance);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="balance_mandants_${date}.csv"`,
        },
      });
    }

    // Format PDF
    if (format === "pdf") {
      const pdfBytes = await generateBalancePDF(balance);

      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="balance_mandants_${date}.pdf"`,
          "Content-Length": pdfBytes.length.toString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: balance,
      meta: {
        date,
        nb_proprietaires: balance.comptes_proprietaires.length,
        nb_locataires: balance.comptes_locataires.length,
        equilibre: balance.verification.equilibre,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Génère le CSV de la balance des mandants
 */
function generateBalanceCSV(balance: any): string {
  const lines: string[] = [];

  // En-tête
  lines.push(`BALANCE DES MANDANTS AU ${balance.date}`);
  lines.push("");

  // Comptes propriétaires
  lines.push("COMPTES PROPRIETAIRES (467100)");
  lines.push("Compte;Propriétaire;Bien;Débit;Crédit");
  for (const compte of balance.comptes_proprietaires) {
    lines.push(
      `${compte.compte};${compte.nom};${compte.bien || ""};${compte.debit.toFixed(2).replace(".", ",")};${compte.credit.toFixed(2).replace(".", ",")}`
    );
  }
  lines.push(
    `TOTAL;;${balance.total_proprietaires.debit.toFixed(2).replace(".", ",")};${balance.total_proprietaires.credit.toFixed(2).replace(".", ",")}`
  );
  lines.push("");

  // Comptes locataires
  lines.push("COMPTES LOCATAIRES (467200)");
  lines.push("Compte;Locataire;Débit (dû);Crédit");
  for (const compte of balance.comptes_locataires) {
    lines.push(
      `${compte.compte};${compte.nom};${compte.debit.toFixed(2).replace(".", ",")};${compte.credit.toFixed(2).replace(".", ",")}`
    );
  }
  lines.push(
    `TOTAL;;${balance.total_locataires.debit.toFixed(2).replace(".", ",")};${balance.total_locataires.credit.toFixed(2).replace(".", ",")}`
  );
  lines.push("");

  // Vérification
  lines.push("VERIFICATION D'EQUILIBRE");
  lines.push(
    `Solde banque mandant;${balance.verification.solde_banque_mandant.toFixed(2).replace(".", ",")}`
  );
  lines.push(
    `Total dettes propriétaires;${balance.verification.total_dettes_proprietaires.toFixed(2).replace(".", ",")}`
  );
  lines.push(
    `Total créances locataires;${balance.verification.total_creances_locataires.toFixed(2).replace(".", ",")}`
  );
  lines.push(
    `Écart;${balance.verification.ecart.toFixed(2).replace(".", ",")};${balance.verification.equilibre ? "OK" : "ERREUR"}`
  );

  return lines.join("\n");
}
