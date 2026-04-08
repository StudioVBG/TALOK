/**
 * Syndic Copropriété — Fund Call Generation
 *
 * Generates fund calls (appels de fonds) from a voted budget.
 * Distributes amounts among lots proportional to tantièmes.
 * Creates accounting entries: D:4500XX / C:701000 per line
 * Adds fonds de travaux ALUR (2.5% of budget) → D:4500XX / C:105000
 *
 * RULES:
 * - ALWAYS integer cents
 * - ALWAYS adjust last lot for rounding
 * - ALWAYS create accounting entries for each call
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createEntry } from '@/lib/accounting/engine';

type Periodicity = 'trimester' | 'semester' | 'annual';

interface BudgetLine {
  accountNumber: string;
  label: string;
  amountCents: number;
}

interface FundCallResult {
  callId: string;
  periodLabel: string;
  callAmountCents: number;
  lines: {
    lineId: string;
    lotId: string;
    ownerName: string;
    tantiemes: number;
    amountCents: number;
  }[];
}

/**
 * Generate fund calls from a voted budget.
 *
 * 1. Load budget (lines + total)
 * 2. Load active lots with tantiemes
 * 3. Calculate totalTantiemes = sum(lots.tantiemes_generaux)
 * 4. Split into periods (4 for trimester, 2 for semester, 1 for annual)
 * 5. For each period:
 *    - Insert copro_fund_calls with call_amount = total / nb_periods
 *    - For each lot: insert copro_fund_call_lines with amount = call_total * lot.tantiemes / totalTantiemes
 *    - Adjust last lot for rounding
 * 6. Create accounting entries: D:4500XX / C:701000 per line
 * 7. Add fonds de travaux line (2.5% of budget) → D:4500XX / C:105000
 */
