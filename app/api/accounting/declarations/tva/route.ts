/**
 * API Route: Déclaration TVA (CA3 mensuelle/trimestrielle, CA12 annuelle)
 * GET /api/accounting/declarations/tva?entityId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Calcule la TVA collectée / déductible sur la période, et la TVA nette
 * à reverser ou le crédit reportable. Source des données : lignes
 * d'écritures validées sur les comptes 445710 (collectée) et 445660
 * (déductible), avec la base HT calculée depuis les comptes 706xxx
 * (produits) pour le contrôle de cohérence.
 *
 * Régime TVA Talok :
 *   - Location nue à usage d'habitation : exonérée art. 261 D 4° CGI
 *     → aucune TVA collectée sur 706000 (loyers)
 *   - Location meublée non professionnelle : exonérée art. 261 D 4° bis
 *   - LMP / location commerciale : assujetti TVA 20%
 *   - Honoraires de gestion (706100) : assujettis TVA 20% côté agence
 *
 * Si l'entité n'a aucune écriture sur 445710/445660 → CA3 à 0, neutre.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AccountAggregate {
  accountNumber: string;
  accountLabel: string;
  totalDebitCents: number;
  totalCreditCents: number;
  /** Solde net positif (D > C) ou négatif (C > D) en cents. */
  balanceCents: number;
  lineCount: number;
}

export interface TvaDeclarationResult {
  entityId: string;
  startDate: string;
  endDate: string;
  /** Détail des comptes 706 (chiffre d'affaires HT). */
  revenueAccounts: AccountAggregate[];
  /** Détail des comptes 445710 (TVA collectée). */
  vatCollected: AccountAggregate[];
  /** Détail des comptes 445660 (TVA déductible). */
  vatDeductible: AccountAggregate[];
  /** Total CA HT = somme des soldes créditeurs des 706. */
  totalRevenueCents: number;
  /** Total TVA collectée = somme des soldes créditeurs des 445710. */
  totalVatCollectedCents: number;
  /** Total TVA déductible = somme des soldes débiteurs des 445660. */
  totalVatDeductibleCents: number;
  /** TVA nette : positive = à reverser au Trésor, négative = crédit reportable. */
  vatToPayCents: number;
  /** Taux moyen apparent (collectée / CA HT) — utile pour vérification. */
  averageRatePct: number | null;
  /** Conseil contextuel : "exonérée" / "à reverser X €" / "crédit reportable X €". */
  recommendation: string;
}

interface EntryLineRow {
  account_number: string;
  debit_cents: number | null;
  credit_cents: number | null;
  accounting_entries: {
    entity_id: string;
    entry_date: string;
    is_validated: boolean;
  } | { entity_id: string; entry_date: string; is_validated: boolean }[];
}

