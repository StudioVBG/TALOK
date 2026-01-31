/**
 * Module EDL (État des Lieux)
 * Export centralisé des types, templates et services
 */

// Types
export * from "./types";

// Templates - Résidentiel
export { EDL_TEMPLATE, EDL_TEMPLATE_VIERGE } from "./edl.template";

// Templates - Commercial/Professionnel (GAP-007)
export { EDL_COMMERCIAL_TEMPLATE, EDL_COMMERCIAL_VARIABLES } from "./edl-commercial.template";

// Services
export {
  generateEDLHTML,
  generateEDLViergeHTML,
  mapEDLToTemplateVariables,
  validateEDLForGeneration,
} from "./template.service";
















