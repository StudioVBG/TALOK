/**
 * Types TypeScript locaux pour le module Comptabilité.
 *
 * Inférés depuis les migrations Supabase (20260406210000_accounting_complete.sql,
 * 20260407130000_ocr_category_rules.sql) et depuis l'usage réel dans les clients
 * / routes API.
 *
 * Utilisé pour restaurer la type-safety après suppression des `// @ts-nocheck`
 * du module, le `lib/supabase/database.types.ts` actuel exposant les tables
 * accounting en `GenericRowType` (= Record<string, unknown>).
 */

// ──────────────────────────────────────────────────────────────────
// Enums (miroirs des CHECK constraints SQL)
// ──────────────────────────────────────────────────────────────────

export type ExerciseStatus = "open" | "closing" | "closed";

export type JournalCode = "ACH" | "VE" | "BQ" | "OD" | "AN" | "CL";
export type JournalType =
  | "purchase"
  | "sales"
  | "bank"
  | "miscellaneous"
  | "opening"
  | "closing";

export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense";

export type PlanType = "pcg" | "copro" | "custom";

export type EntrySource = "manual" | "stripe" | "ocr" | "bank" | "auto";

export type BankProvider = "nordigen" | "bridge" | "manual";

export type BankSyncStatus =
  | "pending"
  | "syncing"
  | "synced"
  | "error"
  | "expired"
  | "disconnected";

export type BankAccountType = "checking" | "savings" | "other";

export type ReconciliationStatus =
  | "pending"
  | "matched_auto"
  | "matched_manual"
  | "suggested"
  | "orphan"
  | "ignored";

export type DocumentAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "validated"
  | "rejected";

export type AmortizationMethod = "linear" | "degressive";

export type ExpenseCategory =
  | "travaux"
  | "entretien"
  | "assurance"
  | "taxe_fonciere"
  | "charges_copro"
  | "frais_gestion"
  | "frais_bancaires"
  | "diagnostic"
  | "mobilier"
  | "honoraires"
  | "autre";

// ──────────────────────────────────────────────────────────────────
// Tables — Rows (snake_case, miroir PostgreSQL)
// ──────────────────────────────────────────────────────────────────

