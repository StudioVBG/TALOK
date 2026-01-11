/**
 * Schémas de validation Zod pour la vérification d'avis d'imposition
 *
 * Valide les formats officiels de la DGFiP :
 * - Numéro fiscal : 13 chiffres
 * - Référence d'avis : 13 caractères alphanumériques
 */

import { z } from "zod";

// ============================================================================
// EXPRESSIONS RÉGULIÈRES
// ============================================================================

/**
 * Numéro fiscal : exactement 13 chiffres
 * Format officiel DGFiP
 */
const NUMERO_FISCAL_REGEX = /^[0-9]{13}$/;

/**
 * Référence d'avis : 13 caractères alphanumériques (lettres majuscules et chiffres)
 * Format : généralement commence par l'année (ex: 24XXXXXXXXXX pour 2024)
 */
const REFERENCE_AVIS_REGEX = /^[A-Z0-9]{13}$/;

// ============================================================================
// MESSAGES D'ERREUR
// ============================================================================

const ERROR_MESSAGES = {
  numeroFiscal: {
    required: "Le numéro fiscal est requis",
    format: "Le numéro fiscal doit contenir exactement 13 chiffres",
    invalid: "Format de numéro fiscal invalide",
  },
  referenceAvis: {
    required: "La référence de l'avis est requise",
    format: "La référence doit contenir exactement 13 caractères alphanumériques",
    invalid: "Format de référence d'avis invalide",
  },
  general: {
    invalidData: "Les données fournies sont invalides",
  },
} as const;

// ============================================================================
// SCHÉMAS DE BASE
// ============================================================================

/**
 * Schéma pour le numéro fiscal
 */
export const numeroFiscalSchema = z
  .string({
    required_error: ERROR_MESSAGES.numeroFiscal.required,
    invalid_type_error: ERROR_MESSAGES.numeroFiscal.invalid,
  })
  .trim()
  .length(13, ERROR_MESSAGES.numeroFiscal.format)
  .regex(NUMERO_FISCAL_REGEX, ERROR_MESSAGES.numeroFiscal.format);

/**
 * Schéma pour la référence d'avis
 * Accepte les minuscules et les convertit en majuscules
 */
export const referenceAvisSchema = z
  .string({
    required_error: ERROR_MESSAGES.referenceAvis.required,
    invalid_type_error: ERROR_MESSAGES.referenceAvis.invalid,
  })
  .trim()
  .toUpperCase()
  .length(13, ERROR_MESSAGES.referenceAvis.format)
  .regex(REFERENCE_AVIS_REGEX, ERROR_MESSAGES.referenceAvis.format);

// ============================================================================
// SCHÉMA DE REQUÊTE DE VÉRIFICATION
// ============================================================================

/**
 * Schéma pour une requête de vérification d'avis d'imposition
 */
export const taxNoticeVerificationRequestSchema = z.object({
  numeroFiscal: numeroFiscalSchema,
  referenceAvis: referenceAvisSchema,
});

/**
 * Type inféré du schéma de requête
 */
export type TaxNoticeVerificationRequestInput = z.input<
  typeof taxNoticeVerificationRequestSchema
>;

/**
 * Type inféré du schéma de requête (après transformation)
 */
export type TaxNoticeVerificationRequestOutput = z.output<
  typeof taxNoticeVerificationRequestSchema
>;

// ============================================================================
// SCHÉMA DE CONFIGURATION
// ============================================================================

/**
 * Schéma pour la configuration du service de vérification
 */
const taxVerificationConfigBaseSchema = z.object({
  mode: z.enum(["web_scraping", "api_particulier", "2d_doc"]).default("api_particulier"),
  apiToken: z.string().optional(),
  timeout: z.number().min(1000).max(60000).default(10000),
  environment: z.enum(["test", "production"]).default("production"),
});

type TaxVerificationConfigBase = z.infer<typeof taxVerificationConfigBaseSchema>;

export const taxVerificationConfigSchema = taxVerificationConfigBaseSchema.refine(
  (data: TaxVerificationConfigBase) => {
    // Si mode api_particulier, le token est requis en production
    if (data.mode === "api_particulier" && data.environment === "production") {
      return !!data.apiToken;
    }
    return true;
  },
  {
    message: "Le token API est requis pour l'API Particulier en production",
    path: ["apiToken"],
  }
);

