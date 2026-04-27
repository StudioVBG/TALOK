export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/agency-monthly-reversements
 *
 * Cron mensuel : pour chaque mandat actif avec un solde positif sur son
 * compte mandant, pose automatiquement l'écriture de reversement
 * (D 467 / C 545) à hauteur de la balance complète.
 *
 * Idempotence : la clé `cron:<YYYY-MM>:<mandateId>` garantit qu'au
 * maximum UN reversement automatique par mandat par mois est posé,
 * même si le cron est rejoué plusieurs fois (timeout, retry, etc.).
 *
 * Schedule recommandé : 1er du mois à 06h UTC (laisse les paiements
 * Stripe de fin de mois s'agréger avant le batch).
 *
 * Auth : Bearer CRON_SECRET (cf. /api/cron/irl-indexation pour le
 * pattern). En dev sans CRON_SECRET configuré, accès libre.
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ensureMandantReversementEntry } from "@/lib/accounting/mandant-reversement-entry";

function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.warn(
      "[cron/agency-monthly-reversements] CRON_SECRET absent — accès libre en dev",
    );
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

interface AccountRow {
  id: string;
  mandate_id: string;
  balance_cents: number | null;
}

interface MandateRow {
  id: string;
  status: string;
  agency_entity_id: string;
  mandate_number: string;
}

interface ReversementOutcome {
  mandateId: string;
  mandateNumber: string;
  amountCents: number;
  status:
    | "posted"
    | "would_post"
    | "already_done"
    | "skipped_inactive_mandate"
    | "skipped_no_balance"
    | "error";
  error?: string;
  entryId?: string;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Mode dry-run : utile pour qu'une agence prévisualise ce qui
  // serait reversé avant que le cron ne tourne pour de vrai. Aucune
  // écriture n'est créée, aucun solde n'est touché — on retourne
  // juste la liste des reversements qui seraient déclenchés.
  // Activable par ?dryRun=true sur l'URL ou header X-Dry-Run: 1.
  const url = new URL(request.url);
  const dryRun =
    url.searchParams.get("dryRun") === "true" ||
    request.headers.get("x-dry-run") === "1";

  const supabase = createServiceRoleClient();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const todayIso = now.toISOString().split("T")[0];

  const outcomes: ReversementOutcome[] = [];

