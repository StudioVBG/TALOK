/**
 * Module Comptabilite Talok — Engine double-entry
 *
 * CRUD ecritures, validation, contre-passation, balance, grand livre.
 * 14 ecritures automatiques couvrant tous les evenements metier.
 *
 * REGLES:
 * - TOUJOURS centimes INTEGER
 * - TOUJOURS sum(D) = sum(C)
 * - JAMAIS modifier ecriture validee → contre-passer
 * - TOUJOURS audit log sur ecritures
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryLine {
  accountNumber: string;
  label?: string;
  debitCents: number;
  creditCents: number;
  pieceRef?: string;
}

export interface CreateEntryParams {
  entityId: string;
  exerciseId: string;
  journalCode: 'ACH' | 'VE' | 'BQ' | 'OD' | 'AN' | 'CL';
  entryDate: string; // YYYY-MM-DD
  label: string;
  source?: string;
  reference?: string;
  lines: EntryLine[];
  userId: string;
  /**
   * If true, validate the entry immediately after creation (locks it,
   * sets is_validated/validated_by). Defaults to false to preserve the
   * existing manual-validation flow on direct user-driven CRUD; auto-entry
   * helpers always pass true so business events produce closeable books.
   */
  autoValidate?: boolean;
}

export interface AccountingEntry {
  id: string;
  entityId: string;
  exerciseId: string;
  journalCode: string;
  entryNumber: string;
  entryDate: string;
  label: string;
  source: string | null;
  reference: string | null;
  isValidated: boolean;
  isLocked: boolean;
  reversalOf: string | null;
  createdBy: string;
  createdAt: string;
}

export interface BalanceItem {
  accountNumber: string;
  label: string;
  totalDebitCents: number;
  totalCreditCents: number;
  soldeDebitCents: number;
  soldeCreditCents: number;
}

