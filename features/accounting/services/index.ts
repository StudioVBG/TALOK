/**
 * Accounting Services - Barrel Export
 *
 * Main service: accountingService (singleton)
 * Pure calculations: calculations.ts (no external deps)
 * Helpers: helpers.ts (utility functions)
 * FEC Export: fecExportService (specialized service)
 */

// Main accounting service
export { AccountingService, accountingService } from "./accounting.service";

// Pure calculation functions (can be used independently)
export {
  calculateHonoraires,
  calculateReversement,
  calculateProrata,
  calculateTotauxMouvements,
  calculateRecapitulatif,
} from "./calculations";

// Helper functions
export { formatPeriode, getDateReversement, formatMontant, roundMontant } from "./helpers";

// FEC Export service
export { FECExportService, fecExportService } from "./fec-export.service";

// Other specialized services
export { BankReconciliationService } from "./bank-reconciliation.service";
export { ChargeRegularizationService } from "./charge-regularization.service";
export { pdfExportService } from "./pdf-export.service";
export { AccountingIntegrationService } from "./accounting-integration.service";
