/**
 * Module Comptabilite Talok — Rapprochement bancaire
 *
 * Matching automatique transactions bancaires ↔ ecritures comptables.
 * Score = 50 (montant) + dateProximity×0.3 + labelSimilarity×0.2
 *
 * REGLES:
 * - TOUJOURS lettrer apres rapprochement
 * - Score >= 95 → matched_auto
 * - Score 70-94 → suggested (validation humaine)
 * - Score < 70 → orphan
 * - Detection transferts internes automatique
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankTransaction {
  id: string;
  connectionId: string;
  transactionDate: string;
  valueDate: string | null;
  amountCents: number;
  label: string | null;
  rawLabel: string | null;
  counterpartName: string | null;
  reconciliationStatus: string;
  matchedEntryId: string | null;
  matchScore: number | null;
  suggestion: ReconciliationSuggestion | null;
  isInternalTransfer: boolean;
}

export interface ReconciliationSuggestion {
  entryId: string;
  entryNumber: string;
  entryLabel: string;
  score: number;
  matchReasons: string[];
}

export interface ReconciliationResult {
  transactionId: string;
  status: 'matched_auto' | 'suggested' | 'orphan';
  matchedEntryId: string | null;
  score: number;
  suggestion: ReconciliationSuggestion | null;
}

export interface ReconciliationSummary {
  total: number;
  matchedAuto: number;
  suggested: number;
  orphan: number;
  internalTransfers: number;
}

interface EntryCandidate {
  id: string;
  entryNumber: string;
  entryDate: string;
  label: string;
  totalDebitCents: number;
  totalCreditCents: number;
  isMatched: boolean;
}

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

const SCORE_WEIGHTS = {
  amount: 50,
  dateProximity: 30,
  labelSimilarity: 20,
} as const;

const THRESHOLD_AUTO = 95;
const THRESHOLD_SUGGESTED = 70;

/**
 * Score a bank transaction against an entry candidate.
 */
