/**
 * Barrel export des mappers de l'application.
 *
 * Chaque mapper transforme une structure de données source vers un format
 * cible utilisé par les composants de prévisualisation ou les templates.
 */

// EDL brut (BDD) → EDLComplet (template)
export {
  mapRawEDLToTemplate,
  ownerIdentityToRawProfile,
  generateEDLReference,
} from "./edl-to-template";

// Lease (BDD) → BailComplet (template)
export { mapLeaseToTemplate } from "./lease-to-template";

// Wizard bail → Partial<EDLComplet> (aperçu EDL dans le wizard)
export {
  mapBailWizardToEdlPreview,
  generateDefaultRooms,
  generateDefaultMeters,
  type BailWizardEdlInput,
} from "./bail-wizard-to-edl-preview";
