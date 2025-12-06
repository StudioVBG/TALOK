// =====================================================
// Validations Zod pour le système de Compliance Prestataire
// =====================================================

import { z } from 'zod';

/**
 * Types de documents valides
 */
export const documentTypeEnum = z.enum([
  'rc_pro',
  'decennale',
  'kbis',
  'id_card_recto',
  'id_card_verso',
  'rib',
  'urssaf',
  'qualification',
  'insurance_other',
  'other',
]);

/**
 * Types de prestataires valides
 */
export const providerTypeEnum = z.enum(['independant', 'entreprise', 'btp']);

/**
 * Statuts de vérification
 */
export const verificationStatusEnum = z.enum(['pending', 'verified', 'rejected', 'expired']);

/**
 * Statuts KYC
 */
export const kycStatusEnum = z.enum([
  'incomplete',
  'pending_review',
  'verified',
  'suspended',
  'rejected',
]);

/**
 * Schéma de création d'un document compliance
 */
export const createComplianceDocumentSchema = z.object({
  document_type: documentTypeEnum,
  storage_path: z.string().min(1, 'Le chemin du fichier est requis'),
  original_filename: z.string().optional(),
  file_size: z.number().positive().optional(),
  mime_type: z.string().optional(),
  issue_date: z.string().optional().nullable(),
  expiration_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateComplianceDocumentInput = z.infer<typeof createComplianceDocumentSchema>;

/**
 * Schéma de mise à jour d'un document compliance (admin)
 */
export const updateComplianceDocumentSchema = z.object({
  verification_status: verificationStatusEnum.optional(),
  rejection_reason: z.string().optional().nullable(),
  expiration_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateComplianceDocumentInput = z.infer<typeof updateComplianceDocumentSchema>;

/**
 * Schéma de validation d'un document par un admin
 */
export const verifyDocumentSchema = z.object({
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional().nullable(),
});

export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;

/**
 * Schéma de création d'un compte de paiement
 */
export const createPayoutAccountSchema = z.object({
  iban: z
    .string()
    .min(14, 'L\'IBAN doit contenir au moins 14 caractères')
    .max(34, 'L\'IBAN ne peut pas dépasser 34 caractères')
    .regex(
      /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/,
      'Format IBAN invalide (ex: FR7630001007941234567890185)'
    ),
  bic: z
    .string()
    .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Format BIC invalide')
    .optional()
    .nullable(),
  bank_name: z.string().optional().nullable(),
  account_holder_name: z.string().min(2, 'Le nom du titulaire est requis'),
  is_default: z.boolean().optional(),
});

export type CreatePayoutAccountInput = z.infer<typeof createPayoutAccountSchema>;

/**
 * Schéma de mise à jour du profil prestataire (informations entreprise)
 */
export const updateProviderBusinessInfoSchema = z.object({
  provider_type: providerTypeEnum,
  raison_sociale: z.string().min(2, 'La raison sociale est requise'),
  siren: z
    .string()
    .regex(/^[0-9]{9}$/, 'Le SIREN doit contenir 9 chiffres')
    .optional()
    .nullable(),
  siret: z
    .string()
    .regex(/^[0-9]{14}$/, 'Le SIRET doit contenir 14 chiffres')
    .optional()
    .nullable(),
  tva_intra: z
    .string()
    .regex(/^FR[0-9]{2}[0-9]{9}$/, 'Format TVA intracommunautaire invalide (ex: FR12123456789)')
    .optional()
    .nullable(),
  adresse: z.string().optional().nullable(),
  code_postal: z
    .string()
    .regex(/^[0-9]{5}$/, 'Le code postal doit contenir 5 chiffres')
    .optional()
    .nullable(),
  ville: z.string().optional().nullable(),
});

export type UpdateProviderBusinessInfoInput = z.infer<typeof updateProviderBusinessInfoSchema>;

/**
 * Schéma d'upload de fichier
 */
export const uploadFileSchema = z.object({
  file: z.instanceof(File, { message: 'Un fichier est requis' }),
  document_type: documentTypeEnum,
  issue_date: z.string().optional(),
  expiration_date: z.string().optional(),
});

/**
 * Schéma complet d'onboarding compliance prestataire
 */
export const providerComplianceOnboardingSchema = z.object({
  // Étape 1: Informations entreprise
  provider_type: providerTypeEnum,
  raison_sociale: z.string().min(2, 'La raison sociale est requise'),
  siren: z.string().regex(/^[0-9]{9}$/, 'Le SIREN doit contenir 9 chiffres').optional().nullable(),
  siret: z.string().regex(/^[0-9]{14}$/, 'Le SIRET doit contenir 14 chiffres').optional().nullable(),
  adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, 'Code postal invalide').optional().nullable(),
  ville: z.string().optional().nullable(),
  
  // Étape 2: Services (existant)
  type_services: z.array(z.string()).min(1, 'Sélectionnez au moins un service'),
  zones_intervention: z.string().optional().nullable(),
  certifications: z.string().optional().nullable(),
  
  // Étape 3: Documents (références aux fichiers uploadés)
  documents: z.array(z.object({
    document_type: documentTypeEnum,
    storage_path: z.string(),
    expiration_date: z.string().optional().nullable(),
  })).optional(),
  
  // Étape 4: Compte bancaire
  payout_account: createPayoutAccountSchema.optional(),
});

export type ProviderComplianceOnboardingInput = z.infer<typeof providerComplianceOnboardingSchema>;

/**
 * Valider un IBAN français
 */
export function validateFrenchIBAN(iban: string): boolean {
  // Retirer les espaces et mettre en majuscules
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Vérifier le format FR
  if (!cleanIban.startsWith('FR') || cleanIban.length !== 27) {
    return false;
  }
  
  // Vérification du checksum (algorithme MOD 97)
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
  let numericIban = '';
  
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      numericIban += (char.charCodeAt(0) - 55).toString();
    } else {
      numericIban += char;
    }
  }
  
  // Calcul MOD 97
  let remainder = 0;
  for (let i = 0; i < numericIban.length; i++) {
    remainder = (remainder * 10 + parseInt(numericIban[i])) % 97;
  }
  
  return remainder === 1;
}

/**
 * Valider un numéro SIREN
 */
export function validateSIREN(siren: string): boolean {
  if (!/^[0-9]{9}$/.test(siren)) {
    return false;
  }
  
  // Algorithme de Luhn
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(siren[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
}

/**
 * Valider un numéro SIRET
 */
export function validateSIRET(siret: string): boolean {
  if (!/^[0-9]{14}$/.test(siret)) {
    return false;
  }
  
  // Le SIRET est composé du SIREN (9 chiffres) + NIC (5 chiffres)
  // Validation Luhn sur les 14 chiffres
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(siret[i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  return sum % 10 === 0;
}

/**
 * Formater un IBAN pour l'affichage
 */
export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Masquer un IBAN (afficher seulement les 4 derniers chiffres)
 */
export function maskIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '');
  if (clean.length < 8) return '****';
  return `${clean.slice(0, 4)} **** **** ${clean.slice(-4)}`;
}

