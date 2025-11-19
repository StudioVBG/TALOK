/**
 * Chargeur de configuration du wizard Property
 * 
 * Charge la configuration JSON et la transforme en structure TypeScript typée
 */

import wizardConfig from "@/config/property-wizard-config.json";
import type { PropertyTypeV3 } from "@/lib/types/property-v3";

export type PropertyType = PropertyTypeV3;

export type PropertyGroup = "habitation" | "parking_box" | "local_commercial";

export interface PropertyTypeConfig {
  id: PropertyType;
  group: PropertyGroup;
  label: string;
}

export interface FieldConfig {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  options?: { value: any; label: string }[];
  visibleWhen?: {
    field?: string;
    equals?: any;
    notEquals?: any;
    type_bien_in?: PropertyType[];
  };
  optionsFrom?: string;
}

export interface SectionConfig {
  id: string;
  visibleForTypes?: PropertyType[];
  fields: FieldConfig[];
  validation?: {
    requiredFields?: string[];
    conditional?: Array<{
      if: { field: string; notEquals?: any; equals?: any };
      thenRequired: string[];
    }>;
  };
}

export interface StepConfig {
  id: string;
  title: string;
  description?: string;
  fields?: FieldConfig[];
  sections?: SectionConfig[];
  groups?: Array<{
    id: string;
    label: string;
    subtitle?: string;
    types: PropertyType[];
  }>;
  mode?: "custom" | "simple-photos" | "summary";
  visibleForTypes?: PropertyType[];
  validation?: {
    requiredFields?: string[];
    backendSubmitEndpoint?: string;
  };
}

export interface WizardConfig {
  propertyTypes: PropertyTypeConfig[];
  steps: StepConfig[];
}

// Charger la configuration
export const wizardConfigData: WizardConfig = wizardConfig as WizardConfig;

/**
 * Récupère les étapes visibles pour un type de bien donné
 */
export function getStepsForType(typeBien?: PropertyType): StepConfig[] {
  if (!typeBien) {
    // Retourner uniquement l'étape de sélection du type
    return wizardConfigData.steps.filter((step) => step.id === "type_bien");
  }

  return wizardConfigData.steps.filter((step) => {
    // Toujours inclure l'étape de sélection du type et le récapitulatif
    if (step.id === "type_bien" || step.id === "recap") {
      return true;
    }

    // Vérifier si l'étape est visible pour ce type
    if (step.visibleForTypes) {
      return step.visibleForTypes.includes(typeBien);
    }

    // Vérifier les sections visibles
    if (step.sections) {
      const hasVisibleSection = step.sections.some(
        (section) =>
          !section.visibleForTypes || section.visibleForTypes.includes(typeBien)
      );
      return hasVisibleSection;
    }

    // Par défaut, inclure l'étape
    return true;
  });
}

/**
 * Récupère les champs visibles pour une étape et un type de bien donnés
 */
export function getFieldsForStep(
  step: StepConfig,
  typeBien?: PropertyType
): FieldConfig[] {
  if (step.fields) {
    return step.fields.filter((field) => {
      if (!field.visibleWhen) return true;
      if (field.visibleWhen.type_bien_in) {
        return typeBien && field.visibleWhen.type_bien_in.includes(typeBien);
      }
      return true;
    });
  }

  if (step.sections) {
    const visibleSections = step.sections.filter(
      (section) =>
        !section.visibleForTypes || (typeBien && section.visibleForTypes.includes(typeBien))
    );

    return visibleSections.flatMap((section) => section.fields);
  }

  return [];
}

/**
 * Récupère un type de bien par son ID
 */
export function getPropertyTypeById(id: string): PropertyTypeConfig | undefined {
  return wizardConfigData.propertyTypes.find((pt) => pt.id === id);
}

/**
 * Récupère tous les types de biens d'un groupe
 */
export function getPropertyTypesByGroup(group: PropertyGroup): PropertyTypeConfig[] {
  return wizardConfigData.propertyTypes.filter((pt) => pt.group === group);
}

