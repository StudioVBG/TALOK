/**
 * Module OCR
 * 
 * Fournit des services d'extraction de données depuis des documents:
 * - Bulletins de salaire (revenus, employeur)
 * - Pièces d'identité (nom, prénom, date de naissance)
 * - Avis d'imposition (revenus fiscaux)
 * - Relevés bancaires (IBAN, solde)
 * 
 * Provider: Mindee (spécialisé France)
 * Alternative: Google Document AI, AWS Textract
 */

export * from './mindee.service';

// Types
export type {
  PayslipData,
  IdCardData,
  TaxNoticeData,
  BankStatementData,
  ExtractedField,
} from './mindee.service';

