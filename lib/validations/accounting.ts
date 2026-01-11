/**
 * Schemas de validation Zod pour le module comptabilité
 * Conformité FEC (Fichier des Écritures Comptables) et normes françaises
 */

import { z } from "zod";

// ============================================================================
// TYPES DE BASE
// ============================================================================

export const JournalCodeSchema = z.enum(["VE", "AC", "BQ", "BM", "OD", "AN"]);

export const AccountClassSchema = z.number().int().min(1).max(9);

export const AccountSensSchema = z.enum(["debit", "credit", "mixte"]);

export const DateFrSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  "Format de date invalide (attendu: YYYY-MM-DD)"
);

export const PeriodeSchema = z.string().regex(
  /^\d{4}-\d{2}$/,
  "Format de période invalide (attendu: YYYY-MM)"
);

export const MontantSchema = z.number()
  .min(0, "Le montant doit être positif")
  .transform(v => Math.round(v * 100) / 100); // Arrondi 2 décimales

export const MontantNonNulSchema = z.number()
  .positive("Le montant doit être strictement positif")
  .transform(v => Math.round(v * 100) / 100);

// ============================================================================
// ÉCRITURES COMPTABLES
// ============================================================================

export const CreateAccountingEntrySchema = z.object({
  journal_code: JournalCodeSchema,
  compte_num: z.string()
    .min(4, "Numéro de compte trop court")
    .max(10, "Numéro de compte trop long")
    .regex(/^\d+$/, "Le numéro de compte ne doit contenir que des chiffres"),
  compte_lib: z.string().min(1).max(255),
  piece_ref: z.string().min(1, "Référence pièce requise").max(50),
  ecriture_lib: z.string().min(1, "Libellé requis").max(255),
  debit: MontantSchema.default(0),
  credit: MontantSchema.default(0),
  ecriture_date: DateFrSchema.optional(),
  compte_aux_num: z.string().max(20).optional().nullable(),
  compte_aux_lib: z.string().max(255).optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  invoice_id: z.string().uuid().optional().nullable(),
  payment_id: z.string().uuid().optional().nullable(),
}).refine(
  data => data.debit > 0 || data.credit > 0,
  { message: "Une écriture doit avoir un débit ou un crédit non nul" }
).refine(
  data => !(data.debit > 0 && data.credit > 0),
  { message: "Une écriture ne peut pas avoir à la fois un débit et un crédit" }
);

export const UpdateAccountingEntrySchema = z.object({
  ecriture_lib: z.string().min(1).max(255).optional(),
  compte_aux_num: z.string().max(20).optional().nullable(),
  compte_aux_lib: z.string().max(255).optional().nullable(),
  ecriture_let: z.string().max(10).optional().nullable(),
  date_let: DateFrSchema.optional().nullable(),
});

export const ValidateEntriesSchema = z.object({
  entry_ids: z.array(z.string().uuid()).min(1, "Au moins une écriture requise"),
  validation_date: DateFrSchema.optional(),
});

export const ReverseEntrySchema = z.object({
  motif: z.string().min(1, "Le motif est requis").max(255),
  date: DateFrSchema.optional(),
});

// ============================================================================
// COMPTE RENDU DE GESTION (CRG)
// ============================================================================

export const CRGRequestSchema = z.object({
  owner_id: z.string().uuid("ID propriétaire invalide"),
  property_id: z.string().uuid().optional(),
  start_date: DateFrSchema,
  end_date: DateFrSchema,
  format: z.enum(["json", "pdf"]).default("json"),
}).refine(
  data => new Date(data.start_date) <= new Date(data.end_date),
  { message: "La date de début doit être antérieure à la date de fin" }
);

// ============================================================================
// BALANCE DES MANDANTS
// ============================================================================

export const BalanceRequestSchema = z.object({
  date: DateFrSchema.optional(),
  account_type: z.enum(["proprietaire", "locataire", "all"]).default("all"),
  include_zero: z.boolean().default(false),
  format: z.enum(["json", "pdf"]).default("json"),
});

// ============================================================================
// RÉCAPITULATIF FISCAL
// ============================================================================

export const FiscalRequestSchema = z.object({
  owner_id: z.string().uuid("ID propriétaire invalide"),
  year: z.number()
    .int()
    .min(2020, "Année minimum: 2020")
    .max(new Date().getFullYear(), "Année future non autorisée"),
  include_n_minus_1: z.boolean().default(true),
  format: z.enum(["json", "pdf"]).default("json"),
});

// ============================================================================
// SITUATION LOCATAIRE
// ============================================================================

export const TenantSituationRequestSchema = z.object({
  tenant_id: z.string().uuid("ID locataire invalide"),
  lease_id: z.string().uuid().optional(),
  as_of_date: DateFrSchema.optional(),
  format: z.enum(["json", "pdf"]).default("json"),
});

// ============================================================================
// RÉGULARISATION DES CHARGES
// ============================================================================

export const ChargeReelleSchema = z.object({
  type: z.string().min(1),
  libelle: z.string().min(1).max(255),
  montant_total: MontantNonNulSchema,
  quote_part: z.number().min(0).max(100).default(100),
  prorata: z.number().min(0).max(1).optional(),
});

