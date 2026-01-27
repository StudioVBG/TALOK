/**
 * Module Fin de Bail + Rénovation
 * Composants UI - Export central
 */

// === Composants existants ===
export { LeaseEndAlert } from "./lease-end-alert";
export { LeaseEndChecklist } from "./lease-end-checklist";
export { EDLSortieInspection } from "./edl-sortie-inspection";
export { DamageAssessmentResults } from "./damage-assessment-results";
export { BudgetTimeline } from "./budget-timeline";
export { QuoteRequestForm } from "./quote-request-form";
export { ReadyToRentCard } from "./ready-to-rent-card";
export { LeaseEndProcessCard } from "./lease-end-process-card";
export { LeaseEndWizard } from "./lease-end-wizard";

// === Système de capture photos EDL (SOTA 2025) ===
export { RoomPlanSelector } from "./room-plan-selector";
export type { RoomForPlan } from "./room-plan-selector";

export { SmartPhotoCapture } from "./smart-photo-capture";
export type { RoomOption, CapturedPhoto } from "./smart-photo-capture";

export { PhotoOrganizer } from "./photo-organizer";
export type { PhotoItem, RoomForOrganizer } from "./photo-organizer";

export { EDLPhotoComparison } from "./edl-photo-comparison";
export type { ComparisonPhoto } from "./edl-photo-comparison";

export { EDLConductor } from "./edl-conductor";
export type { EDLData, EDLRoom, EDLPhoto } from "./edl-conductor";

// === Relevés de compteurs EDL (Décret 2016-382) ===
export { EDLMeterReadings } from "./edl-meter-readings";

// === Inventaire mobilier (Décret 2015-981) ===
export { FurnitureInventory, MANDATORY_ITEMS_CONFIG } from "./furniture-inventory";
export type {
  FurnitureInventoryData,
  MandatoryFurnitureItem,
  AdditionalFurnitureItem,
  FurnitureCondition,
  MandatoryFurnitureChecklist,
} from "./furniture-inventory";

// === Grille de vétusté (Décret 30 mars 2016) ===
export { WearGrid, WEAR_CATEGORIES, calculateWearPercentage, calculateTenantResponsibility, calculateAmountDue } from "./wear-grid";
export type { WearItem, WearGridData, WearCategory, DamageType } from "./wear-grid";

// === Diagnostics DOM-TOM (Arrêtés préfectoraux) ===
export { DomtomDiagnostics } from "./domtom-diagnostics";
export type { TermitesDiagnostic, RisquesNaturelsDomtom, DomtomDiagnosticsData } from "./domtom-diagnostics";

