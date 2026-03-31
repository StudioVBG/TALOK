/**
 * lib/properties/schemas.ts — Schemas Zod centralisés pour les biens
 *
 * Re-exporte les schemas V3 depuis lib/validations/property-v3.ts
 * et ajoute des helpers pour la validation conditionnelle par type.
 *
 * Les schemas detailles (habitation, parking, local pro, immeuble)
 * restent dans lib/validations/property-v3.ts car ils sont deja
 * complets et bien structures. Ce fichier sert de facade.
 */

import { z } from 'zod';
import { getFieldsForType } from './constants';
import type { PropertyTypeV3 } from '@/lib/types/property-v3';

// ============================================
// 1. RE-EXPORTS — Schemas V3 existants
// ============================================

export {
  // Schemas de creation (discriminatedUnion par type_bien)
  propertySchemaV3,
  propertySchemaV3Base,
  habitationSchemaV3,
  habitationSchemaV3Base,
  parkingSchemaV3,
  localProSchemaV3,
  immeubleSchemaV3,
  immeubleSchemaV3Base,

  // Schemas de mise a jour (partiels)
  propertyUpdateSchemaV3,
  habitationUpdateSchemaV3,
  parkingUpdateSchemaV3,
  localProUpdateSchemaV3,
  immeubleUpdateSchemaV3,

  // Schemas rooms & photos
  roomSchemaV3,
  photoSchemaV3,

  // Types inferes
  type PropertyV3Input,
  type HabitationV3Input,
  type ParkingV3Input,
  type LocalProV3Input,
  type ImmeubleV3Input,
  type BuildingUnitInput,
  type RoomV3Input,
  type PhotoV3Input,
  type PropertyV3UpdateInput,
} from '@/lib/validations/property-v3';

// ============================================
// 2. SCHEMA SIMPLIFIE — Adresse seule
// ============================================

/**
 * Schema pour la validation d'adresse uniquement.
 * Utile pour le formulaire d'adresse isole (step 1 du wizard).
 */
export const addressSchema = z.object({
  adresse_complete: z.string().min(1, "L'adresse est requise").max(255),
  complement_adresse: z.string().max(255).optional().nullable(),
  code_postal: z.string().regex(
    /^((0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})$/,
    'Code postal invalide (5 chiffres, metropole ou DOM-TOM)',
  ),
  ville: z.string().min(1, 'Ville requise').max(100),
  departement: z.string().min(2).max(3).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type AddressInput = z.infer<typeof addressSchema>;

// ============================================
// 3. VALIDATION CONDITIONNELLE PAR TYPE
// ============================================

/**
 * Valide qu'un objet contient tous les champs requis pour un type
 * de bien donne, en utilisant la matrice FIELD_VISIBILITY.
 *
 * Utile pour une validation supplementaire cote serveur ou client,
 * en complement des schemas V3 discrimines par type_bien.
 *
 * @returns Liste des champs requis mais manquants
 */
export function validateRequiredFieldsForType(
  type: PropertyTypeV3,
  data: Record<string, unknown>,
): { field: string; message: string }[] {
  const fields = getFieldsForType(type);
  const errors: { field: string; message: string }[] = [];

  for (const [field, visibility] of Object.entries(fields)) {
    if (visibility !== 'required') continue;

    const value = data[field];
    const isEmpty =
      value === undefined ||
      value === null ||
      value === '' ||
      (typeof value === 'number' && isNaN(value));

    if (isEmpty) {
      errors.push({
        field,
        message: `Ce champ est requis pour un bien de type "${type}"`,
      });
    }
  }

  return errors;
}

/**
 * Nettoie un objet de donnees en supprimant les champs masques
 * pour un type de bien donne. Utile avant INSERT/UPDATE pour
 * eviter d'enregistrer des donnees non pertinentes.
 *
 * Par exemple, supprime parking_type pour un appartement.
 */
export function stripHiddenFields<T extends Record<string, unknown>>(
  type: PropertyTypeV3,
  data: T,
): Partial<T> {
  const fields = getFieldsForType(type);
  const result = { ...data };

  for (const [field, visibility] of Object.entries(fields)) {
    if (visibility === 'hidden' && field in result) {
      delete result[field];
    }
  }

  return result;
}
