/**
 * Tenant unpaid-risk scoring.
 *
 * Pure, deterministic scoring engine that computes a risk score (0-100)
 * from a tenant's payment history. No ML model — just a transparent
 * scoring grid the user can explain to their tenant if needed.
 *
 * Inputs are already-validated invoice/payment cents pairs so the
 * scorer has zero side effects and can be unit-tested in isolation.
 *
 * Higher score = better payer.
 */

export type RiskBand = "low" | "medium" | "high" | "critical";

export interface ScoringInvoice {
  invoiceId: string;
  /** ISO date YYYY-MM-DD */
  dueDate: string;
  amountDueCents: number;
  amountPaidCents: number;
  /** ISO date YYYY-MM-DD or null if unpaid */
  paidAt: string | null;
  /** Optional period label (YYYY-MM) used in factor messages. */
  periode?: string;
}

export interface ScoringFactor {
  code:
    | "always_paid_on_time"
    | "occasional_lateness"
    | "chronic_lateness"
    | "unpaid_invoices"
    | "recent_deterioration"
    | "no_history"
    | "partial_payments";
  label: string;
  /** Negative = penalty applied. Positive only on bonus codes. */
  delta: number;
}

export interface ScoringResult {
  score: number;
  band: RiskBand;
  factors: ScoringFactor[];
  metrics: {
    invoiceCount: number;
    paidCount: number;
    unpaidCount: number;
    partialCount: number;
    avgDaysLate: number;
    maxDaysLate: number;
    last3MonthsAvgDaysLate: number;
    totalUnpaidCents: number;
  };
  recommendations: string[];
}

const MS_PER_DAY = 86_400_000;

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / MS_PER_DAY);
}

/**
 * Compute the score. `referenceDate` is the date used to age unpaid
 * invoices (default: today). Pass it explicitly in tests.
 */