export interface GrandLivreItem {
  accountNumber: string;
  accountLabel: string;
  entries: {
    entryId: string;
    entryNumber: string;
    entryDate: string;
    label: string;
    debitCents: number;
    creditCents: number;
    lettrage: string | null;
  }[];
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface JournalLineItem {
  accountNumber: string;
  accountLabel: string;
  debitCents: number;
  creditCents: number;
  lettrage: string | null;
}

export interface JournalEntryItem {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  label: string;
  reference: string | null;
  lines: JournalLineItem[];
  totalDebitCents: number;
  totalCreditCents: number;
}

export interface JournalItem {
  journalCode: string;
  journalLabel: string;
  entries: JournalEntryItem[];
  totalDebitCents: number;
  totalCreditCents: number;
}

export type AutoEntryEvent =
  | 'rent_received'
  | 'supplier_invoice'
  | 'supplier_payment'
  | 'deposit_received'
  | 'deposit_returned'
  | 'internal_transfer'
  | 'copro_fund_call'
  | 'agency_fee'
  | 'sepa_rejected'
  | 'irl_revision'
  | 'copro_works_fund'
  | 'copro_closing'
  | 'teom_recovered'
  | 'charge_regularization'
  | 'subscription_paid';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateLines(lines: EntryLine[]): void {
  if (lines.length < 2) {
    throw new Error('An entry must have at least 2 lines');
  }

  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    if (line.debitCents < 0 || line.creditCents < 0) {
      throw new Error('Amounts must be non-negative integers (centimes)');
    }
    if (!Number.isInteger(line.debitCents) || !Number.isInteger(line.creditCents)) {
      throw new Error('Amounts must be integers (centimes), never floating point');
    }
    if (line.debitCents > 0 && line.creditCents > 0) {
      throw new Error('A line must be either debit OR credit, not both');
    }
    if (line.debitCents === 0 && line.creditCents === 0) {
      throw new Error('A line must have a non-zero amount');
    }
    if (!line.accountNumber || line.accountNumber.length < 3) {
      throw new Error('Account number is required and must be at least 3 characters');
    }
    totalDebit += line.debitCents;
    totalCredit += line.creditCents;
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Entry is unbalanced: debit=${totalDebit} credit=${totalCredit}. ` +
      'Sum of debits must equal sum of credits.'
    );
  }
}

// ---------------------------------------------------------------------------
// Core CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new accounting entry with lines.
 * Validates balance before insert. Entry number generated server-side.
 */
export async function createEntry(
  supabase: SupabaseClient,
  params: CreateEntryParams,
): Promise<AccountingEntry> {
  validateLines(params.lines);

  // Get next entry number via SQL function
  const { data: entryNumberData, error: seqError } = await supabase
    .rpc('fn_next_entry_number', {
      p_entity_id: params.entityId,
      p_exercise_id: params.exerciseId,
      p_journal_code: params.journalCode,
    });

  if (seqError) throw new Error(`Failed to generate entry number: ${seqError.message}`);

  const entryNumber = entryNumberData as string;

  // Mirror header fields into the legacy agency columns so the insert works even
  // when 20260423130000_accounting_entries_relax_legacy_not_null hasn't run yet.
  const { data: entry, error: entryError } = await supabase
    .from('accounting_entries')
    .insert({
      entity_id: params.entityId,
      exercise_id: params.exerciseId,
      journal_code: params.journalCode,
      entry_number: entryNumber,
      entry_date: params.entryDate,
      label: params.label,
      source: params.source ?? null,
      reference: params.reference ?? null,
      created_by: params.userId,
      ecriture_num: entryNumber,
      ecriture_date: params.entryDate,
      ecriture_lib: params.label,
      piece_ref: params.reference ?? entryNumber,
      piece_date: params.entryDate,
      compte_num: '',
      compte_lib: '',
    })
    .select()
    .single();

  if (entryError) throw new Error(`Failed to create entry: ${entryError.message}`);

  // Insert lines
  const lineInserts = params.lines.map((line) => ({
    entry_id: entry.id,
    account_number: line.accountNumber,
    label: line.label ?? null,
    debit_cents: line.debitCents,
    credit_cents: line.creditCents,
    piece_ref: line.pieceRef ?? null,
  }));

  const { error: linesError } = await supabase
    .from('accounting_entry_lines')
    .insert(lineInserts);

  if (linesError) throw new Error(`Failed to create entry lines: ${linesError.message}`);

  if (params.autoValidate) {
    await validateEntry(supabase, entry.id, params.userId);
    return mapEntry({ ...entry, is_validated: true, validated_by: params.userId });
  }

  return mapEntry(entry);
}

/**
 * Validate an entry: locks it, sets validated_by/at.
 * The DB trigger trg_entry_balance verifies sum(D)=sum(C).
 */
export async function validateEntry(
  supabase: SupabaseClient,
  entryId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('accounting_entries')
    .update({
      is_validated: true,
      validated_by: userId,
    })
    .eq('id', entryId);

  if (error) throw new Error(`Validation failed: ${error.message}`);
}

/**
 * Reverse (contre-passer) a validated entry.
 * Creates a new OD entry with swapped debit/credit.
 */
export async function reverseEntry(
  supabase: SupabaseClient,
  entryId: string,
  userId: string,
  reason: string,
): Promise<AccountingEntry> {
  // Fetch original entry + lines
  const { data: original, error: fetchError } = await supabase
    .from('accounting_entries')
    .select('*, accounting_entry_lines(*)')
    .eq('id', entryId)
    .single();

  if (fetchError || !original) {
    throw new Error(`Entry not found: ${fetchError?.message}`);
  }

  if (!original.is_validated) {
    throw new Error('Can only reverse validated entries');
  }

  const lines: EntryLine[] = original.accounting_entry_lines.map(
    (line: { account_number: string; label: string | null; debit_cents: number; credit_cents: number; piece_ref: string | null }) => ({
      accountNumber: line.account_number,
      label: line.label ?? undefined,
      debitCents: line.credit_cents,   // swap
      creditCents: line.debit_cents,   // swap
      pieceRef: line.piece_ref ?? undefined,
    }),
  );

  const today = new Date().toISOString().split('T')[0];

  const reversal = await createEntry(supabase, {
    entityId: original.entity_id,
    exerciseId: original.exercise_id,
    journalCode: 'OD',
    entryDate: today,
    label: `Contre-passation: ${reason} (ref: ${original.entry_number})`,
    source: 'reversal',
    reference: original.entry_number,
    lines,
    userId,
  });

  // Link reversal to original
  await supabase
    .from('accounting_entries')
    .update({ reversal_of: entryId })
    .eq('id', reversal.id);

  // Auto-validate the reversal
  await validateEntry(supabase, reversal.id, userId);

  return { ...reversal, reversalOf: entryId };
}

/**
 * Get the balance (balance des comptes) for an exercise.
 */
export async function getBalance(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
): Promise<BalanceItem[]> {
  const { data, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      account_number,
      debit_cents,
      credit_cents,
      accounting_entries!inner(entity_id, exercise_id, is_validated)
    `)
    .eq('accounting_entries.entity_id', entityId)
    .eq('accounting_entries.exercise_id', exerciseId)
    .eq('accounting_entries.is_validated', true);

