export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  authenticateAPIKey,
  requireScope,
} from "@/lib/api/api-key-auth";
import { apiError } from "@/lib/api/middleware";

/**
 * GET /api/v1/accounting/fec
 * Export FEC (Fichier des Écritures Comptables) — French regulatory format
 *
 * Returns a tab-separated file with 18 mandatory columns.
 * Query params: exercice_debut (YYYY-MM-DD), exercice_fin (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateAPIKey(request);
    if (auth instanceof Response) return auth;

    const scopeCheck = requireScope(auth, "accounting");
    if (scopeCheck) return scopeCheck;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const exerciceDebut = searchParams.get("exercice_debut") || `${new Date().getFullYear()}-01-01`;
    const exerciceFin = searchParams.get("exercice_fin") || `${new Date().getFullYear()}-12-31`;

    const { data: entries, error } = await supabase
      .from("accounting_entries")
      .select("*")
      .eq("owner_id", auth.profileId)
      .gte("date_ecriture", exerciceDebut)
      .lte("date_ecriture", exerciceFin)
      .order("date_ecriture", { ascending: true })
      .order("piece_ref", { ascending: true });

    if (error) {
      console.error("[GET /v1/accounting/fec] Error:", error);
      return apiError("Erreur lors de la génération FEC", 500);
    }

    if (!entries || entries.length === 0) {
      return apiError("Aucune écriture pour cette période", 404, "NO_ENTRIES");
    }

    // FEC header (18 columns)
    const FEC_HEADER = [
      "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
      "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
      "PieceRef", "PieceDate", "EcritureLib", "Debit",
      "Credit", "EcritureLet", "DateLet", "ValidDate",
      "Montantdevise", "Idevise",
    ].join("\t");

    const fecLines = entries.map((e: any) => {
      const dateEcriture = e.date_ecriture?.replace(/-/g, "") || "";
      const dateComptable = e.date_comptable?.replace(/-/g, "") || dateEcriture;

      return [
        e.journal_code || "VE",
        e.journal_libelle || "Ventes",
        e.piece_ref || "",
        dateEcriture,
        e.compte_numero || "",
        e.compte_libelle || "",
        e.compte_aux_numero || "",
        e.compte_aux_libelle || "",
        e.piece_ref || "",
        dateComptable,
        e.libelle || "",
        formatFECAmount(e.montant_debit),
        formatFECAmount(e.montant_credit),
        e.lettrage || "",
        e.date_lettrage?.replace(/-/g, "") || "",
        dateComptable,
        "",
        "EUR",
      ].join("\t");
    });

    const fecContent = [FEC_HEADER, ...fecLines].join("\n");

    // Build filename: FEC_SIREN_YYYYMMDD_YYYYMMDD.txt
    const fileName = `FEC_${exerciceDebut.replace(/-/g, "")}_${exerciceFin.replace(/-/g, "")}.txt`;

    return new Response(fecContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-FEC-Lines": String(entries.length),
      },
    });
  } catch (error: unknown) {
    console.error("[GET /v1/accounting/fec] Error:", error);
    return apiError("Erreur serveur", 500);
  }
}

function formatFECAmount(amount: number | null | undefined): string {
  if (!amount || amount === 0) return "0,00";
  return (amount / 100).toFixed(2).replace(".", ",");
}
