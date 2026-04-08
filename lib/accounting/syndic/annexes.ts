/**
 * Syndic Copropriété — Annexes Generator
 *
 * Generates the 5 mandatory copropriété annexes as JSON objects:
 * - Annexe 1: Situation financière (bank balance, copro balances, works fund)
 * - Annexe 2: Compte de gestion (charges by category: budget vs actual vs variance)
 * - Annexe 3: Dettes et créances (unpaid suppliers, delinquent copros)
 * - Annexe 4: Budget prévisionnel N+1 (voted or "to vote")
 * - Annexe 5: Travaux et opérations exceptionnelles (works fund balance, ongoing works)
 *
 * RULES:
 * - ALWAYS integer cents for amounts
 * - ALWAYS return all 5 annexes
 * - Annexes follow Décret 2005 structure
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBalance } from "@/lib/accounting/engine";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnnexeFinancialSituation {
  annexe: 1;
  title: string;
  bankAccounts: Array<{
    accountNumber: string;
    label: string;
    soldeCents: number;
  }>;
  totalBankCents: number;
  coproBalances: Array<{
    accountNumber: string;
    label: string;
    soldeCents: number;
  }>;
  totalCoproDebtCents: number;
  worksFundCents: number;
  advancesCents: number;
}

export interface AnnexeManagementAccount {
  annexe: 2;
  title: string;
  lines: Array<{
    accountNumber: string;
    label: string;
    budgetCents: number;
    actualCents: number;
    varianceCents: number;
  }>;
  totalBudgetCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
}

export interface AnnexeDebtsReceivables {
  annexe: 3;
  title: string;
  suppliers: Array<{
    accountNumber: string;
    label: string;
    amountCents: number;
  }>;
  totalSupplierDebtCents: number;
  delinquentCopros: Array<{
    accountNumber: string;
    label: string;
    amountCents: number;
  }>;
  totalDelinquentCents: number;
}

export interface AnnexeNextBudget {
  annexe: 4;
  title: string;
  status: "voted" | "to_vote" | "none";
  lines: Array<{
    accountNumber: string;
    label: string;
    amountCents: number;
  }>;
  totalCents: number;
}

export interface AnnexeWorksOperations {
  annexe: 5;
  title: string;
  worksFundBalance: number;
  worksFundContributionsCents: number;
  ongoingWorks: Array<{
    label: string;
    votedAmountCents: number;
    spentCents: number;
    remainingCents: number;
  }>;
  exceptionalOperationsCents: number;
}

export type CoproAnnexe =
  | AnnexeFinancialSituation
  | AnnexeManagementAccount
  | AnnexeDebtsReceivables
  | AnnexeNextBudget
  | AnnexeWorksOperations;

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate all 5 copropriété annexes for an exercise.
 */
export async function generateCoproAnnexes(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
): Promise<CoproAnnexe[]> {
  const balance = await getBalance(supabase, entityId, exerciseId);

  const [annexe1, annexe2, annexe3, annexe4, annexe5] = await Promise.all([
    generateAnnexe1(supabase, entityId, balance),
    generateAnnexe2(supabase, entityId, exerciseId, balance),
    generateAnnexe3(balance),
    generateAnnexe4(supabase, entityId, exerciseId),
    generateAnnexe5(supabase, entityId, exerciseId, balance),
  ]);

  return [annexe1, annexe2, annexe3, annexe4, annexe5];
}

// ---------------------------------------------------------------------------
// Annexe 1: Situation financière
// ---------------------------------------------------------------------------

async function generateAnnexe1(
  supabase: SupabaseClient,
  entityId: string,
  balance: Awaited<ReturnType<typeof getBalance>>,
): Promise<AnnexeFinancialSituation> {
  // Bank accounts (class 5, starting with 512)
  const bankAccounts = balance
    .filter((b) => b.accountNumber.startsWith("512"))
    .map((b) => ({
      accountNumber: b.accountNumber,
      label: b.label,
      soldeCents: b.soldeDebitCents - b.soldeCreditCents,
    }));

  const totalBankCents = bankAccounts.reduce((s, a) => s + a.soldeCents, 0);

  // Copro balances (accounts starting with 450)
  const coproBalances = balance
    .filter(
      (b) => b.accountNumber.startsWith("450") && b.accountNumber !== "450000",
    )
    .map((b) => ({
      accountNumber: b.accountNumber,
      label: b.label,
      soldeCents: b.soldeDebitCents - b.soldeCreditCents,
    }));

  const totalCoproDebtCents = coproBalances
    .filter((c) => c.soldeCents > 0)
    .reduce((s, c) => s + c.soldeCents, 0);

  // Works fund (account 105000)
  const worksFund = balance.find((b) => b.accountNumber === "105000");
  const worksFundCents = worksFund
    ? worksFund.soldeCreditCents - worksFund.soldeDebitCents
    : 0;

  // Advances (account 103000)
  const advances = balance.find((b) => b.accountNumber === "103000");
  const advancesCents = advances
    ? advances.soldeCreditCents - advances.soldeDebitCents
    : 0;

  return {
    annexe: 1,
    title: "Annexe 1 — Situation financiere du syndicat",
    bankAccounts,
    totalBankCents,
    coproBalances,
    totalCoproDebtCents,
    worksFundCents,
    advancesCents,
  };
}