  try {
    // 1. Charger toutes les balances positives. On ne filtre PAS par
    //    `reversement_overdue` ici : le cron mensuel sert à rythmer
    //    la trésorerie, pas à attendre les overdues. L'agence qui veut
    //    surseoir peut résilier le mandat ou jouer sur un seuil
    //    futur.
    const { data: accounts, error: accountsError } = await (supabase as any)
      .from("agency_mandant_accounts")
      .select("id, mandate_id, balance_cents")
      .gt("balance_cents", 0);

    if (accountsError) {
      console.error(
        "[cron/agency-monthly-reversements] failed to load accounts:",
        accountsError,
      );
      return NextResponse.json(
        { error: "Erreur lecture accounts", detail: accountsError.message },
        { status: 500 },
      );
    }

    const rows = (accounts ?? []) as AccountRow[];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        yearMonth,
        processed: 0,
        outcomes: [],
        message: "Aucun mandat avec solde positif ce mois",
      });
    }

    // 2. Charger les mandats actifs en une seule requête.
    const mandateIds = rows.map((r) => r.mandate_id);
    const { data: mandates } = await (supabase as any)
      .from("agency_mandates")
      .select("id, status, agency_entity_id, mandate_number")
      .in("id", mandateIds);

    const mandateById = new Map<string, MandateRow>();
    for (const m of (mandates ?? []) as MandateRow[]) {
      mandateById.set(m.id, m);
    }

    // 3. Pour chaque compte, tenter le reversement (idempotent par
    //    mois/mandat). On séquentialise volontairement pour ne pas
    //    saturer la pool Postgres ni la table accounting_entries.
    for (const account of rows) {
      const mandate = mandateById.get(account.mandate_id);
      const balance = account.balance_cents ?? 0;

      if (!mandate) {
        outcomes.push({
          mandateId: account.mandate_id,
          mandateNumber: "?",
          amountCents: balance,
          status: "skipped_inactive_mandate",
          error: "Mandat introuvable",
        });
        continue;
      }

      if (mandate.status !== "active") {
        outcomes.push({
          mandateId: mandate.id,
          mandateNumber: mandate.mandate_number,
          amountCents: balance,
          status: "skipped_inactive_mandate",
        });
        continue;
      }

      if (balance <= 0) {
        outcomes.push({
          mandateId: mandate.id,
          mandateNumber: mandate.mandate_number,
          amountCents: 0,
          status: "skipped_no_balance",
        });
        continue;
      }

      const idempotencyKey = `cron:${yearMonth}:${mandate.id}`;

      // Mode dry-run : on prédit le résultat sans toucher aux
      // écritures. Une simple vérification d'existence d'une écriture
      // déjà postée pour cette idempotency key suffit à distinguer
      // already_done vs would_post.
      if (dryRun) {
        const reference = `agency:reversement:${idempotencyKey}`;
        const { data: existing } = await (supabase as any)
          .from("accounting_entries")
          .select("id")
          .eq("reference", reference)
          .eq("source", "auto:agency_reversement")
          .limit(1)
          .maybeSingle();
        outcomes.push({
          mandateId: mandate.id,
          mandateNumber: mandate.mandate_number,
          amountCents: balance,
          status: existing?.id ? "already_done" : "would_post",
          entryId: existing?.id,
        });
        continue;
      }

      try {
        const result = await ensureMandantReversementEntry(
          supabase,
          mandate.id,
          balance,
          {
            idempotencyKey,
            date: todayIso,
            label: `Reversement automatique ${yearMonth} mandat ${mandate.mandate_number}`,
          },
        );

        if (result.created) {
          outcomes.push({
            mandateId: mandate.id,
            mandateNumber: mandate.mandate_number,
            amountCents: balance,
            status: "posted",
            entryId: result.entryId,
          });
        } else if (result.skippedReason === "already_exists") {
          outcomes.push({
            mandateId: mandate.id,
            mandateNumber: mandate.mandate_number,
            amountCents: balance,
            status: "already_done",
            entryId: result.entryId,
          });
        } else {
          outcomes.push({
            mandateId: mandate.id,
            mandateNumber: mandate.mandate_number,
            amountCents: balance,
            status: "error",
            error: `Skip: ${result.skippedReason}${result.error ? ` — ${result.error}` : ""}`,
          });
        }
      } catch (err) {
        outcomes.push({
          mandateId: mandate.id,
          mandateNumber: mandate.mandate_number,
          amountCents: balance,
          status: "error",
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    const summary = {
      processed: outcomes.length,
      posted: outcomes.filter((o) => o.status === "posted").length,
      would_post: outcomes.filter((o) => o.status === "would_post").length,
      already_done: outcomes.filter((o) => o.status === "already_done").length,
      skipped: outcomes.filter(
        (o) =>
          o.status === "skipped_inactive_mandate" ||
          o.status === "skipped_no_balance",
      ).length,
      errors: outcomes.filter((o) => o.status === "error").length,
      total_to_be_reversed_cents: outcomes
        .filter(
          (o) => o.status === "posted" || o.status === "would_post",
        )
        .reduce((s, o) => s + o.amountCents, 0),
    };

    return NextResponse.json({
      success: true,
      dryRun,
      yearMonth,
      summary,
      outcomes,
    });
  } catch (error: unknown) {
    console.error("[cron/agency-monthly-reversements] fatal:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
        partialOutcomes: outcomes,
      },
      { status: 500 },
    );
  }
}
