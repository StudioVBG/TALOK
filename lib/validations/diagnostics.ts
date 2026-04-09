import { z } from "zod";

export const DIAGNOSTIC_TYPES = [
  "dpe",
  "amiante",
  "plomb",
  "gaz",
  "electricite",
  "termites",
  "erp",
  "surface_boutin",
  "bruit",
] as const;

export type DiagnosticType = (typeof DIAGNOSTIC_TYPES)[number];

export const diagnosticTypeEnum = z.enum(DIAGNOSTIC_TYPES);

export const DIAGNOSTIC_LABELS: Record<DiagnosticType, string> = {
  dpe: "DPE (Diagnostic de Performance Énergétique)",
  amiante: "Amiante",
  plomb: "Plomb (CREP)",
  gaz: "Gaz",
  electricite: "Électricité",
  termites: "Termites",
  erp: "État des Risques (ERP)",
  surface_boutin: "Surface habitable (Loi Boutin)",
  bruit: "Bruit (Plan d'exposition au bruit)",
};

export const DIAGNOSTIC_SHORT_LABELS: Record<DiagnosticType, string> = {
  dpe: "DPE",
  amiante: "Amiante",
  plomb: "Plomb",
  gaz: "Gaz",
  electricite: "Électricité",
  termites: "Termites",
  erp: "ERP",
  surface_boutin: "Surface Boutin",
  bruit: "Bruit",
};

/** Validity durations in months (null = unlimited) */
export const DIAGNOSTIC_VALIDITY: Record<DiagnosticType, number | null> = {
  dpe: 120, // 10 years
  amiante: null, // unlimited if negative
  plomb: 12, // 1 year if positive, unlimited if negative
  gaz: 72, // 6 years
  electricite: 72, // 6 years
  termites: 6, // 6 months
  erp: 6, // 6 months
  surface_boutin: null, // unlimited
  bruit: null, // unlimited
};

