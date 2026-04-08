// @ts-nocheck
/**
 * API Route: Hoguet Compliance Report
 * GET /api/accounting/agency/hoguet-report
 *
 * Generates a compliance report checking Loi Hoguet requirements:
 * - Carte G validity
 * - Separate mandant bank account
 * - Reversals within 30 days
 * - CRG up to date
 * - TRACFIN alerts (movements > 10 000 EUR on mandant accounts)
 *
 * Returns { checks, score, alerts }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HoguetCheck {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

interface HoguetReport {
  checks: HoguetCheck[];
  score: number; // 0-100
  alerts: HoguetCheck[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// TRACFIN threshold: 10 000 EUR = 1 000 000 cents
// ---------------------------------------------------------------------------

const TRACFIN_THRESHOLD_CENTS = 1_000_000;

// ---------------------------------------------------------------------------
// GET — Generate Hoguet compliance report
// ---------------------------------------------------------------------------

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
    const agencyEntityId = searchParams.get("agencyEntityId");

    if (!agencyEntityId) {
      throw new ApiError(400, "agencyEntityId est requis");
    }

    const checks: HoguetCheck[] = [];
    const alerts: HoguetCheck[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // -----------------------------------------------------------------------
    // Check 1: Carte G validity
    // -----------------------------------------------------------------------

    const { data: entityRaw } = await supabase
      .from("legal_entities")
      .select("*")
      .eq("id", agencyEntityId)
      .single();

    const entity = entityRaw as Record<string, unknown> | null;

    if (!entity) {
      throw new ApiError(404, "Entite agence non trouvee");
    }

    const carteG = entity.carte_g_numero as string | null;
    const carteGExpiry = entity.carte_g_expiry as string | null;
    const caisseGarantie = entity.caisse_garantie as string | null;
    const caisseGarantieNumero = entity.caisse_garantie_numero as string | null;

    if (!carteG) {
      checks.push({
        name: "Carte G",
        status: "error",
        detail: "Numero de carte professionnelle G non renseigne",
      });
    } else if (!carteGExpiry) {
      checks.push({
        name: "Carte G",
        status: "warning",
        detail: `Carte G ${carteG} — date d'expiration non renseignee`,
      });
    } else {
      const expiry = new Date(carteGExpiry);
      const daysUntilExpiry = Math.floor(
        (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry < 0) {
        checks.push({
          name: "Carte G",
          status: "error",
          detail: `Carte G ${carteG} expiree depuis ${Math.abs(daysUntilExpiry)} jours`,
        });
      } else if (daysUntilExpiry < 90) {
        checks.push({
          name: "Carte G",
          status: "warning",
          detail: `Carte G ${carteG} expire dans ${daysUntilExpiry} jours (${carteGExpiry})`,
        });
      } else {
        checks.push({
          name: "Carte G",
          status: "ok",
          detail: `Carte G ${carteG} valide jusqu'au ${carteGExpiry}`,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Check 2: Caisse de garantie
    // -----------------------------------------------------------------------

    if (!caisseGarantie || !caisseGarantieNumero) {
      checks.push({
        name: "Caisse de garantie",
        status: "error",
        detail: "Caisse de garantie financiere non renseignee",
      });
    } else {
      checks.push({
        name: "Caisse de garantie",
        status: "ok",
        detail: `${caisseGarantie} — N° ${caisseGarantieNumero}`,
      });
    }

    // -----------------------------------------------------------------------
    // Check 3: Separate mandant bank account
    // -----------------------------------------------------------------------

    const { data: bankConnectionsRaw } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("entity_id", agencyEntityId)
      .eq("is_active", true);

    const bankConnections = (bankConnectionsRaw ?? []) as Array<Record<string, unknown>>;
    const connectionCount = bankConnections.length;
    const hasMandantBankAccount = connectionCount >= 2 || bankConnections.some(
      (conn) => {
        const bankName = ((conn.bank_name as string) || "").toLowerCase();
        return (
          bankName.includes("mandant") ||
          bankName.includes("gestion") ||
          bankName.includes("fonds tiers")
        );
      },
    );

    if (!bankConnections || bankConnections.length === 0) {
      checks.push({
        name: "Compte bancaire mandant",
        status: "error",
        detail: "Aucun compte bancaire connecte pour cette agence",
      });
    } else if (!hasMandantBankAccount) {
      checks.push({
        name: "Compte bancaire mandant",
        status: "warning",
        detail: `${bankConnections.length} compte(s) connecte(s), mais aucun identifie comme compte mandant/gestion. Verifiez les libelles.`,
      });
    } else {
      checks.push({
        name: "Compte bancaire mandant",
        status: "ok",
        detail: "Compte bancaire mandant identifie (separation des fonds conforme)",
      });
    }

    // -----------------------------------------------------------------------
    // Check 4: Reversals within 30 days
    // -----------------------------------------------------------------------

    // Find mandants with pending reversals > 30 days
    const { data: mandantsRaw } = await supabase
      .from("mandant_accounts")
      .select("*")
      .eq("entity_id", agencyEntityId)
      .eq("is_active", true);

    const mandants = (mandantsRaw ?? []) as Array<Record<string, unknown>>;

    let lateReversals = 0;
    const lateReversalDetails: string[] = [];

    for (const mandant of mandants ?? []) {
      const accountNumber = (mandant.account_number as string) ?? `467${(mandant.id as string).slice(0, 3)}`;

      // Get balance on the mandant sub-account (467XXX)
      const { data: subAccountLines } = await supabase
        .from("accounting_entry_lines")
        .select(
          "debit_cents, credit_cents, accounting_entries!inner(entity_id, entry_date)",
        )
        .eq("accounting_entries.entity_id", agencyEntityId)
        .eq("account_number", accountNumber);

      const totalDebit = (subAccountLines ?? []).reduce(
        (sum: number, l: Record<string, unknown>) =>
          sum + ((l.debit_cents as number) || 0),
        0,
      );
      const totalCredit = (subAccountLines ?? []).reduce(
        (sum: number, l: Record<string, unknown>) =>
          sum + ((l.credit_cents as number) || 0),
        0,
      );
      const pendingCents = totalDebit - totalCredit;

      if (pendingCents > 0) {
        // Check when the oldest unreversed entry was created
        const { data: oldestEntry } = await supabase
          .from("accounting_entry_lines")
          .select(
            "accounting_entries!inner(entry_date, entity_id, source)",
          )
          .eq("accounting_entries.entity_id", agencyEntityId)
          .eq("accounting_entries.source", "auto:agency_commission")
          .eq("account_number", accountNumber)
          .order("accounting_entries(entry_date)", { ascending: true })
          .limit(1);

        if (oldestEntry && oldestEntry.length > 0) {
          const entryData = oldestEntry[0].accounting_entries as unknown as {
            entry_date: string;
          };
          const entryDate = new Date(entryData.entry_date);
          const daysSince = Math.floor(
            (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysSince > 30) {
            lateReversals++;
            lateReversalDetails.push(
              `${mandant.mandant_name}: ${(pendingCents / 100).toFixed(2)} EUR en attente depuis ${daysSince} jours`,
            );
          }
        }
      }
    }

    if (lateReversals > 0) {
      checks.push({
        name: "Reversements sous 30 jours",
        status: "error",
        detail: `${lateReversals} mandant(s) avec reversement en retard: ${lateReversalDetails.join("; ")}`,
      });
    } else {
      checks.push({
        name: "Reversements sous 30 jours",
        status: "ok",
        detail: "Tous les reversements sont a jour (delai < 30 jours)",
      });
    }

    // -----------------------------------------------------------------------
    // Check 5: CRG up to date
    // -----------------------------------------------------------------------

    // Check that CRGs exist for the previous quarter for all active mandants
    const threeMonthsAgo = new Date(
      today.getFullYear(),
      today.getMonth() - 3,
      1,
    );
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0];

    let mandantsWithoutRecentCRG = 0;
    const missingCRGDetails: string[] = [];

    for (const mandant of mandants ?? []) {
      const { data: recentCRGs } = await supabase
        .from("crg_reports")
        .select("id")
        .eq("mandant_id", mandant.id)
        .gte("period_end", threeMonthsAgoStr)
        .limit(1);

      if (!recentCRGs || recentCRGs.length === 0) {
        mandantsWithoutRecentCRG++;
        missingCRGDetails.push(mandant.mandant_name as string);
      }
    }

    if (mandantsWithoutRecentCRG > 0) {
      checks.push({
        name: "CRG a jour",
        status: "warning",
        detail: `${mandantsWithoutRecentCRG} mandant(s) sans CRG recent (< 3 mois): ${missingCRGDetails.join(", ")}`,
      });
    } else if ((mandants ?? []).length === 0) {
      checks.push({
        name: "CRG a jour",
        status: "ok",
        detail: "Aucun mandant actif — pas de CRG requis",
      });
    } else {
      checks.push({
        name: "CRG a jour",
        status: "ok",
        detail: `Tous les mandants (${(mandants ?? []).length}) ont un CRG recent`,
      });
    }

    // -----------------------------------------------------------------------
    // Check 6: TRACFIN alerts (movements > 10 000 EUR on mandant accounts)
    // -----------------------------------------------------------------------

    // Look for single entries > TRACFIN_THRESHOLD_CENTS on mandant sub-accounts (467xxx)
    const { data: largeMovements } = await supabase
      .from("accounting_entry_lines")
      .select(
        `
        id,
        account_number,
        debit_cents,
        credit_cents,
        label,
        accounting_entries!inner(
          id, entity_id, entry_date, label, source, entry_number
        )
      `,
      )
      .eq("accounting_entries.entity_id", agencyEntityId)
      .like("account_number", "467%")
      .or(`debit_cents.gte.${TRACFIN_THRESHOLD_CENTS},credit_cents.gte.${TRACFIN_THRESHOLD_CENTS}`);

    if (largeMovements && largeMovements.length > 0) {
      for (const movement of largeMovements) {
        const entry = movement.accounting_entries as unknown as {
          entry_date: string;
          entry_number: string;
          label: string;
        };
        const amountCents = Math.max(
          (movement.debit_cents as number) || 0,
          (movement.credit_cents as number) || 0,
        );

        const alert: HoguetCheck = {
          name: "TRACFIN - Mouvement suspect",
          status: "warning",
          detail: `Mouvement de ${(amountCents / 100).toFixed(2)} EUR sur compte ${movement.account_number} le ${entry.entry_date} (ecriture ${entry.entry_number}: ${entry.label})`,
        };

        alerts.push(alert);
      }

      checks.push({
        name: "TRACFIN",
        status: "warning",
        detail: `${largeMovements.length} mouvement(s) > 10 000 EUR detecte(s) sur les comptes mandants. Verification requise.`,
      });
    } else {
      checks.push({
        name: "TRACFIN",
        status: "ok",
        detail: "Aucun mouvement suspect detecte (seuil: 10 000 EUR)",
      });
    }

    // -----------------------------------------------------------------------
    // Compute compliance score
    // -----------------------------------------------------------------------

    const totalChecks = checks.length;
    const okChecks = checks.filter((c) => c.status === "ok").length;
    const warningChecks = checks.filter((c) => c.status === "warning").length;

    // ok = full points, warning = half points, error = 0 points
    const score = Math.round(
      ((okChecks + warningChecks * 0.5) / totalChecks) * 100,
    );

    const report: HoguetReport = {
      checks,
      score,
      alerts,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