function scoreMatch(
  tx: { amountCents: number; transactionDate: string; label: string | null; rawLabel: string | null },
  entry: EntryCandidate,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // --- Amount match (50 points) ---
  const txAmount = Math.abs(tx.amountCents);
  // For bank entries: positive = credit to bank (income), negative = debit from bank (expense)
  const entryAmount = tx.amountCents > 0
    ? entry.totalDebitCents  // incoming: bank is debited in accounting
    : entry.totalCreditCents; // outgoing: bank is credited in accounting

  if (txAmount === entryAmount) {
    score += SCORE_WEIGHTS.amount;
    reasons.push('montant_exact');
  } else {
    // Partial score for close amounts (within 1%)
    const diff = Math.abs(txAmount - entryAmount);
    const tolerance = Math.max(txAmount, entryAmount) * 0.01;
    if (diff <= tolerance && diff <= 100) { // max 1 EUR tolerance
      score += SCORE_WEIGHTS.amount * 0.8;
      reasons.push('montant_proche');
    }
  }

  // --- Date proximity (30 points) ---
  const txDate = new Date(tx.transactionDate);
  const entryDate = new Date(entry.entryDate);
  const daysDiff = Math.abs(
    (txDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysDiff === 0) {
    score += SCORE_WEIGHTS.dateProximity;
    reasons.push('date_exacte');
  } else if (daysDiff <= 1) {
    score += SCORE_WEIGHTS.dateProximity * 0.9;
    reasons.push('date_j+1');
  } else if (daysDiff <= 3) {
    score += SCORE_WEIGHTS.dateProximity * 0.7;
    reasons.push('date_j+3');
  } else if (daysDiff <= 7) {
    score += SCORE_WEIGHTS.dateProximity * 0.4;
    reasons.push('date_j+7');
  } else if (daysDiff <= 30) {
    score += SCORE_WEIGHTS.dateProximity * 0.1;
  }

  // --- Label similarity (20 points) ---
  const txLabel = (tx.label ?? tx.rawLabel ?? '').toLowerCase();
  const entryLabel = entry.label.toLowerCase();

  if (txLabel && entryLabel) {
    const similarity = computeLabelSimilarity(txLabel, entryLabel);
    score += SCORE_WEIGHTS.labelSimilarity * similarity;
    if (similarity > 0.8) reasons.push('libelle_similaire');
    else if (similarity > 0.5) reasons.push('libelle_partiel');
  }

  return { score: Math.round(score * 100) / 100, reasons };
}

/**
 * Simple label similarity based on common word overlap (Jaccard index).
 */
function computeLabelSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a.split(/\s+/).filter((w) => w.length > 2),
  );
  const wordsB = new Set(
    b.split(/\s+/).filter((w) => w.length > 2),
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ---------------------------------------------------------------------------
// Internal transfer detection
// ---------------------------------------------------------------------------

/**
 * Detect internal transfers: same amount, opposite sign, different connections, same day ±1.
 */
function detectInternalTransfers(
  transactions: Array<{ id: string; connectionId: string; amountCents: number; transactionDate: string }>,
): Map<string, string> {
  const pairs = new Map<string, string>(); // txId → paired txId

  for (let i = 0; i < transactions.length; i++) {
    if (pairs.has(transactions[i].id)) continue;

    for (let j = i + 1; j < transactions.length; j++) {
      if (pairs.has(transactions[j].id)) continue;

      const a = transactions[i];
      const b = transactions[j];

      // Different connections
      if (a.connectionId === b.connectionId) continue;

      // Opposite amounts
      if (a.amountCents + b.amountCents !== 0) continue;

      // Same day ±1
      const dateA = new Date(a.transactionDate);
      const dateB = new Date(b.transactionDate);
      const daysDiff = Math.abs(
        (dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 1) continue;

      pairs.set(a.id, b.id);
      pairs.set(b.id, a.id);
      break;
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Main reconciliation
// ---------------------------------------------------------------------------

/**
 * Run automatic reconciliation for all pending bank transactions of an entity.
 */
export async function reconcileTransactions(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
): Promise<{ results: ReconciliationResult[]; summary: ReconciliationSummary }> {
  // Fetch pending bank transactions
  const { data: connections, error: connError } = await supabase
    .from('bank_connections')
    .select('id')
    .eq('entity_id', entityId)
    .eq('is_active', true);

  if (connError) throw new Error(`Failed to fetch connections: ${connError.message}`);
  if (!connections || connections.length === 0) {
    return {
      results: [],
      summary: { total: 0, matchedAuto: 0, suggested: 0, orphan: 0, internalTransfers: 0 },
    };
  }

  const connectionIds = connections.map((c: { id: string }) => c.id);

  const { data: transactions, error: txError } = await supabase
    .from('bank_transactions')
    .select('*')
    .in('connection_id', connectionIds)
    .eq('reconciliation_status', 'pending')
    .order('transaction_date', { ascending: true });

  if (txError) throw new Error(`Failed to fetch transactions: ${txError.message}`);
  if (!transactions || transactions.length === 0) {
    return {
      results: [],
      summary: { total: 0, matchedAuto: 0, suggested: 0, orphan: 0, internalTransfers: 0 },
    };
  }

  // Detect internal transfers first
  const transferPairs = detectInternalTransfers(
    transactions.map((tx: { id: string; connection_id: string; amount_cents: number; transaction_date: string }) => ({
      id: tx.id,
      connectionId: tx.connection_id,
      amountCents: tx.amount_cents,
      transactionDate: tx.transaction_date,
    })),
  );

  // Mark internal transfers
  const transferIds = Array.from(transferPairs.keys());
  if (transferIds.length > 0) {
    await supabase
      .from('bank_transactions')
      .update({ is_internal_transfer: true })
      .in('id', transferIds);
  }

  // Fetch unmatched entry candidates (bank journal entries)
  const { data: entriesRaw, error: entryError } = await supabase
    .from('accounting_entries')
    .select(`
      id, entry_number, entry_date, label,
      accounting_entry_lines(debit_cents, credit_cents)
    `)
    .eq('entity_id', entityId)
    .eq('exercise_id', exerciseId)
    .eq('is_validated', true)
    .in('journal_code', ['BQ', 'OD']);

  if (entryError) throw new Error(`Failed to fetch entries: ${entryError.message}`);

  // Build candidate list with totals
  const candidates: EntryCandidate[] = (entriesRaw ?? []).map((e: {
    id: string;
    entry_number: string;
    entry_date: string;
    label: string;
    accounting_entry_lines: Array<{ debit_cents: number; credit_cents: number }>;
  }) => ({
    id: e.id,
    entryNumber: e.entry_number,
    entryDate: e.entry_date,
    label: e.label,
    totalDebitCents: e.accounting_entry_lines.reduce(
      (s: number, l: { debit_cents: number }) => s + l.debit_cents, 0,
    ),
    totalCreditCents: e.accounting_entry_lines.reduce(
      (s: number, l: { credit_cents: number }) => s + l.credit_cents, 0,
    ),
    isMatched: false,
  }));

  // Check which entries are already matched
  const { data: alreadyMatched } = await supabase
    .from('bank_transactions')
    .select('matched_entry_id')
    .in('connection_id', connectionIds)
    .not('matched_entry_id', 'is', null);

  const matchedEntryIds = new Set(
    (alreadyMatched ?? []).map((t: { matched_entry_id: string }) => t.matched_entry_id),
  );

  for (const c of candidates) {
    if (matchedEntryIds.has(c.id)) c.isMatched = true;
  }

  // Score each transaction against available candidates
  const results: ReconciliationResult[] = [];
  const summary: ReconciliationSummary = {
    total: transactions.length,
    matchedAuto: 0,
    suggested: 0,
    orphan: 0,
    internalTransfers: transferIds.length / 2,
  };

  for (const tx of transactions) {
    // Skip internal transfers (handled separately)
    if (transferPairs.has(tx.id)) continue;

    let bestScore = 0;
    let bestCandidate: EntryCandidate | null = null;
    let bestReasons: string[] = [];

    for (const candidate of candidates) {
      if (candidate.isMatched) continue;

      const { score, reasons } = scoreMatch(
        {
          amountCents: tx.amount_cents,
          transactionDate: tx.transaction_date,
          label: tx.label,
          rawLabel: tx.raw_label,
        },
        candidate,
      );

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
        bestReasons = reasons;
      }
    }

    let status: 'matched_auto' | 'suggested' | 'orphan';
    let matchedEntryId: string | null = null;
    let suggestion: ReconciliationSuggestion | null = null;

    if (bestScore >= THRESHOLD_AUTO && bestCandidate) {
      status = 'matched_auto';
      matchedEntryId = bestCandidate.id;
      bestCandidate.isMatched = true;
      summary.matchedAuto++;
    } else if (bestScore >= THRESHOLD_SUGGESTED && bestCandidate) {
      status = 'suggested';
      suggestion = {
        entryId: bestCandidate.id,
        entryNumber: bestCandidate.entryNumber,
        entryLabel: bestCandidate.label,
        score: bestScore,
        matchReasons: bestReasons,
      };
      summary.suggested++;
    } else {
      status = 'orphan';
      summary.orphan++;
    }

    // Update transaction in DB
    await supabase
      .from('bank_transactions')
      .update({
        reconciliation_status: status,
        matched_entry_id: matchedEntryId,
        match_score: bestScore,
        suggestion: suggestion ? JSON.stringify(suggestion) : null,
      })
      .eq('id', tx.id);

    results.push({
      transactionId: tx.id,
      status,
      matchedEntryId,
      score: bestScore,
      suggestion,
    });
  }

  return { results, summary };
}

// ---------------------------------------------------------------------------
// Manual matching
// ---------------------------------------------------------------------------

/**
 * Manually match a bank transaction to an accounting entry.
 */
export async function manualMatch(
  supabase: SupabaseClient,
  transactionId: string,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({
      reconciliation_status: 'matched_manual',
      matched_entry_id: entryId,
      match_score: 100,
    })
    .eq('id', transactionId);

  if (error) throw new Error(`Manual match failed: ${error.message}`);
}

/**
 * Accept a suggestion and convert it to a match.
 */
export async function acceptSuggestion(
  supabase: SupabaseClient,
  transactionId: string,
): Promise<void> {
  const { data: tx, error: fetchError } = await supabase
    .from('bank_transactions')
    .select('suggestion')
    .eq('id', transactionId)
    .single();

  if (fetchError || !tx) throw new Error(`Transaction not found: ${fetchError?.message}`);
  if (!tx.suggestion) throw new Error('No suggestion to accept');

  const suggestion = typeof tx.suggestion === 'string'
    ? JSON.parse(tx.suggestion) as ReconciliationSuggestion
    : tx.suggestion as ReconciliationSuggestion;

  const { error } = await supabase
    .from('bank_transactions')
    .update({
      reconciliation_status: 'matched_manual',
      matched_entry_id: suggestion.entryId,
      match_score: suggestion.score,
    })
    .eq('id', transactionId);

  if (error) throw new Error(`Accept suggestion failed: ${error.message}`);
}

/**
 * Dismiss a transaction (mark as ignored).
 */
export async function ignoreTransaction(
  supabase: SupabaseClient,
  transactionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('bank_transactions')
    .update({ reconciliation_status: 'ignored' })
    .eq('id', transactionId);

  if (error) throw new Error(`Ignore failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Get reconciliation statistics for an entity.
 */
export async function getReconciliationStats(
  supabase: SupabaseClient,
  entityId: string,
): Promise<ReconciliationSummary> {
  const { data: connections } = await supabase
    .from('bank_connections')
    .select('id')
    .eq('entity_id', entityId)
    .eq('is_active', true);

  if (!connections || connections.length === 0) {
    return { total: 0, matchedAuto: 0, suggested: 0, orphan: 0, internalTransfers: 0 };
  }

  const connectionIds = connections.map((c: { id: string }) => c.id);

  const { data, error } = await supabase
    .from('bank_transactions')
    .select('reconciliation_status, is_internal_transfer')
    .in('connection_id', connectionIds);

  if (error) throw new Error(`Stats fetch failed: ${error.message}`);

  const summary: ReconciliationSummary = {
    total: data.length,
    matchedAuto: 0,
    suggested: 0,
    orphan: 0,
    internalTransfers: 0,
  };

  for (const tx of data) {
    if (tx.is_internal_transfer) summary.internalTransfers++;
    switch (tx.reconciliation_status) {
      case 'matched_auto': summary.matchedAuto++; break;
      case 'suggested': summary.suggested++; break;
      case 'orphan': summary.orphan++; break;
    }
  }

  return summary;
}
