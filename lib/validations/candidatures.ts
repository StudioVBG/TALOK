/**
 * Zod schemas pour le workflow candidatures locatives
 */

import { z } from 'zod';

// ============================================
// LISTINGS
// ============================================

export const listingPhotoSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  order: z.number().int().min(0),
});

export const createListingSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(8, 'Le titre doit contenir au moins 8 caractères').max(200),
  description: z.string().min(30, 'La description doit contenir au moins 30 caractères').max(5000).optional(),
  rent_amount_cents: z.number().int().min(0, 'Le loyer doit être positif'),
  charges_cents: z.number().int().min(0).default(0),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (AAAA-MM-JJ)'),
  bail_type: z.enum(['nu', 'meuble', 'colocation', 'saisonnier', 'commercial']),
  photos: z.array(listingPhotoSchema).optional(),
});

export const updateListingSchema = z.object({
  title: z.string().min(8).max(200).optional(),
  description: z.string().min(30).max(5000).optional(),
  rent_amount_cents: z.number().int().min(0).optional(),
  charges_cents: z.number().int().min(0).optional(),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  bail_type: z.enum(['nu', 'meuble', 'colocation', 'saisonnier', 'commercial']).optional(),
  photos: z.array(listingPhotoSchema).optional(),
});

export const publishListingSchema = z.object({
  listing_id: z.string().uuid(),
});

// ============================================
// APPLICATIONS
// ============================================

export const applicationDocumentSchema = z.object({
  type: z.enum(['identity', 'income', 'tax_notice', 'employment', 'address_proof', 'rent_receipt', 'other']),
  name: z.string().min(1),
  url: z.string().url(),
  uploaded_at: z.string().datetime().optional(),
});

export const createApplicationSchema = z.object({
  listing_id: z.string().uuid(),
  applicant_name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(100),
  applicant_email: z.string().email('Adresse email invalide'),
  applicant_phone: z.string().min(10).max(20).optional(),
  message: z.string().max(2000).optional(),
  documents: z.array(applicationDocumentSchema).optional(),
});

export const rejectApplicationSchema = z.object({
  rejection_reason: z.string().min(5, 'Veuillez indiquer un motif').max(500).optional(),
});

export const compareApplicationsSchema = z.object({
  application_ids: z.array(z.string().uuid()).min(2, 'Sélectionnez au moins 2 candidatures').max(10),
});

// ============================================
// Type exports
// ============================================

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
export type CompareApplicationsInput = z.infer<typeof compareApplicationsSchema>;
