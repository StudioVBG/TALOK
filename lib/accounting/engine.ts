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
  // ── Axes analytiques (ajoutés par migration 20260427200000) ──
  /** Type de tiers (tenant, vendor, landlord, mandant…) pour le sous-compte auxiliaire. */
  thirdPartyType?: 'tenant' | 'landlord' | 'vendor' | 'mandant' | 'copro_owner' | 'employee' | 'tax_authority';
  /** UUID du tiers (profiles.id, providers.id…). */
  thirdPartyId?: string;
  /** Bien immobilier impacté — pour P&L par bien. */
  propertyId?: string;
  /** Lot du bien (building_units.id). */
  unitId?: string;
  /** Bail concerné. */
  leaseId?: string;
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
    /** ID de la ligne (accounting_entry_lines.id) — utilisé pour le lettrage. */
    lineId: string;
    /** ID de l'écriture parente (accounting_entries.id). */
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
  | 'rent_invoiced'
  | 'rent_payment_clearing'
  | 'provision_called'
  | 'provision_received'
  | 'supplier_invoice'
  | 'supplier_payment'
  | 'deposit_received'
  | 'deposit_returned'
  | 'internal_transfer'
  | 'copro_fund_call'
  | 'agency_commission'
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
  // 1. Substitue les comptes collectifs par leurs sous-comptes auxiliaires
  //    pour les lignes qui portent un thirdPartyId. Branché en amont de
  //    validateLines pour que les amounts restent inchangés (substitution
  //    de compte uniquement).
  //    Import dynamique pour éviter une dépendance circulaire engine ↔
  //    auxiliary-resolver (qui importe le type EntryLine d'engine).
  const { resolveAuxiliaryAccounts } = await import(
    './auxiliary-resolver'
  );
  params = {
    ...params,
    lines: await resolveAuxiliaryAccounts(supabase, params.entityId, params.lines),
  };

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
    // Axes analytiques (cf. migration 20260427200000) — propagés tels quels.
    third_party_type: line.thirdPartyType ?? null,
    third_party_id: line.thirdPartyId ?? null,
    property_id: line.propertyId ?? null,
    unit_id: line.unitId ?? null,
    lease_id: line.leaseId ?? null,
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
  // Fast path: read from the pre-aggregated materialized view exposed
  // through fn_balance_for_exercise. Falls back to the legacy aggregation
  // if the function isn't deployed yet (e.g. local dev without latest migration).
  try {
    const { data: mvRows, error: mvErr } = await supabase.rpc(
      'fn_balance_for_exercise',
      { p_entity_id: entityId, p_exercise_id: exerciseId },
    );
    if (!mvErr && Array.isArray(mvRows)) {
      return (mvRows as Array<{
        account_number: string;
        account_label: string;
        total_debit_cents: number;
        total_credit_cents: number;
        solde_debit_cents: number;
        solde_credit_cents: number;
      }>).map((r) => ({
        accountNumber: r.account_number,
        label: r.account_label,
        totalDebitCents: Number(r.total_debit_cents),
        totalCreditCents: Number(r.total_credit_cents),
        soldeDebitCents: Number(r.solde_debit_cents),
        soldeCreditCents: Number(r.solde_credit_cents),
      }));
    }
  } catch {
    // ignore and fall through to live aggregation
  }

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
      id,
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
      lineId: (line as { id: string }).id,
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
  // ── Axes analytiques (cf. migration 20260427200000) ──
  // Propagés sur TOUTES les lignes de l'écriture pour permettre P&L par bien
  // et grand livre par tiers. Optionnels : aucun changement de comportement
  // pour les callers qui ne les renseignent pas.
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  /** Tiers (locataire/fournisseur/propriétaire) pour sous-compte auxiliaire. */
  thirdPartyType?: 'tenant' | 'landlord' | 'vendor' | 'mandant' | 'copro_owner' | 'employee' | 'tax_authority';
  thirdPartyId?: string;
}

