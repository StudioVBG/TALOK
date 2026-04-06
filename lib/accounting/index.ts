/**
 * Module Comptabilite Talok
 *
 * Double-entry accounting engine, FEC export, bank reconciliation,
 * chart of accounts (PCG + Copro), amortization, OCR pipeline.
 */

export {
  // Engine — core CRUD
  createEntry,
  validateEntry,
  reverseEntry,
  getBalance,
  getGrandLivre,
  createAutoEntry,
  createExercise,
  closeExercise,
  initializeJournals,
  applyLettrage,
  // Engine — types
  type EntryLine,
  type CreateEntryParams,
  type AccountingEntry,
  type BalanceItem,
  type GrandLivreItem,
  type AutoEntryEvent,
} from './engine';

export {
  // FEC
  generateFEC,
  validateFECContent,
  exportFEC,
  type FECResult,
  type FECValidationResult,
} from './fec';

export {
  // Reconciliation
  reconcileTransactions,
  manualMatch,
  acceptSuggestion,
  ignoreTransaction,
  getReconciliationStats,
  type BankTransaction,
  type ReconciliationResult,
  type ReconciliationSummary,
  type ReconciliationSuggestion,
} from './reconciliation';

export {
  // Chart of accounts
  PCG_OWNER_ACCOUNTS,
  COPRO_ACCOUNTS,
  initializeChartOfAccounts,
  addCustomAccount,
  // Amortization
  decomposeProperty,
  computeLinearAmortization,
  saveAmortizationSchedule,
  type PropertyComponent,
  type AmortizationLineResult,
  // OCR
  OCR_EXTRACTION_SYSTEM_PROMPT,
  TVA_RATES,
  validateTVACoherence,
  validateOCRAmounts,
  saveDocumentAnalysis,
} from './chart-amort-ocr';
