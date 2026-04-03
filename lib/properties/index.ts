/**
 * lib/properties/index.ts — Point d'entree du module properties
 *
 * Usage :
 *   import { PROPERTY_TYPES, getFieldsForType } from '@/lib/properties';
 *   import { canCreateProperty, canDeleteProperty } from '@/lib/properties';
 *   import { searchAddress } from '@/lib/properties';
 */

export * from './constants';
export * from './guards';
export * from './address';
export {
  addressSchema,
  validateRequiredFieldsForType,
  stripHiddenFields,
  type AddressInput,
} from './schemas';