/** Helper : applique les axes analytiques du contexte sur chaque ligne. */
function withAxes(ctx: AutoEntryContext, lines: EntryLine[]): EntryLine[] {
  if (!ctx.propertyId && !ctx.leaseId && !ctx.unitId && !ctx.thirdPartyId) {
    return lines;
  }
  return lines.map((l) => ({
    ...l,
    propertyId: l.propertyId ?? ctx.propertyId,
    unitId: l.unitId ?? ctx.unitId,
    leaseId: l.leaseId ?? ctx.leaseId,
    thirdPartyType: l.thirdPartyType ?? ctx.thirdPartyType,
    thirdPartyId: l.thirdPartyId ?? ctx.thirdPartyId,
  }));
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
    lines: withAxes(ctx, [
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706000', debitCents: 0, creditCents: ctx.amountCents },
    ]),
  }),

  /**
   * Reconnaissance en droit du loyer a l'emission de la facture (mode IS).
   * D 411xxx Locataires / C 706000 Loyers. Reserve aux entites en
   * declaration_mode='is_comptable' (BIC/IS), pas pour le revenu foncier reel
   * ni le micro-foncier qui restent en encaissement.
   */
  /**
   * Appel mensuel des provisions de charges au locataire (mode IS).
   * D 411xxx Locataires / C 419100 Provisions reçues.
   * Pour mode reel/micro, les provisions sont enregistrees au paiement
   * via 'provision_received'.
   */
  provision_called: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Appel provisions de charges',
    source: 'auto:provision_called',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: withAxes(ctx, [
      { accountNumber: '411000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '419100', debitCents: 0, creditCents: ctx.amountCents },
    ]),
  }),

  /**
   * Encaissement de la portion 'provisions de charges' d'un loyer (mode reel/micro).
   * D 512xxx Banque / C 419100 Provisions de charges recues.
   * Permet de tracer separement le solde du compte 4191 mois apres mois pour
   * preparer la regularisation annuelle.
   */
  provision_received: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Provisions de charges encaissees',
    source: 'auto:provision_received',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: withAxes(ctx, [
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '419100', debitCents: 0, creditCents: ctx.amountCents },
    ]),
  }),

  rent_invoiced: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Loyer facture (creance)',
    source: 'auto:rent_invoiced',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: withAxes(ctx, [
      { accountNumber: '411000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706000', debitCents: 0, creditCents: ctx.amountCents },
    ]),
  }),

  /**
   * Lettrage du paiement loyer en mode IS : la creance posee par
   * rent_invoiced est soldee par le reglement bancaire.
   * D 512xxx / C 411xxx
   */
  rent_payment_clearing: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'BQ',
    entryDate: ctx.date,
    label: ctx.label || 'Reglement loyer',
    source: 'auto:rent_payment_clearing',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: [
      { accountNumber: ctx.bankAccount ?? '512100', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '411000', debitCents: 0, creditCents: ctx.amountCents },
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
    lines: withAxes(ctx, [
      { accountNumber: '512300', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '165000', debitCents: 0, creditCents: ctx.amountCents },
    ]),
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

  // Commission agence prélevée sur le compte mandant. La source DOIT rester
  // 'auto:agency_commission' : c'est le tag lu par crg-generator.ts,
  // hoguet-report et la function crg-generate pour calculer la Section 3
  // (Honoraires) du CRG. Tout renommage casse la génération CRG.
  // Pour scoper sur un mandant précis, passer thirdPartyType='mandant' +
  // thirdPartyId : l'auxiliary-resolver substituera 467000 par 467MXXXXX.
  // NOTE: 2 builders complémentaires manquent encore côté flux mandant —
  // 'auto:agency_loyer_mandant' (loyer encaissé pour le compte du mandant)
  // et 'auto:agency_reversement' (reversement net au mandant). Tant qu'ils
  // ne sont pas câblés, les sections 1 et 2 du CRG resteront vides.
  agency_commission: (ctx) => ({
    entityId: ctx.entityId,
    exerciseId: ctx.exerciseId,
    journalCode: 'VE',
    entryDate: ctx.date,
    label: ctx.label || 'Honoraires agence',
    source: 'auto:agency_commission',
    reference: ctx.reference,
    userId: ctx.userId,
    lines: withAxes(ctx, [
      { accountNumber: '467000', debitCents: ctx.amountCents, creditCents: 0 },
      { accountNumber: '706100', debitCents: 0, creditCents: ctx.amountCents },
    ]),
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

  // Post the annual amortization charges (D:681100 / C:280xxx) for every
  // active schedule before closing — the charges must hit class 6 so they
  // flow into the resultat via generateClosingEntry below.
  await postAnnualAmortizationEntries(supabase, exerciseId, userId);

  // Generate the closing entry (virement classes 6 et 7 vers compte 120)
  // before flipping the exercise to closed.
  await generateClosingEntry(supabase, exerciseId, userId);

  const { error } = await supabase
    .from('accounting_exercises')
    .update({ status: 'closed', closed_by: userId, closed_at: new Date().toISOString() })
    .eq('id', exerciseId);

  if (error) throw new Error(`Failed to close exercise: ${error.message}`);

  // Refresh the materialized views so the just-closed exercise's reports
  // (balance, GL, FEC) reflect the closing entry immediately. Best-effort:
  // failing to refresh must not undo a successful close.
  try {
    await supabase.rpc('fn_refresh_accounting_views');
  } catch (refreshErr) {
    console.warn(
      '[closeExercise] fn_refresh_accounting_views failed (non-blocking):',
      refreshErr,
    );
  }
}

/**
 * Generate the closing entry for an exercise: zero out every class 6 (charges)
 * and class 7 (products) account against compte 120 (resultat de l'exercice).
 *
 * Skips informational entries (micro_foncier mode) so they do not contaminate
 * the official result.
 *
 * Idempotent: if a CL entry tagged source='auto:closing' already exists for
 * this exercise we skip generation.
 */
export async function generateClosingEntry(
  supabase: SupabaseClient,
  exerciseId: string,
  userId: string,
): Promise<{ entryId: string | null; netResultCents: number; lineCount: number }> {
  // Idempotency guard
  const { data: existing } = await (supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (k: string, v: string) => {
          eq: (k: string, v: string) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: { id: string } | null }>;
            };
          };
        };
      };
    };
  })
    .from('accounting_entries')
    .select('id')
    .eq('exercise_id', exerciseId)
    .eq('source', 'auto:closing')
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return { entryId: existing.id, netResultCents: 0, lineCount: 0 };
  }

  // Fetch exercise to know entity_id and end_date
  const { data: exercise, error: exErr } = await supabase
    .from('accounting_exercises')
    .select('id, entity_id, end_date')
    .eq('id', exerciseId)
    .single();

  if (exErr || !exercise) {
    throw new Error(`Closing entry: exercise lookup failed: ${exErr?.message ?? 'not found'}`);
  }

  // Aggregate class 6 and class 7 balances on non-informational entries
  const { data: rows, error: aggErr } = await supabase
    .from('accounting_entry_lines')
    .select(
      `account_number, debit_cents, credit_cents,
       accounting_entries!inner(exercise_id, informational, is_validated)`,
    )
    .eq('accounting_entries.exercise_id', exerciseId)
    .eq('accounting_entries.is_validated', true);

  if (aggErr) {
    throw new Error(`Closing entry: aggregation failed: ${aggErr.message}`);
  }

  const balances = new Map<string, { debit: number; credit: number }>();
  for (const r of (rows ?? []) as Array<{
    account_number: string;
    debit_cents: number;
    credit_cents: number;
    accounting_entries: { informational: boolean } | { informational: boolean }[];
  }>) {
    const entryMeta = Array.isArray(r.accounting_entries)
      ? r.accounting_entries[0]
      : r.accounting_entries;
    if (entryMeta?.informational) continue;
    const acc = r.account_number;
    if (!acc.startsWith('6') && !acc.startsWith('7')) continue;
    const cur = balances.get(acc) ?? { debit: 0, credit: 0 };
    cur.debit += r.debit_cents ?? 0;
    cur.credit += r.credit_cents ?? 0;
    balances.set(acc, cur);
  }

  if (balances.size === 0) {
    return { entryId: null, netResultCents: 0, lineCount: 0 };
  }

  const lines: EntryLine[] = [];
  let class6Net = 0; // total debit balance on charges (positive = real charge)
  let class7Net = 0; // total credit balance on products (positive = real revenue)

  for (const [acc, bal] of balances.entries()) {
    const net = bal.debit - bal.credit;
    if (net === 0) continue;
    if (acc.startsWith('6')) {
      // Charges normally have a debit balance — zero it with a credit
      class6Net += net;
      if (net > 0) {
        lines.push({ accountNumber: acc, debitCents: 0, creditCents: net });
      } else {
        lines.push({ accountNumber: acc, debitCents: -net, creditCents: 0 });
      }
    } else {
      // Products normally have a credit balance — zero it with a debit
      // For products: balance "net" = debit - credit, so product credit balance = -net
      class7Net += -net;
      if (-net > 0) {
        lines.push({ accountNumber: acc, debitCents: -net, creditCents: 0 });
      } else {
        lines.push({ accountNumber: acc, debitCents: 0, creditCents: net });
      }
    }
  }

  // Net result = class 7 credit balance - class 6 debit balance
  const netResultCents = class7Net - class6Net;

  // Compte 120 absorbs the net result so the closing entry is balanced
  if (netResultCents > 0) {
    // Profit: D 120 to make it balanced (we credited products, debited 120)
    // Wait — products were debited to zero. So debit side = class7Net.
    // Charges were credited to zero. So credit side = class6Net.
    // To balance we need credit side += netResult, hence credit 120 of netResult.
    lines.push({ accountNumber: '120', debitCents: 0, creditCents: netResultCents });
  } else if (netResultCents < 0) {
    // Loss: debit 120
    lines.push({ accountNumber: '120', debitCents: -netResultCents, creditCents: 0 });
  } else if (lines.length > 0) {
    // Exactly break-even but we still need a reference to 120 for traceability.
    lines.push({ accountNumber: '120', debitCents: 0, creditCents: 0 });
  }

  if (lines.length === 0) {
    return { entryId: null, netResultCents: 0, lineCount: 0 };
  }

  const entry = await createEntry(supabase, {
    entityId: exercise.entity_id as string,
    exerciseId,
    journalCode: 'CL',
    entryDate: exercise.end_date as string,
    label: 'Cloture exercice — virement charges et produits au compte de resultat',
    source: 'auto:closing',
    reference: `CL-${exerciseId.slice(0, 8)}`,
    userId,
    autoValidate: true,
    lines,
  });

  return { entryId: entry.id, netResultCents, lineCount: lines.length };
}