export async function generateFundCalls(
  supabase: SupabaseClient,
  budgetId: string,
  periodicity: Periodicity,
  userId: string,
): Promise<FundCallResult[]> {
  // 1. Load budget
  const { data: budget, error: budgetError } = await supabase
    .from('copro_budgets')
    .select('*')
    .eq('id', budgetId)
    .single();

  if (budgetError || !budget) {
    throw new Error(`Budget not found: ${budgetError?.message ?? 'missing'}`);
  }

  if (budget.status !== 'voted') {
    throw new Error('Fund calls can only be generated from a voted budget');
  }

  const entityId = budget.entity_id as string;
  const exerciseId = budget.exercise_id as string;
  const budgetLines = (budget.budget_lines ?? []) as BudgetLine[];
  const totalBudgetCents = budgetLines.reduce((sum, l) => sum + l.amountCents, 0);

  if (totalBudgetCents <= 0) {
    throw new Error('Budget total must be positive');
  }

  // 2. Load active lots
  const { data: lots, error: lotsError } = await supabase
    .from('copro_lots')
    .select('*')
    .eq('copro_entity_id', entityId)
    .eq('is_active', true)
    .order('lot_number');

  if (lotsError) {
    throw new Error(`Failed to load lots: ${lotsError.message}`);
  }

  if (!lots || lots.length === 0) {
    throw new Error('No active lots found for this copropriété');
  }

  // 3. Calculate total tantièmes
  const totalTantiemes = lots.reduce(
    (sum, lot) => sum + (lot.tantiemes_generaux as number),
    0,
  );

  if (totalTantiemes <= 0) {
    throw new Error('Total tantièmes must be positive');
  }

  // 4. Determine periods
  const nbPeriods = periodicity === 'trimester' ? 4 : periodicity === 'semester' ? 2 : 1;
  const periodLabels = getPeriodLabels(periodicity);
  const today = new Date().toISOString().split('T')[0];

  const results: FundCallResult[] = [];

  // 5. For each period
  for (let p = 0; p < nbPeriods; p++) {
    // Split budget evenly; last period gets remainder
    const callAmountCents =
      p < nbPeriods - 1
        ? Math.floor(totalBudgetCents / nbPeriods)
        : totalBudgetCents - Math.floor(totalBudgetCents / nbPeriods) * (nbPeriods - 1);

    // Insert fund call
    const { data: call, error: callError } = await supabase
      .from('copro_fund_calls')
      .insert({
        entity_id: entityId,
        exercise_id: exerciseId,
        budget_id: budgetId,
        call_number: `AF-${p + 1}/${nbPeriods}`,
        call_date: today,
        due_date: getPeriodDueDate(p, periodicity),
        call_amount_cents: callAmountCents,
        period_label: periodLabels[p],
        status: 'draft',
      })
      .select()
      .single();

    if (callError || !call) {
      throw new Error(`Failed to create fund call: ${callError?.message ?? 'unknown'}`);
    }

    // Calculate per-lot amounts
    const lineResults: FundCallResult['lines'] = [];
    let allocatedCents = 0;

    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i];
      const lotTantiemes = lot.tantiemes_generaux as number;
      const isLast = i === lots.length - 1;

      // Proportional amount; last lot gets remainder for rounding
      const lotAmountCents = isLast
        ? callAmountCents - allocatedCents
        : Math.round(callAmountCents * lotTantiemes / totalTantiemes);

      allocatedCents += lotAmountCents;

      // Determine copro sub-account (450 + lot_number padded)
      const coproAccount = getCoproAccount(lot.lot_number as string);

      // Insert fund call line
      const { data: line, error: lineError } = await supabase
        .from('copro_fund_call_lines')
        .insert({
          call_id: call.id,
          lot_id: lot.id,
          owner_name: lot.owner_name as string,
          tantiemes: lotTantiemes,
          amount_cents: lotAmountCents,
          paid_cents: 0,
          payment_status: 'pending',
        })
        .select()
        .single();

      if (lineError || !line) {
        throw new Error(`Failed to create call line: ${lineError?.message ?? 'unknown'}`);
      }

      // 6. Create accounting entry: D:4500XX / C:701000
      await createEntry(supabase, {
        entityId,
        exerciseId,
        journalCode: 'VE',
        entryDate: today,
        label: `Appel de fonds ${periodLabels[p]} — lot ${lot.lot_number} (${lot.owner_name})`,
        source: 'auto:copro_fund_call',
        reference: call.call_number as string,
        userId,
        lines: [
          { accountNumber: coproAccount, debitCents: lotAmountCents, creditCents: 0 },
          { accountNumber: '701000', debitCents: 0, creditCents: lotAmountCents },
        ],
      });

      lineResults.push({
        lineId: line.id,
        lotId: lot.id,
        ownerName: lot.owner_name as string,
        tantiemes: lotTantiemes,
        amountCents: lotAmountCents,
      });
    }

    // 7. Fonds de travaux ALUR (2.5% of period amount)
    const worksFundCents = Math.round(callAmountCents * 0.025);

    if (worksFundCents > 0) {
      for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const lotTantiemes = lot.tantiemes_generaux as number;
        const isLast = i === lots.length - 1;

        const lotWorksCents = isLast
          ? worksFundCents - lots.slice(0, -1).reduce(
              (s, l) => s + Math.round(worksFundCents * (l.tantiemes_generaux as number) / totalTantiemes),
              0,
            )
          : Math.round(worksFundCents * lotTantiemes / totalTantiemes);

        if (lotWorksCents <= 0) continue;

        const coproAccount = getCoproAccount(lot.lot_number as string);

        await createEntry(supabase, {
          entityId,
          exerciseId,
          journalCode: 'VE',
          entryDate: today,
          label: `Fonds travaux ALUR ${periodLabels[p]} — lot ${lot.lot_number}`,
          source: 'auto:copro_works_fund',
          reference: call.call_number as string,
          userId,
          lines: [
            { accountNumber: coproAccount, debitCents: lotWorksCents, creditCents: 0 },
            { accountNumber: '105000', debitCents: 0, creditCents: lotWorksCents },
          ],
        });
      }
    }

    results.push({
      callId: call.id,
      periodLabel: periodLabels[p],
      callAmountCents,
      lines: lineResults,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the copro sub-account number for a lot.
 * Format: 450 + lot_number padded to 3 digits (e.g., lot "5" → "450005")
 */
export function getCoproAccount(lotNumber: string): string {
  // Extract digits from lot number
  const digits = lotNumber.replace(/\D/g, '');
  return `450${digits.padStart(3, '0')}`;
}

function getPeriodLabels(periodicity: Periodicity): string[] {
  switch (periodicity) {
    case 'trimester':
      return ['T1', 'T2', 'T3', 'T4'];
    case 'semester':
      return ['S1', 'S2'];
    case 'annual':
      return ['Annuel'];
  }
}

function getPeriodDueDate(periodIndex: number, periodicity: Periodicity): string {
  const year = new Date().getFullYear();

  switch (periodicity) {
    case 'trimester': {
      const months = ['01-15', '04-15', '07-15', '10-15'];
      return `${year}-${months[periodIndex]}`;
    }
    case 'semester': {
      const months = ['01-15', '07-15'];
      return `${year}-${months[periodIndex]}`;
    }
    case 'annual':
      return `${year}-01-15`;
  }
}
