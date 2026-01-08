/**
 * Module EDL (État des Lieux)
 * Export centralisé des types, templates et services
 */

// Types
export * from "./types";

// Templates
export { EDL_TEMPLATE, EDL_TEMPLATE_VIERGE } from "./edl.template";

// Services
export {
  generateEDLHTML,
  generateEDLViergeHTML,
  mapEDLToTemplateVariables,
  validateEDLForGeneration,
} from "./template.service";