/**
 * Post annual depreciation entries for every active amortization schedule of
 * the exercise's entity. For each schedule we look up the amortization_lines
 * row matching the exercise year and post a single OD entry:
 *   D 681100 Dotations aux amortissements
 *   C 280<component> Amortissements <component>
 *
 * Idempotent: skipped if an entry with source='auto:depreciation' already
 * exists for that schedule and exercise.
 */
export async function postAnnualAmortizationEntries(
  supabase: SupabaseClient,
  exerciseId: string,
  userId: string,
): Promise<{ posted: number; skipped: number }> {
  const { data: exercise, error: exErr } = await supabase
    .from('accounting_exercises')
    .select('id, entity_id, end_date')
    .eq('id', exerciseId)
    .single();

  if (exErr || !exercise) {
    throw new Error(
      `Amortization: exercise lookup failed: ${exErr?.message ?? 'not found'}`,
    );
  }

  const exerciseYear = new Date(exercise.end_date as string).getUTCFullYear();
  const entityId = exercise.entity_id as string;

  const { data: schedules, error: schedErr } = await supabase
    .from('amortization_schedules')
    .select('id, component')
    .eq('entity_id', entityId)
    .eq('is_active', true);

  if (schedErr) {
    throw new Error(`Amortization: schedules lookup failed: ${schedErr.message}`);
  }

  let posted = 0;
  let skipped = 0;

  for (const sched of (schedules ?? []) as Array<{ id: string; component: string }>) {
    const { data: line } = await supabase
      .from('amortization_lines')
      .select('id, annual_amount_cents')
      .eq('schedule_id', sched.id)
      .eq('exercise_year', exerciseYear)
      .maybeSingle();

    if (!line || (line.annual_amount_cents as number) <= 0) {
      skipped += 1;
      continue;
    }

    const reference = `AMORT-${sched.id.slice(0, 8)}-${exerciseYear}`;

    const { data: existing } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('entity_id', entityId)
      .eq('reference', reference)
      .eq('source', 'auto:depreciation')
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      skipped += 1;
      continue;
    }

    const componentCode = mapComponentToAmortizationAccount(sched.component);
    const amount = line.annual_amount_cents as number;

    await createEntry(supabase, {
      entityId,
      exerciseId,
      journalCode: 'OD',
      entryDate: exercise.end_date as string,
      label: `Dotation amortissement ${exerciseYear} — ${sched.component}`,
      source: 'auto:depreciation',
      reference,
      userId,
      autoValidate: true,
      lines: [
        { accountNumber: '681100', debitCents: amount, creditCents: 0 },
        { accountNumber: componentCode, debitCents: 0, creditCents: amount },
      ],
    });

    posted += 1;
  }

  return { posted, skipped };
}

/**
 * Map a property component to its 280xxx (amortissements des immobilisations)
 * account. Defaults to 280100 for unknown components.
 */
function mapComponentToAmortizationAccount(component: string): string {
  const map: Record<string, string> = {
    gros_oeuvre: '281310',
    facade: '281320',
    installations: '281330',
    agencements: '281410',
    equipements: '281510',
  };
  return map[component] ?? '281000';
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

/**
 * Remove the lettrage code from a set of entry lines (délettrage).
 * Pas de check d'équilibre : on retire simplement le marker. Utile quand
 * l'utilisateur veut refaire un lettrage différemment.
 */
export async function removeLettrage(
  supabase: SupabaseClient,
  lineIds: string[],
): Promise<void> {
  if (lineIds.length < 1) {
    throw new Error('Délettrage requires at least 1 line');
  }
  const { error } = await supabase
    .from('accounting_entry_lines')
    .update({ lettrage: null })
    .in('id', lineIds);
  if (error) throw new Error(`Failed to remove lettrage: ${error.message}`);
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