export const diagnosticCreateSchema = z.object({
  property_id: z.string().uuid(),
  diagnostic_type: diagnosticTypeEnum,
  performed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  result: z.string().max(20).nullable().optional(),
  diagnostiqueur_name: z.string().max(200).nullable().optional(),
  diagnostiqueur_certification: z.string().max(200).nullable().optional(),
  document_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const diagnosticUpdateSchema = diagnosticCreateSchema.partial().omit({
  property_id: true,
  diagnostic_type: true,
});

export const checkRequiredSchema = z.object({
  property_id: z.string().uuid(),
  annee_construction: z.number().nullable().optional(),
  code_postal: z.string().nullable().optional(),
});

export const rentControlCheckSchema = z.object({
  city: z.string().min(1),
  type_logement: z.string().min(1),
  nb_pieces: z.number().int().min(1).max(10),
  surface: z.number().positive(),
  loyer: z.number().positive(),
});

export type DiagnosticCreate = z.infer<typeof diagnosticCreateSchema>;
export type DiagnosticUpdate = z.infer<typeof diagnosticUpdateSchema>;
export type CheckRequiredInput = z.infer<typeof checkRequiredSchema>;
export type RentControlCheckInput = z.infer<typeof rentControlCheckSchema>;

export interface PropertyDiagnostic {
  id: string;
  property_id: string;
  diagnostic_type: DiagnosticType;
  performed_date: string;
  expiry_date: string | null;
  result: string | null;
  diagnostiqueur_name: string | null;
  diagnostiqueur_certification: string | null;
  document_id: string | null;
  is_valid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequiredDiagnostic {
  type: DiagnosticType;
  label: string;
  required: boolean;
  reason: string;
  validity_months: number | null;
}

export interface RentControlResult {
  in_zone: boolean;
  city: string | null;
  loyer_reference: number | null;
  loyer_majore: number | null;
  loyer_minore: number | null;
  loyer_m2: number;
  is_over_limit: boolean;
  depassement: number | null;
}

/**
 * Compute the expiry date from a performed date and diagnostic type.
 */
export function computeExpiryDate(
  diagnosticType: DiagnosticType,
  performedDate: string,
  result?: string | null
): string | null {
  // Amiante: unlimited if negative
  if (diagnosticType === "amiante") {
    return result === "positif" ? null : null; // always unlimited once performed
  }

  // Plomb: 1 year if positive, unlimited if negative
  if (diagnosticType === "plomb") {
    if (result === "positif") {
      return addMonths(performedDate, 12);
    }
    return null;
  }

  const months = DIAGNOSTIC_VALIDITY[diagnosticType];
  if (months === null) return null;

  return addMonths(performedDate, months);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

/**
 * Check which diagnostics are required for a given property.
 */
export function getRequiredDiagnostics(
  anneeConstruction?: number | null,
  codePostal?: string | null
): RequiredDiagnostic[] {
  const result: RequiredDiagnostic[] = [];

  // DPE: always required
  result.push({
    type: "dpe",
    label: DIAGNOSTIC_LABELS.dpe,
    required: true,
    reason: "Obligatoire pour toute mise en location",
    validity_months: 120,
  });

  // Amiante: if built before 1997
  const needAmiante = !anneeConstruction || anneeConstruction < 1997;
  result.push({
    type: "amiante",
    label: DIAGNOSTIC_LABELS.amiante,
    required: needAmiante,
    reason: needAmiante
      ? "Obligatoire pour les biens construits avant juillet 1997"
      : "Non requis (construction après 1997)",
    validity_months: null,
  });

  // Plomb: if built before 1949
  const needPlomb = !anneeConstruction || anneeConstruction < 1949;
  result.push({
    type: "plomb",
    label: DIAGNOSTIC_LABELS.plomb,
    required: needPlomb,
    reason: needPlomb
      ? "Obligatoire pour les biens construits avant 1949"
      : "Non requis (construction après 1949)",
    validity_months: 12,
  });

  // Gaz: if installation > 15 years (assume needed if built > 15 years ago or unknown)
  const currentYear = new Date().getFullYear();
  const needGaz = !anneeConstruction || currentYear - anneeConstruction > 15;
  result.push({
    type: "gaz",
    label: DIAGNOSTIC_LABELS.gaz,
    required: needGaz,
    reason: needGaz
      ? "Obligatoire si l'installation a plus de 15 ans"
      : "Non requis (installation récente)",
    validity_months: 72,
  });

  // Electricite: same logic as gaz
  result.push({
    type: "electricite",
    label: DIAGNOSTIC_LABELS.electricite,
    required: needGaz, // same condition
    reason: needGaz
      ? "Obligatoire si l'installation a plus de 15 ans"
      : "Non requis (installation récente)",
    validity_months: 72,
  });

  // Termites: zone based (simplified — always recommend checking)
  result.push({
    type: "termites",
    label: DIAGNOSTIC_LABELS.termites,
    required: false, // would need zone data
    reason: "Obligatoire si le bien est situé dans une zone couverte par un arrêté préfectoral",
    validity_months: 6,
  });

  // ERP: always required since 2023
  result.push({
    type: "erp",
    label: DIAGNOSTIC_LABELS.erp,
    required: true,
    reason: "Obligatoire depuis 2023 pour toute mise en location",
    validity_months: 6,
  });

  // Surface Boutin: always required
  result.push({
    type: "surface_boutin",
    label: DIAGNOSTIC_LABELS.surface_boutin,
    required: true,
    reason: "Obligatoire pour tout bail d'habitation",
    validity_months: null,
  });

  // Bruit: zone based
  result.push({
    type: "bruit",
    label: DIAGNOSTIC_LABELS.bruit,
    required: false,
    reason: "Obligatoire si le bien est situé dans une zone d'exposition au bruit des aéroports",
    validity_months: null,
  });

  return result;
}