  if (error) throw new Error(`Failed to fetch balance: ${error.message}`);

  // Aggregate by account
  const accountMap = new Map<string, { debit: number; credit: number }>();

  for (const line of data ?? []) {
    const acc = line.account_number;
    const existing = accountMap.get(acc) ?? { debit: 0, credit: 0 };
    existing.debit += line.debit_cents;
    existing.credit += line.credit_cents;
    accountMap.set(acc, existing);
  }

  // Fetch account labels
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('account_number, label')
    .eq('entity_id', entityId);

  const labelMap = new Map(
    (accounts ?? []).map((a: { account_number: string; label: string }) => [a.account_number, a.label]),
  );

  const balance: BalanceItem[] = [];
  for (const [accountNumber, totals] of accountMap.entries()) {
    const solde = totals.debit - totals.credit;
    balance.push({
      accountNumber,
      label: labelMap.get(accountNumber) ?? accountNumber,
      totalDebitCents: totals.debit,
      totalCreditCents: totals.credit,
      soldeDebitCents: solde > 0 ? solde : 0,
      soldeCreditCents: solde < 0 ? Math.abs(solde) : 0,
    });
  }

  return balance.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
}

/**
 * Get the grand livre (general ledger) grouped by account.
 */
export async function getGrandLivre(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  accountFilter?: string,
): Promise<GrandLivreItem[]> {
  let query = supabase
    .from('accounting_entry_lines')
    .select(`
      account_number,
      label,
      debit_cents,
      credit_cents,
      lettrage,
      accounting_entries!inner(
        id, entity_id, exercise_id, entry_number, entry_date, label, is_validated
      )
    `)
    .eq('accounting_entries.entity_id', entityId)
    .eq('accounting_entries.exercise_id', exerciseId)
    .eq('accounting_entries.is_validated', true);

  if (accountFilter) {
    query = query.like('account_number', `${accountFilter}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch grand livre: ${error.message}`);

  // Fetch account labels
  const { data: accounts } = await supabase
    .from('chart_of_accounts')
    .select('account_number, label')
    .eq('entity_id', entityId);

  const labelMap = new Map(
    (accounts ?? []).map((a: { account_number: string; label: string }) => [a.account_number, a.label]),
  );

  // Group by account
  const grouped = new Map<string, GrandLivreItem>();

  for (const line of data ?? []) {
    const acc = line.account_number;
    const entryData = line.accounting_entries as unknown as {
      id: string; entry_number: string; entry_date: string; label: string;
    };

    if (!grouped.has(acc)) {
      grouped.set(acc, {
        accountNumber: acc,
        accountLabel: labelMap.get(acc) ?? acc,
        entries: [],
        totalDebitCents: 0,
        totalCreditCents: 0,
      });
    }

    const item = grouped.get(acc)!;
    item.entries.push({
      entryId: entryData.id,
      entryNumber: entryData.entry_number,
      entryDate: entryData.entry_date,
      label: line.label ?? entryData.label,
      debitCents: line.debit_cents,
      creditCents: line.credit_cents,
      lettrage: line.lettrage,
    });
    item.totalDebitCents += line.debit_cents;
    item.totalCreditCents += line.credit_cents;
  }

  return Array.from(grouped.values()).sort(
    (a, b) => a.accountNumber.localeCompare(b.accountNumber),
  );
}

/**
 * Get the journal (écritures par journal), grouped by journal_code then
 * chronologically inside each group. Each entry includes all of its lines,
 * so the output is self-sufficient for rendering a PDF/XLSX journal général.
 */
export async function getJournal(
  supabase: SupabaseClient,
  entityId: string,
  exerciseId: string,
  journalCode?: string,
): Promise<JournalItem[]> {
  let entriesQuery = supabase
    .from('accounting_entries')
    .select(`
      id, journal_code, entry_number, entry_date, label, reference, is_validated,
      accounting_entry_lines(account_number, label, debit_cents, credit_cents, lettrage)
    `)
    .eq('entity_id', entityId)
    .eq('exercise_id', exerciseId)
    .eq('is_validated', true)
    .order('entry_date', { ascending: true })
    .order('entry_number', { ascending: true });

  if (journalCode) {
    entriesQuery = entriesQuery.eq('journal_code', journalCode);
  }

  const { data: entries, error } = await entriesQuery;
  if (error) throw new Error(`Failed to fetch journal: ${error.message}`);

  const [{ data: accounts }, { data: journals }] = await Promise.all([
    supabase
      .from('chart_of_accounts')
      .select('account_number, label')
      .eq('entity_id', entityId),
    supabase
      .from('accounting_journals')
      .select('code, label')
      .eq('entity_id', entityId),
  ]);

  const accountLabels = new Map(
    (accounts ?? []).map((a: { account_number: string; label: string }) => [
      a.account_number,
      a.label,
    ]),
  );
  const journalLabels = new Map(
    (journals ?? []).map((j: { code: string; label: string }) => [j.code, j.label]),
  );

  const grouped = new Map<string, JournalItem>();

  for (const entry of (entries ?? []) as Array<{
    id: string;
    journal_code: string;
    entry_number: string;
    entry_date: string;
    label: string;
    reference: string | null;
    accounting_entry_lines: Array<{
      account_number: string;
      label: string | null;
      debit_cents: number;
      credit_cents: number;
      lettrage: string | null;
    }>;
  }>) {
    const code = entry.journal_code;
    if (!grouped.has(code)) {
      grouped.set(code, {
        journalCode: code,
        journalLabel: journalLabels.get(code) ?? code,
        entries: [],
        totalDebitCents: 0,
        totalCreditCents: 0,
      });
    }

    const lines: JournalLineItem[] = (entry.accounting_entry_lines ?? []).map((l) => ({
      accountNumber: l.account_number,
      accountLabel: accountLabels.get(l.account_number) ?? l.account_number,
      debitCents: l.debit_cents,
      creditCents: l.credit_cents,
      lettrage: l.lettrage,
    }));
    const totalDebit = lines.reduce((s, l) => s + l.debitCents, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditCents, 0);

    const item = grouped.get(code)!;
    item.entries.push({
      entryId: entry.id,
      entryNumber: entry.entry_number,
      entryDate: entry.entry_date,
      label: entry.label,
      reference: entry.reference,
      lines,
      totalDebitCents: totalDebit,
      totalCreditCents: totalCredit,
    });
    item.totalDebitCents += totalDebit;
    item.totalCreditCents += totalCredit;
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.journalCode.localeCompare(b.journalCode),
  );
}

// ---------------------------------------------------------------------------
// 14 Auto-entries
// ---------------------------------------------------------------------------

interface AutoEntryContext {
  entityId: string;
  exerciseId: string;
  userId: string;
  amountCents: number;
  label: string;
  date: string;
  reference?: string;
  /** Extra amounts for complex entries (e.g. deposit return with deduction) */
  secondaryAmountCents?: number;
  /** Bank account suffix for multi-bank (default: 512100) */
  bankAccount?: string;
  /** Target copro lot account */
  coproAccount?: string;
}

/** Mapping of auto-entry events to their debit/credit accounts */
const AUTO_ENTRIES: Record<
  AutoEntryEvent,
  (ctx: AutoEntryContext) => CreateEntryParams
> = {
  rent_received: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Loyer encaisse',
    source: 'auto:rent_received',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  supplier_invoice: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'ACH',
    entryDate: ctx.date,
    label: ctx.label || 'Facture fournisseur',
    source: 'auto:supplier_invoice',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '615100', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '401000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  supplier_payment: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Paiement fournisseur',
    source: 'auto:supplier_payment',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '401000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  deposit_received: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Depot de garantie recu',
    source: 'auto:deposit_received',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '512300', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '165000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  deposit_returned: (ctx) => {
    const returned = ctx.amountCents;
    const retained = ctx.secondaryAmountCents ?? 0;
    const total = returned + retained;
    const lines: EntryLine[] = [
      { accountNumber: '165000', debitCents: total, creditCents: 0 },
      { accountNumber: '512300', debitCents: 0, creditCents: returned },
    ];
    if (retained > 0) {
      lines.push({ accountNumber: '791000', debitCents: 0, creditCents: retained });
    }
    return {
      entityId: ctx.entityId,
      exerciseId: ctx.exerciseId,
      journalCode: 'BQ',
      entryDate: ctx.date,
      label: ctx.label || 'Restitution depot de garantie',
      source: 'auto:deposit_returned',
      reference: ctx.reference,
      userId: ctx.userId,
      lines,
    };
  },

  internal_transfer: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'OD',
    entryDate: ctx.date,
    label: ctx.label || 'Virement interne',
    source: 'auto:internal_transfer',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '581000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  copro_fund_call: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Appel de fonds copropriete',
    source: 'auto:copro_fund_call',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: ctx.coproAccount ?? '450000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '701000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  agency_fee: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Honoraires agence',
    source: 'auto:agency_fee',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '467000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706100', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  sepa_rejected: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'OD',
    entryDate: ctx.date,
    label: ctx.label || 'Rejet prelevement SEPA',
    source: 'auto:sepa_rejected',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      // Reverse the original rent credit
      { accountNumber: '706000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: 0, creditCents: ctx.amountCents },
      // Create receivable
      { accountNumber: '411000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  irl_revision: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'OD',
    entryDate: ctx.date,
    label: ctx.label || 'Revision IRL du bail',
    source: 'auto:irl_revision',
    reference: ctx.reference,
    userId: ctx.userId,
    // OD entry to historize the rent amount change (no financial impact, memo only)
    lines: [
      { accountNumber: '699000', debitCents: ctx.amountCents, creditCents: 0, label: 'Ancien loyer' },
      { accountNumber: '699000', debitCents: 0, creditCents: ctx.amountCents, label: 'Nouveau loyer' },
    ],
  }),

  copro_works_fund: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Cotisation fonds travaux ALUR',
    source: 'auto:copro_works_fund',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: ctx.coproAccount ?? '450000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '105000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  copro_closing: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'CL',
    entryDate: ctx.date,
    label: ctx.label || 'Cloture exercice copropriete',
    source: 'auto:copro_closing',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      // Close expense accounts to copro account
      { accountNumber: '600000', debitCents: 0, creditCents: ctx.amountCents, label: 'Solde charges' },
      { accountNumber: ctx.coproAccount ?? '450000', debitCents: ctx.amountCents, creditCents: 0, label: 'Repartition' },
    ],
  }),

  teom_recovered: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'OD',
    entryDate: ctx.date,
    label: ctx.label || 'TEOM recuperee sur locataire',
    source: 'auto:teom_recovered',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: '635200', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '708000', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),

  charge_regularization: (ctx) => {
    const provisions = ctx.amountCents; // provisions paid
    const actual = ctx.secondaryAmountCents ?? 0; // actual recoverable
    const diff = provisions - actual;
    const lines: EntryLine[] = [
      { accountNumber: '614100', debitCents: actual, creditCents: 0, label: 'Charges reelles' },
      { accountNumber: '613000', debitCents: 0, creditCents: provisions, label: 'Provisions versees' },
    ];
    // Balance the difference
    if (diff > 0) {
      // Overpaid: credit to tenant
      lines.push({ accountNumber: '411000', debitCents: 0, creditCents: diff, label: 'Trop-percu a rembourser' });
    } else if (diff < 0) {
      // Underpaid: debit to tenant
      lines.push({ accountNumber: '411000', debitCents: Math.abs(diff), creditCents: 0, label: 'Complement a percevoir' });
    }
    return {
      entityId: ctx.entityId,
      exerciseId: ctx.exerciseId,
      journalCode: 'OD',
      entryDate: ctx.date,
      label: ctx.label || 'Regularisation de charges',
      source: 'auto:charge_regularization',
      reference: ctx.reference,
      userId: ctx.userId,
      lines,
    };
  },

  subscription_paid: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Abonnement Talok',
    source: 'auto:subscription_paid',
    reference: ctx.reference,
    userId: ctx.userId,
    // Platform subscription is booked as a miscellaneous fee (honoraires)
    // debited against the bank account at settlement date.
    lines: [
      { accountNumber: '622800', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: 0, creditCents: ctx.amountCents },
    ],
  }),
};