export interface AccountingExerciseRow {
  id: string;
  entity_id: string;
  start_date: string;
  end_date: string;
  status: ExerciseStatus;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccountRow {
  id: string;
  entity_id: string;
  account_number: string;
  label: string;
  account_type: AccountType;
  plan_type: PlanType;
  account_class: number;
  is_active: boolean;
  parent_account: string | null;
  created_at: string;
}

export interface AccountingJournalRow {
  id: string;
  entity_id: string;
  code: JournalCode;
  label: string;
  journal_type: JournalType;
  created_at: string;
}

export interface AccountingEntryRow {
  id: string;
  entity_id: string;
  exercise_id: string;
  journal_code: string;
  entry_number: string;
  entry_date: string;
  label: string;
  source: string | null;
  reference: string | null;
  is_validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  is_locked: boolean;
  reversal_of: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccountingEntryLineRow {
  id: string;
  entry_id: string;
  account_number: string;
  label: string | null;
  debit_cents: number;
  credit_cents: number;
  lettrage: string | null;
  piece_ref: string | null;
  created_at: string;
}

export interface BankConnectionRow {
  id: string;
  entity_id: string;
  provider: BankProvider;
  provider_connection_id: string | null;
  bank_name: string | null;
  iban_hash: string;
  account_type: BankAccountType;
  sync_status: BankSyncStatus;
  last_sync_at: string | null;
  consent_expires_at: string | null;
  error_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankTransactionRow {
  id: string;
  connection_id: string;
  provider_transaction_id: string | null;
  transaction_date: string;
  value_date: string | null;
  amount_cents: number;
  currency: string;
  label: string | null;
  raw_label: string | null;
  category: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  reconciliation_status: ReconciliationStatus;
  matched_entry_id: string | null;
  match_score: number | null;
  suggestion: Record<string, unknown> | null;
  is_internal_transfer: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentAnalysisRow {
  id: string;
  document_id: string;
  entity_id: string;
  extracted_data: Record<string, unknown>;
  confidence_score: number | null;
  suggested_account: string | null;
  suggested_journal: string | null;
  document_type: string | null;
  siret_verified: boolean | null;
  tva_coherent: boolean | null;
  processing_status: DocumentAnalysisStatus;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmortizationScheduleRow {
  id: string;
  entity_id: string;
  property_id: string | null;
  component: string;
  acquisition_date: string;
  total_amount_cents: number;
  terrain_percent: number;
  depreciable_amount_cents: number;
  duration_years: number;
  amortization_method: AmortizationMethod;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AmortizationLineRow {
  id: string;
  schedule_id: string;
  exercise_year: number;
  annual_amount_cents: number;
  cumulated_amount_cents: number;
  net_book_value_cents: number;
  is_prorata: boolean;
  created_at: string;
}

export interface ExpenseRow {
  id: string;
  owner_profile_id: string;
  property_id: string | null;
  legal_entity_id: string | null;
  category: ExpenseCategory;
  description: string;
  montant: number;
  montant_ttc: number | null;
  tva_taux: number;
  tva_montant: number;
  date_depense: string;
  fournisseur: string | null;
  status: string;
  deductible: boolean | null;
  created_at: string;
  updated_at: string;
}

// ──────────────────────────────────────────────────────────────────
// DTOs — Shape retournée par les routes API (mix snake/camel selon routes)
// ──────────────────────────────────────────────────────────────────

/** Camel-case variant renvoyée par GET /api/accounting/exercises */
export interface AccountingExerciseDTO {
  id: string;
  entityId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: Exclude<ExerciseStatus, "closing">;
}

/** Shape renvoyée par GET /api/accounting/exercises/[id]/balance */
export interface AccountingBalanceDTO {
  totalDebitCents: number;
  totalCreditCents: number;
  resultCents: number;
  revenueCents: number;
  expensesCents: number;
  monthlySeries: Array<{
    month: string;
    debitCents: number;
    creditCents: number;
  }>;
}

/** Shape renvoyée par GET /api/accounting/entries (liste) */
export interface AccountingEntryDTO {
  id: string;
  entryDate: string;
  label: string;
  journalCode: string;
  entry_number?: string;
  entry_date?: string;
  totalDebitCents: number;
  totalCreditCents?: number;
  source: EntrySource;
  isValidated: boolean;
  is_validated?: boolean;
  lines?: AccountingEntryLineRow[];
}

/** Shape renvoyée par les endpoints d'amortissement */
export interface AmortizationScheduleDTO extends AmortizationScheduleRow {
  amortization_lines?: AmortizationLineRow[];
  property?: { id: string; adresse_complete?: string | null } | null;
}

/** Shape suggérée par OCR lors du flow Scanner justificatif */
export interface OcrExtractedData {
  supplier?: string | null;
  invoice_number?: string | null;
  date?: string | null;
  amount_ttc?: number | null;
  amount_ht?: number | null;
  tva_amount?: number | null;
  tva_rate?: number | null;
  suggested_account?: string | null;
  suggested_journal?: string | null;
  category?: string | null;
  confidence?: number | null;
}

/** Shape passée au composant ProposedEntry */
export interface ProposedEntryLine {
  account_number: string;
  label?: string;
  debit_cents: number;
  credit_cents: number;
}

export interface ProposedEntryShape {
  journal_code: string;
  entry_date: string;
  label: string;
  lines: ProposedEntryLine[];
}

// ──────────────────────────────────────────────────────────────────
// UI — Empty state data pour le dashboard comptable
// ──────────────────────────────────────────────────────────────────

export interface AccountingDashboardData {
  currentExercise: AccountingExerciseDTO | null;
  balance: AccountingBalanceDTO | null;
  recentEntries: AccountingEntryDTO[];
  isLoading: boolean;
  error: unknown;
}

// ──────────────────────────────────────────────────────────────────
// Bank reconciliation UI
// ──────────────────────────────────────────────────────────────────

export interface BankConnectionUIState extends BankConnectionRow {
  account_label?: string;
  masked_iban?: string;
  balance_cents?: number;
  transactions_count?: number;
}

export interface ReconciliationStats {
  totalTransactions: number;
  matchedCount: number;
  suggestedCount: number;
  orphanCount: number;
  ignoredCount: number;
  matchedPercent: number;
}

export interface ReconciliationTransactionUI extends BankTransactionRow {
  suggested_entries?: Array<{
    entry_id: string;
    score: number;
    entry_label: string;
    entry_date: string;
  }>;
}

// ──────────────────────────────────────────────────────────────────
// EC (Expert-Comptable) access
// ──────────────────────────────────────────────────────────────────

export type ECAccessLevel = "read" | "comment" | "write";
export type ECAccessStatus = "pending" | "active" | "revoked";

export interface ECAccessRow {
  id: string;
  entity_id: string;
  ec_email: string;
  ec_name: string | null;
  access_level: ECAccessLevel;
  status: ECAccessStatus;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}
