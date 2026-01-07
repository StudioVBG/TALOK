/**
 * Schémas de validation Zod pour les relevés de compteurs EDL
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const meterTypeSchema = z.enum(['electricity', 'gas', 'water']);
export const meterUnitSchema = z.enum(['kWh', 'm³', 'L']);
export const ocrProviderSchema = z.enum(['tesseract', 'google_vision', 'mindee']);
export const recorderRoleSchema = z.enum(['owner', 'tenant']);

// ============================================
// SCHEMAS DE BASE
// ============================================

/**
 * Schéma pour créer un relevé de compteur
 */
export const createEDLMeterReadingSchema = z.object({
  edl_id: z.string().uuid('ID EDL invalide'),
  meter_id: z.string().optional(), // Rendu optionnel pour supporter les IDs temporaires
  manual_value: z
    .number()
    .min(0, 'La valeur doit être positive')
    .max(9999999, 'La valeur est trop grande')
    .optional(),
  reading_unit: z.string().optional(),
  meter_number: z.string().optional(),
  location: z.string().optional(),
  comment: z.string().max(500, 'Commentaire trop long').optional(),
});

/**
 * Schéma pour valider manuellement un relevé
 */
export const validateEDLMeterReadingSchema = z.object({
  corrected_value: z
    .number()
    .min(0, 'La valeur doit être positive')
    .max(9999999, 'La valeur est trop grande')
    .optional()
    .nullable(),
  comment: z.string().max(500, 'Commentaire trop long').optional(),
  meter_number: z.string().optional(),
  location: z.string().optional(),
});

/**
 * Schéma pour la réponse OCR
 */
export const ocrResultSchema = z.object({
  detected_value: z.number().nullable(),
  confidence: z.number().min(0).max(100),
  needs_validation: z.boolean(),
  raw_text: z.string(),
  processing_time_ms: z.number(),
});

/**
 * Schéma pour un relevé de compteur complet
 */
export const edlMeterReadingSchema = z.object({
  id: z.string().uuid(),
  edl_id: z.string().uuid(),
  meter_id: z.string().uuid(),
  reading_value: z.number(),
  reading_unit: meterUnitSchema,
  photo_path: z.string(),
  photo_taken_at: z.string().datetime(),
  ocr_value: z.number().nullable(),
  ocr_confidence: z.number().min(0).max(100).nullable(),
  ocr_provider: ocrProviderSchema.nullable(),
  ocr_raw_text: z.string().nullable(),
  is_validated: z.boolean(),
  validated_by: z.string().uuid().nullable(),
  validated_at: z.string().datetime().nullable(),
  validation_comment: z.string().nullable(),
  recorded_by: z.string().uuid(),
  recorded_by_role: recorderRoleSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Schéma pour les infos d'un compteur
 */
export const meterInfoSchema = z.object({
  id: z.string().uuid(),
  property_id: z.string().uuid(),
  type: meterTypeSchema,
  meter_number: z.string().nullable(),
  location: z.string().nullable(),
  provider: z.string().nullable(),
  unit: meterUnitSchema,
  is_active: z.boolean(),
});

/**
 * Schéma pour la comparaison de consommation
 */
export const meterConsumptionSchema = z.object({
  meter_id: z.string().uuid(),
  meter_type: meterTypeSchema,
  meter_number: z.string().nullable(),
  entry_value: z.number().nullable(),
  entry_date: z.string().nullable(),
  exit_value: z.number().nullable(),
  exit_date: z.string().nullable(),
  consumption: z.number().nullable(),
  unit: meterUnitSchema,
});

// ============================================
// TYPES INFÉRÉS
// ============================================

export type CreateEDLMeterReadingInput = z.infer<typeof createEDLMeterReadingSchema>;
export type ValidateEDLMeterReadingInput = z.infer<typeof validateEDLMeterReadingSchema>;
export type OCRResultInput = z.infer<typeof ocrResultSchema>;
export type EDLMeterReadingInput = z.infer<typeof edlMeterReadingSchema>;
export type MeterInfoInput = z.infer<typeof meterInfoSchema>;
export type MeterConsumptionInput = z.infer<typeof meterConsumptionSchema>;

// ============================================
// VALIDATEURS UTILITAIRES
// ============================================

/**
 * Valide qu'une valeur de compteur est cohérente
 * (non-décroissante par rapport à la lecture précédente)
 */
export function validateMeterValueProgression(
  previousValue: number | null,
  newValue: number
): { valid: boolean; message?: string } {
  if (previousValue === null) {
    return { valid: true };
  }
  
  if (newValue < previousValue) {
    return {
      valid: false,
      message: `La nouvelle valeur (${newValue}) ne peut pas être inférieure à la précédente (${previousValue})`,
    };
  }
  
  // Vérifier qu'il n'y a pas une augmentation suspicieuse (>50% en un seul relevé)
  const increase = newValue - previousValue;
  const percentIncrease = (increase / previousValue) * 100;
  
  if (percentIncrease > 50) {
    return {
      valid: true,
      message: `Attention: augmentation importante de ${percentIncrease.toFixed(1)}% détectée. Veuillez vérifier.`,
    };
  }
  
  return { valid: true };
}

/**
 * Valide le format d'une photo de compteur
 */
export function validateMeterPhotoFile(file: File): { valid: boolean; message?: string } {
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
  
  if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      message: 'Format de fichier non supporté. Utilisez JPEG, PNG ou WebP.',
    };
  }
  
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      message: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB.`,
    };
  }
  
  return { valid: true };
}