// ============================================================================
// SCHÉMA DE RÉPONSE API PARTICULIER
// ============================================================================

/**
 * Schéma pour un déclarant
 */
export const taxDeclarantSchema = z.object({
  nom: z.string(),
  nomNaissance: z.string(),
  prenoms: z.string(),
  dateNaissance: z.string(),
});

/**
 * Schéma pour le foyer fiscal
 */
export const taxFoyerFiscalSchema = z.object({
  annee: z.number(),
  adresse: z.string(),
});

/**
 * Schéma pour la réponse complète de l'API Particulier
 */
export const taxNoticeApiResponseSchema = z.object({
  declarant1: taxDeclarantSchema,
  declarant2: taxDeclarantSchema.optional(),
  foyerFiscal: taxFoyerFiscalSchema,
  dateRecouvrement: z.string(),
  dateEtablissement: z.string(),
  nombreParts: z.number(),
  situationFamille: z.string(),
  nombrePersonnesCharge: z.number(),
  revenuBrutGlobal: z.number(),
  revenuImposable: z.number(),
  montantImpot: z.number().nullable(),
  revenuFiscalReference: z.number(),
  anneeImpots: z.string(),
  anneeRevenus: z.string(),
});

// ============================================================================
// HELPERS DE VALIDATION
// ============================================================================

/**
 * Valide un numéro fiscal et retourne le résultat
 */
export function validateNumeroFiscal(value: string): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  const result = numeroFiscalSchema.safeParse(value);
  if (result.success) {
    return { valid: true, value: result.data };
  }
  return {
    valid: false,
    error: result.error.errors[0]?.message || ERROR_MESSAGES.numeroFiscal.invalid,
  };
}

/**
 * Valide une référence d'avis et retourne le résultat
 */
export function validateReferenceAvis(value: string): {
  valid: boolean;
  value?: string;
  error?: string;
} {
  const result = referenceAvisSchema.safeParse(value);
  if (result.success) {
    return { valid: true, value: result.data };
  }
  return {
    valid: false,
    error: result.error.errors[0]?.message || ERROR_MESSAGES.referenceAvis.invalid,
  };
}

/**
 * Valide une requête complète de vérification
 */
export function validateTaxVerificationRequest(data: unknown): {
  valid: boolean;
  data?: TaxNoticeVerificationRequestOutput;
  errors?: Record<string, string>;
} {
  const result = taxNoticeVerificationRequestSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const error of result.error.errors) {
    const path = error.path.join(".");
    errors[path] = error.message;
  }
  return { valid: false, errors };
}

// ============================================================================
// UTILITAIRES DE FORMATAGE
// ============================================================================

/**
 * Formate un numéro fiscal pour l'affichage (avec espaces)
 * Ex: "1234567890123" -> "123 456 789 0123"
 */
export function formatNumeroFiscalDisplay(numeroFiscal: string): string {
  const cleaned = numeroFiscal.replace(/\s/g, "");
  if (cleaned.length !== 13) return numeroFiscal;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
}

/**
 * Masque un numéro fiscal pour la confidentialité
 * Ex: "1234567890123" -> "123 *** *** 0123"
 */
export function maskNumeroFiscal(numeroFiscal: string): string {
  const cleaned = numeroFiscal.replace(/\s/g, "");
  if (cleaned.length !== 13) return "*** *** *** ****";
  return `${cleaned.slice(0, 3)} *** *** ${cleaned.slice(9)}`;
}

/**
 * Masque une référence d'avis pour la confidentialité
 * Ex: "24ABCDEFGHIJK" -> "24A********JK"
 */
export function maskReferenceAvis(referenceAvis: string): string {
  const cleaned = referenceAvis.replace(/\s/g, "").toUpperCase();
  if (cleaned.length !== 13) return "*************";
  return `${cleaned.slice(0, 3)}********${cleaned.slice(11)}`;
}

/**
 * Nettoie un numéro fiscal (supprime espaces et tirets)
 */
export function cleanNumeroFiscal(value: string): string {
  return value.replace(/[\s\-\.]/g, "");
}

/**
 * Nettoie une référence d'avis (supprime espaces, tirets et met en majuscules)
 */
export function cleanReferenceAvis(value: string): string {
  return value.replace(/[\s\-\.]/g, "").toUpperCase();
}
