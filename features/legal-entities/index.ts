/**
 * Module Legal Entities - Gestion multi-SCI/Sociétés
 * SOTA 2026
 *
 * Ce module permet à un propriétaire de gérer plusieurs structures juridiques
 * (SCI, SARL, SAS, etc.) et d'affecter ses biens à différentes entités.
 *
 * Fonctionnalités:
 * - Création et gestion d'entités juridiques multiples
 * - Gestion des associés par entité
 * - Affectation des biens aux entités
 * - Support de l'indivision et du démembrement
 * - Transfert de biens entre entités
 * - Statistiques consolidées et par entité
 */

// Service principal
export { default as legalEntitiesService } from "./services/legal-entities.service";

// Fonctions exportées du service
export {
  // Legal Entities
  getLegalEntities,
  getLegalEntityById,
  getLegalEntitiesWithStats,
  createLegalEntity,
  updateLegalEntity,
  deactivateLegalEntity,
  deleteLegalEntity,

  // Associates
  getEntityAssociates,
  createEntityAssociate,
  updateEntityAssociate,
  removeEntityAssociate,

  // Property Ownership
  getPropertyOwnership,
  getPropertiesByEntity,
  createPropertyOwnership,
  transferPropertyOwnership,

  // Utilities
  canDeleteEntity,
  getEntityFiscalSummary,
  searchEntitiesBySiren,
  checkSiretExists,
} from "./services/legal-entities.service";

// Types réexportés pour faciliter les imports
export type {
  LegalEntityType,
  FiscalRegime,
  TvaRegime,
  GeranceType,
  LegalEntity,
  ApportType,
  DetentionPartsType,
  Civilite,
  EntityAssociate,
  PropertyDetentionType,
  AcquisitionMode,
  CessionMode,
  PropertyOwnership,
  PropertyDetentionMode,
  CreateLegalEntityDTO,
  UpdateLegalEntityDTO,
  CreateEntityAssociateDTO,
  CreatePropertyOwnershipDTO,
  LegalEntityWithStats,
  LegalEntityWithAssociates,
  EntityAssociateWithProfile,
  PropertyOwnershipWithDetails,
} from "@/lib/types/legal-entity";

export {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
  DETENTION_TYPE_LABELS,
  ACQUISITION_MODE_LABELS,
  APPORT_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_GROUPS,
  ENTITIES_REQUIRING_SIRET,
  ENTITIES_MIN_2_ASSOCIATES,
  ENTITIES_IR_OPTION,
  ENTITIES_IS_MANDATORY,
} from "@/lib/types/legal-entity";
