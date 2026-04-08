/**
 * Zod validation schemas — Module Prestataires SOTA 2026
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const tradeCategoryEnum = z.enum([
  'plomberie', 'electricite', 'serrurerie', 'peinture', 'menuiserie',
  'chauffage', 'climatisation', 'toiture', 'maconnerie', 'jardinage',
  'nettoyage', 'demenagement', 'diagnostic', 'general',
]);

export const workOrderStatusEnum = z.enum([
  'draft', 'quote_requested', 'quote_received', 'quote_approved',
  'quote_rejected', 'scheduled', 'in_progress', 'completed',
  'invoiced', 'paid', 'disputed', 'cancelled',
]);

export const urgencyEnum = z.enum(['low', 'normal', 'urgent', 'emergency']);

export const paymentMethodEnum = z.enum(['bank_transfer', 'check', 'cash', 'stripe']);

export const deductibleCategoryEnum = z.enum(['entretien', 'reparation', 'amelioration']);

// ============================================
// PROVIDER SCHEMAS
// ============================================

/** SIRET: exactly 14 digits or empty */
const siretSchema = z
  .string()
  .regex(/^\d{14}$/, 'Le SIRET doit contenir exactement 14 chiffres')
  .nullable()
  .optional();

export const createProviderSchema = z.object({
  company_name: z.string().min(1, 'Le nom de la societe est requis').max(200),
  siret: siretSchema,
  contact_name: z.string().min(1, 'Le nom du contact est requis').max(100),
  email: z.string().email('Email invalide'),
  phone: z.string().min(6, 'Numero de telephone invalide').max(20),
  trade_categories: z.array(tradeCategoryEnum).min(1, 'Au moins une categorie est requise'),
  description: z.string().max(2000).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  postal_code: z.string().max(10).nullable().optional(),
  department: z.string().max(5).nullable().optional(),
  service_radius_km: z.number().int().min(1).max(500).optional().default(30),
  certifications: z.array(z.string()).optional().default([]),
  insurance_number: z.string().max(100).nullable().optional(),
  insurance_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  decennale_number: z.string().max(100).nullable().optional(),
  decennale_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  emergency_available: z.boolean().optional().default(false),
  response_time_hours: z.number().int().min(1).max(720).optional().default(48),
});

export const updateProviderSchema = createProviderSchema.partial();

export const addToAddressBookSchema = z.object({
  provider_id: z.string().uuid(),
  nickname: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  is_favorite: z.boolean().optional().default(false),
});

export const searchProvidersSchema = z.object({
  category: tradeCategoryEnum.optional(),
  department: z.string().max(5).optional(),
  emergency_only: z.boolean().optional(),
  verified_only: z.boolean().optional(),
  min_rating: z.number().min(0).max(5).optional(),
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// ============================================
// WORK ORDER SCHEMAS
// ============================================

export const createWorkOrderSchema = z.object({
  property_id: z.string().uuid('Property ID invalide'),
  lease_id: z.string().uuid().nullable().optional(),
  ticket_id: z.string().uuid().nullable().optional(),
  provider_id: z.string().uuid().nullable().optional(),
  entity_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1, 'Le titre est requis').max(200),
  description: z.string().min(1, 'La description est requise').max(5000),
  category: tradeCategoryEnum,
  urgency: urgencyEnum.optional().default('normal'),
  is_deductible: z.boolean().optional().default(true),
  deductible_category: deductibleCategoryEnum.nullable().optional(),
});

export const updateWorkOrderSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: tradeCategoryEnum.optional(),
  urgency: urgencyEnum.optional(),
  provider_id: z.string().uuid().nullable().optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  scheduled_time_slot: z.string().max(50).nullable().optional(),
  is_deductible: z.boolean().optional(),
  deductible_category: deductibleCategoryEnum.nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export const submitQuoteSchema = z.object({
  quote_amount_cents: z.number().int().positive('Le montant du devis doit etre positif'),
  quote_document_id: z.string().uuid().nullable().optional(),
});

export const scheduleWorkOrderSchema = z.object({
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  scheduled_time_slot: z.string().max(50).optional(),
});

export const completeWorkOrderSchema = z.object({
  intervention_report: z.string().min(1, 'Le rapport est requis').max(10000),
  intervention_photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(200).optional(),
    taken_at: z.string().optional(),
  })).optional().default([]),
  tenant_signature_url: z.string().url().nullable().optional(),
});

export const submitInvoiceSchema = z.object({
  invoice_amount_cents: z.number().int().positive('Le montant de la facture doit etre positif'),
  invoice_document_id: z.string().uuid().nullable().optional(),
});

export const markPaidSchema = z.object({
  payment_method: paymentMethodEnum,
});

export const createReviewSchema = z.object({
  provider_profile_id: z.string().uuid(),
  work_order_id: z.string().uuid(),
  rating_overall: z.number().int().min(1).max(5),
  rating_punctuality: z.number().int().min(1).max(5).nullable().optional(),
  rating_quality: z.number().int().min(1).max(5).nullable().optional(),
  rating_communication: z.number().int().min(1).max(5).nullable().optional(),
  rating_value: z.number().int().min(1).max(5).nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  comment: z.string().max(2000).nullable().optional(),
  would_recommend: z.boolean().optional().default(true),
});

// ============================================
// INFERRED TYPES
// ============================================

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type AddToAddressBookInput = z.infer<typeof addToAddressBookSchema>;
export type SearchProvidersInput = z.infer<typeof searchProvidersSchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type UpdateWorkOrderInput = z.infer<typeof updateWorkOrderSchema>;
export type SubmitQuoteInput = z.infer<typeof submitQuoteSchema>;
export type ScheduleWorkOrderInput = z.infer<typeof scheduleWorkOrderSchema>;
export type CompleteWorkOrderInput = z.infer<typeof completeWorkOrderSchema>;
export type SubmitInvoiceInput = z.infer<typeof submitInvoiceSchema>;
export type MarkPaidInput = z.infer<typeof markPaidSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
