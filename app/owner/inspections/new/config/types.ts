/**
 * Types for Create Inspection Wizard
 * Extracted from CreateInspectionWizard.tsx
 */

export interface Lease {
  id: string;
  type_bail: string;
  statut: string;
  date_debut: string;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  tenant_name: string;
}

export interface RoomTemplate {
  id: string;
  name: string;
  icon: React.ElementType;
  items: string[];
}

export interface RoomData {
  name: string;
  customName?: string;
  items: Array<{
    name: string;
    condition: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais" | null;
    notes: string;
    photos: File[];
  }>;
  globalPhotos: File[];
}

export interface MeterReading {
  type: "electricity" | "gas" | "water" | "water_hot";
  meterNumber: string;
  reading: string;
  unit: string;
  photo?: File;
}

export interface KeyItem {
  type: string;
  count: number;
  notes?: string;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
}

export interface ConditionOption {
  value: string;
  label: string;
  color: string;
}

export interface MeterType {
  type: MeterReading["type"];
  label: string;
  unit: string;
  icon: string;
}
