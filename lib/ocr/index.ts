/**
 * Module OCR
 * 
 * Fournit des services d'extraction de données depuis des documents:
 * - Bulletins de salaire (revenus, employeur)
 * - Pièces d'identité (nom, prénom, date de naissance)
 * - Avis d'imposition (revenus fiscaux)
 * - Relevés bancaires (IBAN, solde)
 * - Compteurs d'énergie (électricité, gaz, eau)
 * 
 * Providers disponibles:
 * - Tesseract.js (gratuit, open source, local) ← Par défaut
 * - Mindee (payant, haute précision, cloud)
 */

// Service OCR gratuit avec Tesseract.js (recommandé)
export * from './tesseract.service';

// Service OCR payant avec Mindee (pour haute précision)
export * from './mindee.service';

// Service OCR spécialisé pour les compteurs
export { meterOCRService, MeterOCRService } from './meter.service';
export type { MeterOCRResult, MeterType as MeterOCRType } from './meter.service';

// Types Tesseract (gratuit)
export type {
  InternalIdCardData,
} from './tesseract.service';

// Types Mindee (payant)
export type {
  PayslipData,
  IdCardData,
  TaxNoticeData,
  BankStatementData,
  ExtractedField,
} from './mindee.service';