/**
 * Create an automatic entry from a business event.
 * Validates and inserts the entry with proper journal and accounts.
 *
 * Auto-entries are validated immediately (autoValidate=true) so that
 * business events (rent received, deposits, fund calls, etc.) produce
 * closeable books — closeExercise() requires every entry to be validated.
 * Pass `{ skipAutoValidate: true }` to keep the entry as a draft (rare,
 * mostly used for replay/backfill flows that want a human review).
 */
export async function createAutoEntry(
  supabase: SupabaseClient,
  event: AutoEntryEvent,
  context: AutoEntryContext,
  options: { skipAutoValidate?: boolean } = {},
): Promise<AccountingEntry> {
  const builder = AUTO_ENTRIES[event];
  if (!builder) {
    throw new Error(`Unknown auto-entry event: ${event}`);
  }

  const params = builder(context);
  return createEntry(supabase, {
    ...params,
    autoValidate: !options.skipAutoValidate,
  });
}

// ---------------------------------------------------------------------------
// Exercise management
// ---------------------------------------------------------------------------

export async function createExercise(
  supabase: SupabaseClient,
  entityId: string,
  startDate: string,
  endDate: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('accounting_exercises')
    .insert({ entity_id: entityId, start_date: startDate, end_date: endDate })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create exercise: ${error.message}`);
  return data;
}

export async function closeExercise(
  supabase: SupabaseClient,
  exerciseId: string,
  userId: string,
): Promise<void> {
  // First set to closing to prevent new entries
  const { error: closingError } = await supabase
    .from('accounting_exercises')
    .update({ status: 'closing' })
    .eq('id', exerciseId)
    .eq('status', 'open');

  if (closingError) throw new Error(`Failed to start closing: ${closingError.message}`);

  // Check all entries are validated
  const { count, error: countError } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact', head: true })
    .eq('exercise_id', exerciseId)
    .eq('is_validated', false);

  if (countError) throw new Error(`Failed to check entries: ${countError.message}`);

  if (count && count > 0) {
    // Rollback to open
    await supabase
      .from('accounting_exercises')
      .update({ status: 'open' })
      .eq('id', exerciseId);
    throw new Error(`Cannot close: ${count} unvalidated entries remain`);
  }

  const { error } = await supabase
    .from('accounting_exercises')
    .update({ status: 'closed', closed_by: userId, closed_at: new Date().toISOString() })
    .eq('id', exerciseId);

  if (error) throw new Error(`Failed to close exercise: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Journal initialization
// ---------------------------------------------------------------------------

const DEFAULT_JOURNALS = [
  { code: 'ACH', label: 'Journal des achats', journal_type: 'purchase' },
  { code: 'VE', label: 'Journal des ventes', journal_type: 'sales' },
  { code: 'BQ', label: 'Journal de banque', journal_type: 'bank' },
  { code: 'OD', label: 'Operations diverses', journal_type: 'miscellaneous' },
  { code: 'AN', label: 'A-nouveaux', journal_type: 'opening' },
  { code: 'CL', label: 'Cloture', journal_type: 'closing' },
] as const;

/**
 * Initialize default journals for an entity. Idempotent (upsert).
 */
export async function initializeJournals(
  supabase: SupabaseClient,
  entityId: string,
): Promise<void> {
  const inserts = DEFAULT_JOURNALS.map((j) => ({
    entity_id: entityId,
    ...j,
  }));

  const { error } = await supabase
    .from('accounting_journals')
    .upsert(inserts, { onConflict: 'entity_id,code' });

  if (error) throw new Error(`Failed to initialize journals: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Lettrage (matching)
// ---------------------------------------------------------------------------

/**
 * Apply lettrage code to a set of entry lines.
 * Validates that sum of debits = sum of credits for the lettered lines.
 */
export async function applyLettrage(
  supabase: SupabaseClient,
  lineIds: string[],
  lettrageCode: string,
): Promise<void> {
  if (lineIds.length < 2) {
    throw new Error('Lettrage requires at least 2 lines');
  }

  // Fetch lines and verify balance
  const { data: lines, error } = await supabase
    .from('accounting_entry_lines')
    .select('id, debit_cents, credit_cents')
    .in('id', lineIds);

  if (error) throw new Error(`Failed to fetch lines: ${error.message}`);

  const totalDebit = lines.reduce((sum: number, l: { debit_cents: number }) => sum + l.debit_cents, 0);
  const totalCredit = lines.reduce((sum: number, l: { credit_cents: number }) => sum + l.credit_cents, 0);

  if (totalDebit !== totalCredit) {
    throw new Error(
      `Cannot letter: debit=${totalDebit} != credit=${totalCredit}`,
    );
  }

  const { error: updateError } = await supabase
    .from('accounting_entry_lines')
    .update({ lettrage: lettrageCode })
    .in('id', lineIds);

  if (updateError) throw new Error(`Failed to apply lettrage: ${updateError.message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEntry(row: Record<string, unknown>): AccountingEntry {
  return {
    id: row.id as string,
    entityId: row.entity_id as string,
    exerciseId: row.exercise_id as string,
    journalCode: row.journal_code as string,
    entryNumber: row.entry_number as string,
    entryDate: row.entry_date as string,
    label: row.label as string,
    source: (row.source as string) ?? null,
    reference: (row.reference as string) ?? null,
    isValidated: row.is_validated as boolean,
    isLocked: row.is_locked as boolean,
    reversalOf: (row.reversal_of as string) ?? null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  };
}