// ---------------------------------------------------------------------------
// Annexe 2: Compte de gestion (management account)
// ---------------------------------------------------------------------------

async function generateAnnexe2(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  balance: Awaited<ReturnType<typeof getBalance>>,
): Promise<AnnexeManagementAccount> {
  // Load budget for exercise
  const { data: budgets } = await supabase
    .from("copro_budgets")
    .select("*")
    .eq("entity_id", entityId)
    .eq("exercise_id", exerciseId)
    .in("status", ["voted", "executed"])
    .limit(1);

  const budget = budgets?.[0];
  const budgetLines = (budget?.budget_lines ?? []) as Array<{
    accountNumber: string;
    label: string;
    amountCents: number;
  }>;

  // Build budget map
  const budgetMap = new Map(
    budgetLines.map((l) => [l.accountNumber, l]),
  );

  // Get all class 6 accounts from balance (actual charges)
  const class6Accounts = balance.filter((b) =>
    b.accountNumber.startsWith("6"),
  );

  // Merge budget and actual
  const allAccounts = new Set([
    ...budgetLines.map((l) => l.accountNumber),
    ...class6Accounts.map((a) => a.accountNumber),
  ]);

  const lines = Array.from(allAccounts)
    .sort()
    .map((acc) => {
      const budgetLine = budgetMap.get(acc);
      const actualLine = class6Accounts.find(
        (a) => a.accountNumber === acc,
      );

      const budgetCents = budgetLine?.amountCents ?? 0;
      const actualCents = actualLine
        ? actualLine.soldeDebitCents - actualLine.soldeCreditCents
        : 0;

      return {
        accountNumber: acc,
        label:
          budgetLine?.label ?? actualLine?.label ?? acc,
        budgetCents,
        actualCents,
        varianceCents: actualCents - budgetCents,
      };
    });

  const totalBudgetCents = lines.reduce((s, l) => s + l.budgetCents, 0);
  const totalActualCents = lines.reduce((s, l) => s + l.actualCents, 0);

  return {
    annexe: 2,
    title: "Annexe 2 — Compte de gestion general",
    lines,
    totalBudgetCents,
    totalActualCents,
    totalVarianceCents: totalActualCents - totalBudgetCents,
  };
}

// ---------------------------------------------------------------------------
// Annexe 3: Dettes et créances
// ---------------------------------------------------------------------------

async function generateAnnexe3(
  balance: Awaited<ReturnType<typeof getBalance>>,
): Promise<AnnexeDebtsReceivables> {
  // Suppliers (accounts starting with 401) — credit balances = debts
  const suppliers = balance
    .filter(
      (b) =>
        b.accountNumber.startsWith("401") &&
        b.soldeCreditCents - b.soldeDebitCents > 0,
    )
    .map((b) => ({
      accountNumber: b.accountNumber,
      label: b.label,
      amountCents: b.soldeCreditCents - b.soldeDebitCents,
    }));

  const totalSupplierDebtCents = suppliers.reduce(
    (s, a) => s + a.amountCents,
    0,
  );

  // Delinquent copros (accounts starting with 450, debit balance = unpaid)
  const delinquentCopros = balance
    .filter(
      (b) =>
        b.accountNumber.startsWith("450") &&
        b.soldeDebitCents - b.soldeCreditCents > 0,
    )
    .map((b) => ({
      accountNumber: b.accountNumber,
      label: b.label,
      amountCents: b.soldeDebitCents - b.soldeCreditCents,
    }));

  const totalDelinquentCents = delinquentCopros.reduce(
    (s, a) => s + a.amountCents,
    0,
  );

  return {
    annexe: 3,
    title: "Annexe 3 — Etat des dettes et des creances",
    suppliers,
    totalSupplierDebtCents,
    delinquentCopros,
    totalDelinquentCents,
  };
}