export function scoreTenantPayments(
  invoices: ScoringInvoice[],
  referenceDate?: string,
): ScoringResult {
  const today = referenceDate ?? new Date().toISOString().split("T")[0];
  const factors: ScoringFactor[] = [];

  if (invoices.length === 0) {
    return {
      score: 50,
      band: "medium",
      factors: [
        {
          code: "no_history",
          label: "Aucun historique de paiement disponible",
          delta: 0,
        },
      ],
      metrics: {
        invoiceCount: 0,
        paidCount: 0,
        unpaidCount: 0,
        partialCount: 0,
        avgDaysLate: 0,
        maxDaysLate: 0,
        last3MonthsAvgDaysLate: 0,
        totalUnpaidCents: 0,
      },
      recommendations: [
        "Demander le premier loyer en avance de phase pour calibrer la fiabilite du locataire.",
      ],
    };
  }

  // Per-invoice computation
  const enriched = invoices.map((inv) => {
    const isPaid = inv.amountPaidCents >= inv.amountDueCents;
    const isPartial =
      inv.amountPaidCents > 0 && inv.amountPaidCents < inv.amountDueCents;
    const referenceForLate = inv.paidAt ?? today;
    const daysLate = Math.max(0, daysBetween(inv.dueDate, referenceForLate));
    return { ...inv, isPaid, isPartial, daysLate };
  });

  const paidCount = enriched.filter((i) => i.isPaid).length;
  const partialCount = enriched.filter((i) => i.isPartial).length;
  const unpaidCount = enriched.filter(
    (i) => i.amountPaidCents === 0,
  ).length;
  const totalUnpaidCents = enriched.reduce(
    (sum, i) => sum + Math.max(0, i.amountDueCents - i.amountPaidCents),
    0,
  );

  const avgDaysLate =
    enriched.reduce((sum, i) => sum + i.daysLate, 0) / enriched.length;
  const maxDaysLate = enriched.reduce(
    (m, i) => Math.max(m, i.daysLate),
    0,
  );

  // Last 3 months — invoices whose dueDate is within 90 days before today
  const cutoff = new Date(Date.parse(today) - 90 * MS_PER_DAY)
    .toISOString()
    .split("T")[0];
  const recent = enriched.filter((i) => i.dueDate >= cutoff);
  const last3MonthsAvgDaysLate =
    recent.length === 0
      ? 0
      : recent.reduce((sum, i) => sum + i.daysLate, 0) / recent.length;

  // ─── Scoring ─────────────────────────────────────────────
  let score = 100;

  // Lateness penalty (avg)
  if (avgDaysLate <= 1) {
    factors.push({
      code: "always_paid_on_time",
      label: "Paiements toujours a l'heure (moyenne <= 1 jour de retard)",
      delta: 0,
    });
  } else if (avgDaysLate <= 7) {
    score -= 10;
    factors.push({
      code: "occasional_lateness",
      label: `Retards occasionnels (moyenne ${avgDaysLate.toFixed(1)} jours)`,
      delta: -10,
    });
  } else if (avgDaysLate <= 30) {
    score -= 25;
    factors.push({
      code: "occasional_lateness",
      label: `Retards reguliers (moyenne ${avgDaysLate.toFixed(1)} jours)`,
      delta: -25,
    });
  } else {
    score -= 45;
    factors.push({
      code: "chronic_lateness",
      label: `Retards chroniques (moyenne ${avgDaysLate.toFixed(1)} jours)`,
      delta: -45,
    });
  }

  // Unpaid penalty
  if (unpaidCount === 1) {
    score -= 15;
    factors.push({
      code: "unpaid_invoices",
      label: "1 echeance non reglee",
      delta: -15,
    });
  } else if (unpaidCount >= 2) {
    score -= 35;
    factors.push({
      code: "unpaid_invoices",
      label: `${unpaidCount} echeances non reglees`,
      delta: -35,
    });
  }

  // Partial payments
  if (partialCount > 0) {
    const delta = Math.min(20, partialCount * 8);
    score -= delta;
    factors.push({
      code: "partial_payments",
      label: `${partialCount} paiement(s) partiel(s) detecte(s)`,
      delta: -delta,
    });
  }

  // Recent deterioration: last 3 months avg late > all-time avg + 7d
  if (
    recent.length >= 2 &&
    last3MonthsAvgDaysLate > avgDaysLate + 7
  ) {
    score -= 10;
    factors.push({
      code: "recent_deterioration",
      label: `Deterioration sur 3 mois (${last3MonthsAvgDaysLate.toFixed(
        1,
      )} jours vs ${avgDaysLate.toFixed(1)} historique)`,
      delta: -10,
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ─── Band & recommendations ──────────────────────────────
  let band: RiskBand;
  const recommendations: string[] = [];

  if (score >= 80) {
    band = "low";
    recommendations.push(
      "Locataire fiable — aucune action necessaire au-dela du suivi standard.",
    );
  } else if (score >= 60) {
    band = "medium";
    recommendations.push("Activer un rappel automatique 3 jours avant l'echeance.");
    if (partialCount > 0) {
      recommendations.push(
        "Verifier que les paiements partiels ne masquent pas un probleme de virement (RIB, plafond SEPA).",
      );
    }
  } else if (score >= 40) {
    band = "high";
    recommendations.push(
      "Mettre en place un suivi rapproche : relance J+1, contact direct au-dela de J+7.",
    );
    if (unpaidCount > 0) {
      recommendations.push(
        "Proposer un echeancier formalise pour les loyers impayes avant declenchement de la garantie (Visale/GLI).",
      );
    }
  } else {
    band = "critical";
    recommendations.push(
      "Risque eleve : declencher la procedure de recouvrement (commandement de payer, activation Visale/GLI).",
    );
    recommendations.push(
      "Verifier l'eligibilite a une procedure de surendettement ou a un plan de regularisation amiable.",
    );
  }

  return {
    score,
    band,
    factors,
    metrics: {
      invoiceCount: enriched.length,
      paidCount,
      unpaidCount,
      partialCount,
      avgDaysLate: Math.round(avgDaysLate * 10) / 10,
      maxDaysLate,
      last3MonthsAvgDaysLate: Math.round(last3MonthsAvgDaysLate * 10) / 10,
      totalUnpaidCents,
    },
    recommendations,
  };
}