/**
 * GET /api/accounting/declarations/tva
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil non trouvé");

    const featureGate = await requireAccountingAccess(profile.id, "balance");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!entityId) throw new ApiError(400, "entityId requis");
    if (!startDate || !endDate)
      throw new ApiError(400, "start et end requis (YYYY-MM-DD)");

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new ApiError(400, "Format de date invalide (YYYY-MM-DD attendu)");
    }
    if (startDate > endDate) {
      throw new ApiError(400, "start doit être ≤ end");
    }

    if (profile.role !== "admin") {
      const { data: entity } = await serviceClient
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) throw new ApiError(403, "Accès refusé à cette entité");
    }

    // Lit toutes les lignes mouvementant 706xxx, 445660, 445710 sur la période
    const { data, error } = await (serviceClient as any)
      .from("accounting_entry_lines")
      .select(
        `
          account_number,
          debit_cents,
          credit_cents,
          accounting_entries!inner(entity_id, entry_date, is_validated)
        `,
      )
      .eq("accounting_entries.entity_id", entityId)
      .eq("accounting_entries.is_validated", true)
      // Exclut les ecritures informationnelles (mode micro-foncier qui pose
      // des memo entries pour comparer aux donnees reelles). Sans ce filtre,
      // une SCI hybride avec un bail micro et un bail reel verrait sa CA3
      // polluee par les memos micro et la TVA serait calculee a faux.
      .eq("accounting_entries.informational", false)
      .gte("accounting_entries.entry_date", startDate)
      .lte("accounting_entries.entry_date", endDate)
      .or(
        "account_number.like.706%,account_number.like.445710%,account_number.like.445660%",
      );

    if (error) {
      console.error("[declarations/tva] query failed:", error);
      throw new ApiError(500, "Erreur lecture des écritures");
    }

    // Récupère les libellés des comptes en une requête
    const lines = (data ?? []) as EntryLineRow[];
    const accountNumbers = Array.from(
      new Set(lines.map((l) => l.account_number)),
    );

    const labelMap = new Map<string, string>();
    if (accountNumbers.length > 0) {
      const { data: chartRows } = await (serviceClient as any)
        .from("chart_of_accounts")
        .select("account_number, label")
        .eq("entity_id", entityId)
        .in("account_number", accountNumbers);
      for (const row of (chartRows ?? []) as Array<{
        account_number: string;
        label: string;
      }>) {
        labelMap.set(row.account_number, row.label);
      }
    }

    // Agrège par compte
    const byAccount = new Map<
      string,
      { debit: number; credit: number; count: number }
    >();
    for (const line of lines) {
      const acc = byAccount.get(line.account_number) ?? {
        debit: 0,
        credit: 0,
        count: 0,
      };
      acc.debit += line.debit_cents ?? 0;
      acc.credit += line.credit_cents ?? 0;
      acc.count++;
      byAccount.set(line.account_number, acc);
    }

    const toAggregate = (
      accountNumber: string,
      sums: { debit: number; credit: number; count: number },
    ): AccountAggregate => ({
      accountNumber,
      accountLabel: labelMap.get(accountNumber) ?? accountNumber,
      totalDebitCents: sums.debit,
      totalCreditCents: sums.credit,
      balanceCents: sums.debit - sums.credit,
      lineCount: sums.count,
    });

    const revenueAccounts: AccountAggregate[] = [];
    const vatCollected: AccountAggregate[] = [];
    const vatDeductible: AccountAggregate[] = [];
    for (const [acc, sums] of byAccount.entries()) {
      const agg = toAggregate(acc, sums);
      if (acc.startsWith("706")) revenueAccounts.push(agg);
      else if (acc.startsWith("445710")) vatCollected.push(agg);
      else if (acc.startsWith("445660")) vatDeductible.push(agg);
    }
    revenueAccounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    vatCollected.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    vatDeductible.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Solde créditeur sur 706 = CA HT
    const totalRevenueCents = revenueAccounts.reduce(
      (s, a) => s + (a.totalCreditCents - a.totalDebitCents),
      0,
    );
    const totalVatCollectedCents = vatCollected.reduce(
      (s, a) => s + (a.totalCreditCents - a.totalDebitCents),
      0,
    );
    const totalVatDeductibleCents = vatDeductible.reduce(
      (s, a) => s + (a.totalDebitCents - a.totalCreditCents),
      0,
    );
    const vatToPayCents = totalVatCollectedCents - totalVatDeductibleCents;

    const averageRatePct =
      totalRevenueCents > 0
        ? Math.round((totalVatCollectedCents / totalRevenueCents) * 10000) / 100
        : null;

    let recommendation: string;
    if (totalVatCollectedCents === 0 && totalVatDeductibleCents === 0) {
      recommendation =
        "Aucune opération soumise à TVA sur la période. Si l'entité fait uniquement de la location nue d'habitation, c'est normal (exonérée art. 261 D 4° CGI).";
    } else if (vatToPayCents > 0) {
      recommendation = `TVA nette à reverser : ${(vatToPayCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}. Déclare sur impots.gouv.fr (CA3 mensuelle ou CA12 annuelle selon ton régime).`;
    } else if (vatToPayCents < 0) {
      recommendation = `Crédit de TVA reportable : ${(Math.abs(vatToPayCents) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}. À reporter sur la prochaine déclaration ou demande de remboursement si > 760 €.`;
    } else {
      recommendation = "TVA neutre sur la période (collectée = déductible).";
    }

    const result: TvaDeclarationResult = {
      entityId,
      startDate,
      endDate,
      revenueAccounts,
      vatCollected,
      vatDeductible,
      totalRevenueCents,
      totalVatCollectedCents,
      totalVatDeductibleCents,
      vatToPayCents,
      averageRatePct,
      recommendation,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