export const CreateRegularisationSchema = z.object({
  lease_id: z.string().uuid("ID bail invalide"),
  annee: z.number()
    .int()
    .min(2020)
    .max(new Date().getFullYear()),
  charges_reelles: z.array(ChargeReelleSchema).optional(),
  notes: z.string().max(1000).optional(),
});

export const ApplyRegularisationSchema = z.object({
  action: z.enum(["invoice", "credit_note", "offset"]).default("invoice"),
  date_effet: DateFrSchema.optional(),
  notes: z.string().max(500).optional(),
});

// ============================================================================
// DÉPÔTS DE GARANTIE
// ============================================================================

export const DepositRetenueSchema = z.object({
  type: z.enum(["degradation", "loyer_impaye", "charges_impayees", "nettoyage", "autre"]),
  libelle: z.string().min(1).max(255),
  montant: MontantNonNulSchema,
});

export const CreateDepositOperationSchema = z.object({
  lease_id: z.string().uuid("ID bail invalide"),
  operation_type: z.enum(["reception", "restitution", "retenue", "complement"]),
  montant: MontantNonNulSchema,
  date_operation: DateFrSchema,
  motif_retenue: z.string().max(500).optional(),
  detail_retenues: z.array(DepositRetenueSchema).optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  data => {
    if (data.operation_type === "retenue" && !data.motif_retenue && !data.detail_retenues?.length) {
      return false;
    }
    return true;
  },
  { message: "Une retenue doit avoir un motif ou un détail des retenues" }
);

export const RefundDepositSchema = z.object({
  montant_restitue: MontantNonNulSchema,
  retenues: z.array(DepositRetenueSchema).optional(),
  date_restitution: DateFrSchema.optional(),
  mode_paiement: z.enum(["virement", "cheque"]).default("virement"),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// RAPPROCHEMENT BANCAIRE
// ============================================================================

export const BankTransactionSchema = z.object({
  date: DateFrSchema,
  libelle: z.string().min(1).max(255),
  montant: z.number().refine(v => v !== 0, "Le montant ne peut pas être nul"),
  reference: z.string().max(50).optional(),
});

export const CreateReconciliationSchema = z.object({
  periode: PeriodeSchema,
  compte_type: z.enum(["agence", "mandant"]),
  solde_banque: z.number(),
  solde_comptable: z.number(),
  notes: z.string().max(1000).optional(),
});

export const ImportBankTransactionsSchema = z.object({
  transactions: z.array(BankTransactionSchema).min(1, "Au moins une transaction requise"),
});

export const MatchTransactionSchema = z.object({
  transaction_index: z.number().int().min(0),
  entry_ids: z.array(z.string().uuid()).min(1),
  confidence: z.number().min(0).max(100).optional(),
});

export const FinalizeReconciliationSchema = z.object({
  force: z.boolean().default(false), // Force même si non équilibré
  notes: z.string().max(500).optional(),
});

// ============================================================================
// EXPORT FEC
// ============================================================================

export const FECExportSchema = z.object({
  start_date: DateFrSchema,
  end_date: DateFrSchema,
  journal_codes: z.array(JournalCodeSchema).optional(),
  validated_only: z.boolean().default(true),
  format: z.enum(["txt", "csv"]).default("txt"),
}).refine(
  data => new Date(data.start_date) <= new Date(data.end_date),
  { message: "La date de début doit être antérieure à la date de fin" }
);

// ============================================================================
// GRAND LIVRE
// ============================================================================

export const GrandLivreRequestSchema = z.object({
  owner_id: z.string().uuid("ID propriétaire invalide"),
  property_id: z.string().uuid().optional(),
  start_date: DateFrSchema,
  end_date: DateFrSchema,
  compte_num: z.string().optional(),
  format: z.enum(["json", "pdf"]).default("json"),
});

// ============================================================================
// TYPES EXPORTÉS
// ============================================================================

export type CreateAccountingEntry = z.infer<typeof CreateAccountingEntrySchema>;
export type UpdateAccountingEntry = z.infer<typeof UpdateAccountingEntrySchema>;
export type ValidateEntries = z.infer<typeof ValidateEntriesSchema>;
export type ReverseEntry = z.infer<typeof ReverseEntrySchema>;
export type CRGRequest = z.infer<typeof CRGRequestSchema>;
export type BalanceRequest = z.infer<typeof BalanceRequestSchema>;
export type FiscalRequest = z.infer<typeof FiscalRequestSchema>;
export type TenantSituationRequest = z.infer<typeof TenantSituationRequestSchema>;
export type CreateRegularisation = z.infer<typeof CreateRegularisationSchema>;
export type ApplyRegularisation = z.infer<typeof ApplyRegularisationSchema>;
export type CreateDepositOperation = z.infer<typeof CreateDepositOperationSchema>;
export type RefundDeposit = z.infer<typeof RefundDepositSchema>;
export type CreateReconciliation = z.infer<typeof CreateReconciliationSchema>;
export type MatchTransaction = z.infer<typeof MatchTransactionSchema>;
export type FECExport = z.infer<typeof FECExportSchema>;
export type GrandLivreRequest = z.infer<typeof GrandLivreRequestSchema>;