// ---------------------------------------------------------------------------
// Annexe 4: Budget prévisionnel N+1
// ---------------------------------------------------------------------------

async function generateAnnexe4(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
): Promise<AnnexeNextBudget> {
  // Find the exercise following the current one
  const { data: currentExercise } = await supabase
    .from("accounting_exercises")
    .select("end_date")
    .eq("id", exerciseId)
    .single();

  if (!currentExercise) {
    return {
      annexe: 4,
      title: "Annexe 4 — Budget previsionnel",
      status: "none",
      lines: [],
      totalCents: 0,
    };
  }

  // Find next exercise
  const { data: nextExercise } = await supabase
    .from("accounting_exercises")
    .select("id")
    .eq("entity_id", entityId)
    .gt("start_date", currentExercise.end_date)
    .order("start_date")
    .limit(1)
    .single();

  if (!nextExercise) {
    return {
      annexe: 4,
      title: "Annexe 4 — Budget previsionnel",
      status: "none",
      lines: [],
      totalCents: 0,
    };
  }

  // Find voted budget for next exercise
  const { data: budgets } = await supabase
    .from("copro_budgets")
    .select("*")
    .eq("entity_id", entityId)
    .eq("exercise_id", nextExercise.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const budget = budgets?.[0];

  if (!budget) {
    return {
      annexe: 4,
      title: "Annexe 4 — Budget previsionnel",
      status: "none",
      lines: [],
      totalCents: 0,
    };
  }

  const budgetLines = (budget.budget_lines ?? []) as Array<{
    accountNumber: string;
    label: string;
    amountCents: number;
  }>;

  return {
    annexe: 4,
    title: "Annexe 4 — Budget previsionnel",
    status: budget.status === "voted" ? "voted" : "to_vote",
    lines: budgetLines.map((l) => ({
      accountNumber: l.accountNumber,
      label: l.label,
      amountCents: l.amountCents,
    })),
    totalCents: budgetLines.reduce((s, l) => s + l.amountCents, 0),
  };
}

// ---------------------------------------------------------------------------
// Annexe 5: Travaux et opérations exceptionnelles
// ---------------------------------------------------------------------------

async function generateAnnexe5(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  balance: Awaited<ReturnType<typeof getBalance>>,
): Promise<AnnexeWorksOperations> {
  // Works fund balance (account 105000)
  const worksFund = balance.find((b) => b.accountNumber === "105000");
  const worksFundBalance = worksFund
    ? worksFund.soldeCreditCents - worksFund.soldeDebitCents
    : 0;

  // Works fund contributions this exercise (credit movements on 105000)
  const { data: worksFundEntries } = await supabase
    .from("accounting_entry_lines")
    .select(
      `
      credit_cents,
      accounting_entries!inner(entity_id, exercise_id, is_validated, source)
    `,
    )
    .eq("account_number", "105000")
    .eq("accounting_entries.entity_id", entityId)
    .eq("accounting_entries.exercise_id", exerciseId)
    .eq("accounting_entries.is_validated", true)
    .gt("credit_cents", 0);

  const worksFundContributionsCents = (worksFundEntries ?? []).reduce(
    (sum, e) => sum + (e.credit_cents as number),
    0,
  );

  // Works provisions (account 102000 — travaux décidés AG)
  const worksProvision = balance.find((b) => b.accountNumber === "102000");
  const worksProvisionBalance = worksProvision
    ? worksProvision.soldeCreditCents - worksProvision.soldeDebitCents
    : 0;

  // Works expenses (account 615000)
  const worksExpense = balance.find((b) => b.accountNumber === "615000");
  const worksSpentCents = worksExpense
    ? worksExpense.soldeDebitCents - worksExpense.soldeCreditCents
    : 0;

  // Exceptional charges (account 671000)
  const exceptionalExpense = balance.find(
    (b) => b.accountNumber === "671000",
  );
  const exceptionalCents = exceptionalExpense
    ? exceptionalExpense.soldeDebitCents - exceptionalExpense.soldeCreditCents
    : 0;

  const ongoingWorks =
    worksProvisionBalance > 0 || worksSpentCents > 0
      ? [
          {
            label: "Travaux decides AG",
            votedAmountCents: worksProvisionBalance + worksSpentCents,
            spentCents: worksSpentCents,
            remainingCents: worksProvisionBalance,
          },
        ]
      : [];

  return {
    annexe: 5,
    title: "Annexe 5 — Travaux et operations exceptionnelles",
    worksFundBalance,
    worksFundContributionsCents,
    ongoingWorks,
    exceptionalOperationsCents: exceptionalCents,
  };
}
