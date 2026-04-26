/**
 * Agent TALO Comptabilite — chat assistant grounded in the entity's books.
 *
 * v1 architecture: one-shot retrieval-augmented call. We pre-fetch the
 * likely-relevant facts (balance, recent entries, open invoices, score
 * if asked, fiscal year, declaration mode) and stuff them into the
 * prompt. This keeps latency low (single LLM call) and gives the model
 * a fully grounded answer without exposing raw SQL or letting it
 * hallucinate.
 *
 * Future v2: switch to LangGraph + tool-calling so the agent can drill
 * into specific accounts on demand.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createInstantModel } from "@/lib/ai/config";
import { getBalance } from "@/lib/accounting/engine";
import type { BalanceItem } from "@/lib/accounting/engine";

export interface TaloAccountingContext {
  entityName: string;
  declarationMode: string | null;
  exerciseLabel: string | null;
  currency: "EUR";
  totals: {
    revenuesCents: number;
    expensesCents: number;
    netCents: number;
    cashCents: number;
    receivablesCents: number;
    payablesCents: number;
  };
  topRevenueAccounts: Array<{ account: string; label: string; cents: number }>;
  topExpenseAccounts: Array<{ account: string; label: string; cents: number }>;
  recentEntries: Array<{
    date: string;
    journal: string;
    label: string;
    amountCents: number;
  }>;
  openInvoiceCount: number;
  unpaidCents: number;
}

export interface TaloAccountingAnswer {
  answer: string;
  context: TaloAccountingContext;
  modelUsed: string;
}

const SYSTEM_PROMPT = `Tu es TALO, l'agent comptable de Talok, plateforme française de gestion locative.

Mission :
- Repondre aux questions du proprietaire / gestionnaire sur sa comptabilite
- T'appuyer EXCLUSIVEMENT sur les chiffres du contexte fourni ci-dessous
- Indiquer "Je n'ai pas l'information" si une donnee manque, ne JAMAIS inventer
- Reformuler les montants en euros avec separateur (1 234,56 €)
- Citer le compte concerne quand c'est pertinent (ex: "compte 706 — loyers")

Style :
- Concis, direct, en français
- Utilise les listes a puces pour les enumerations
- Pas de jargon technique inutile (le proprietaire n'est pas comptable)
- Pas de disclaimers verbeux ; un rappel court "Aide indicative — pas de
  conseil fiscal" suffit en fin de message si la question est fiscale

Limites :
- Tu ne donnes pas de conseil fiscal personnalise
- Tu ne valides pas d'ecriture, ne lances pas de cloture, ne signes rien
- Pour ces actions, redirige vers les pages dediees de Talok`;

function fmtEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

async function buildContext(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
): Promise<TaloAccountingContext> {
  const [
    { data: entityRow },
    { data: exerciseRow },
    balance,
    { data: recentEntries },
    { data: openInvoices },
  ] = await Promise.all([
    supabase
      .from("legal_entities")
      .select("name, declaration_mode")
      .eq("id", entityId)
      .maybeSingle(),
    supabase
      .from("accounting_exercises")
      .select("start_date, end_date")
      .eq("id", exerciseId)
      .maybeSingle(),
    getBalance(supabase, entityId, exerciseId),
    supabase
      .from("accounting_entries")
      .select("entry_date, journal_code, label, accounting_entry_lines(debit_cents)")
      .eq("entity_id", entityId)
      .eq("exercise_id", exerciseId)
      .eq("is_validated", true)
      .order("entry_date", { ascending: false })
      .limit(15),
    supabase
      .from("invoices")
      .select("id, montant_total, statut")
      .eq("statut", "due")
      .limit(200),
  ]);

  const balanceItems = balance as BalanceItem[];
  const sumByPrefix = (prefix: string, side: "debit" | "credit") =>
    balanceItems
      .filter((b: BalanceItem) => b.accountNumber.startsWith(prefix))
      .reduce(
        (sum: number, b: BalanceItem) =>
          sum + (side === "debit" ? b.totalDebitCents : b.totalCreditCents),
        0,
      );

  const revenuesCents = sumByPrefix("7", "credit") - sumByPrefix("7", "debit");
  const expensesCents = sumByPrefix("6", "debit") - sumByPrefix("6", "credit");
  const cashCents = sumByPrefix("512", "debit") - sumByPrefix("512", "credit");
  const receivablesCents =
    sumByPrefix("411", "debit") - sumByPrefix("411", "credit");
  const payablesCents =
    sumByPrefix("401", "credit") - sumByPrefix("401", "debit");

  const topRevenueAccounts = balanceItems
    .filter(
      (b: BalanceItem) =>
        b.accountNumber.startsWith("7") && b.totalCreditCents > 0,
    )
    .sort(
      (a: BalanceItem, b: BalanceItem) =>
        b.totalCreditCents - a.totalCreditCents,
    )
    .slice(0, 5)
    .map((b: BalanceItem) => ({
      account: b.accountNumber,
      label: b.label,
      cents: b.totalCreditCents,
    }));

  const topExpenseAccounts = balanceItems
    .filter(
      (b: BalanceItem) =>
        b.accountNumber.startsWith("6") && b.totalDebitCents > 0,
    )
    .sort(
      (a: BalanceItem, b: BalanceItem) =>
        b.totalDebitCents - a.totalDebitCents,
    )
    .slice(0, 5)
    .map((b: BalanceItem) => ({
      account: b.accountNumber,
      label: b.label,
      cents: b.totalDebitCents,
    }));

  type EntryRow = {
    entry_date: string;
    journal_code: string;
    label: string;
    accounting_entry_lines?: Array<{ debit_cents: number }>;
  };
  const recent = ((recentEntries ?? []) as EntryRow[])
    .slice(0, 10)
    .map((e: EntryRow) => {
      const lines = e.accounting_entry_lines ?? [];
      const totalDebit = lines.reduce(
        (s: number, l: { debit_cents: number }) => s + (l.debit_cents ?? 0),
        0,
      );
      return {
        date: e.entry_date,
        journal: e.journal_code,
        label: e.label,
        amountCents: totalDebit,
      };
    });

  type InvoiceRow = { montant_total?: number };
  const unpaidCents = ((openInvoices ?? []) as InvoiceRow[]).reduce(
    (sum: number, inv: InvoiceRow) =>
      sum + Math.round((inv.montant_total ?? 0) * 100),
    0,
  );

  return {
    entityName: (entityRow as { name?: string } | null)?.name ?? "Entite",
    declarationMode:
      (entityRow as { declaration_mode?: string } | null)?.declaration_mode ?? null,
    exerciseLabel:
      exerciseRow
        ? `${(exerciseRow as { start_date: string }).start_date} → ${
            (exerciseRow as { end_date: string }).end_date
          }`
        : null,
    currency: "EUR",
    totals: {
      revenuesCents,
      expensesCents,
      netCents: revenuesCents - expensesCents,
      cashCents,
      receivablesCents,
      payablesCents,
    },
    topRevenueAccounts,
    topExpenseAccounts,
    recentEntries: recent,
    openInvoiceCount: (openInvoices ?? []).length,
    unpaidCents,
  };
}

function renderContext(ctx: TaloAccountingContext): string {
  const lines: string[] = [];
  lines.push(`Entite : ${ctx.entityName}`);
  if (ctx.declarationMode) lines.push(`Regime fiscal : ${ctx.declarationMode}`);
  if (ctx.exerciseLabel) lines.push(`Exercice : ${ctx.exerciseLabel}`);
  lines.push("");
  lines.push("Totaux de l'exercice :");
  lines.push(`- Revenus (classe 7) : ${fmtEur(ctx.totals.revenuesCents)}`);
  lines.push(`- Charges (classe 6) : ${fmtEur(ctx.totals.expensesCents)}`);
  lines.push(`- Resultat : ${fmtEur(ctx.totals.netCents)}`);
  lines.push(`- Tresorerie (512) : ${fmtEur(ctx.totals.cashCents)}`);
  lines.push(`- Creances clients (411) : ${fmtEur(ctx.totals.receivablesCents)}`);
  lines.push(`- Dettes fournisseurs (401) : ${fmtEur(ctx.totals.payablesCents)}`);
  lines.push("");
  lines.push("Top 5 comptes de produits :");
  for (const a of ctx.topRevenueAccounts) {
    lines.push(`- ${a.account} ${a.label} : ${fmtEur(a.cents)}`);
  }
  lines.push("");
  lines.push("Top 5 comptes de charges :");
  for (const a of ctx.topExpenseAccounts) {
    lines.push(`- ${a.account} ${a.label} : ${fmtEur(a.cents)}`);
  }
  lines.push("");
  lines.push("10 ecritures recentes :");
  for (const e of ctx.recentEntries) {
    lines.push(
      `- ${e.date} [${e.journal}] ${e.label} (${fmtEur(e.amountCents)})`,
    );
  }
  lines.push("");
  lines.push(`Factures non reglees : ${ctx.openInvoiceCount}`);
  lines.push(`Total impaye : ${fmtEur(ctx.unpaidCents)}`);
  return lines.join("\n");
}

export async function askTaloAccounting(
  supabase: SupabaseClient,
  params: { entityId: string; exerciseId: string; question: string },
): Promise<TaloAccountingAnswer> {
  const ctx = await buildContext(
    supabase,
    params.entityId,
    params.exerciseId,
  );

  const model = createInstantModel(false);
  const prompt = `${SYSTEM_PROMPT}

CONTEXTE COMPTABLE (donnees reelles, source unique de verite) :
${renderContext(ctx)}

QUESTION DU PROPRIETAIRE :
${params.question}`;

  const response = await model.invoke(prompt);
  const content = response.content as unknown;
  let answer = "";
  if (typeof content === "string") {
    answer = content;
  } else if (Array.isArray(content)) {
    answer = (content as Array<unknown>)
      .map((c: unknown) => {
        if (typeof c === "string") return c;
        if (
          c &&
          typeof c === "object" &&
          "text" in c &&
          typeof (c as { text?: unknown }).text === "string"
        ) {
          return (c as { text: string }).text;
        }
        return "";
      })
      .join("");
  }

  return {
    answer: answer.trim() || "Je n'ai pas pu generer de reponse.",
    context: ctx,
    modelUsed: "instant",
  };
}
