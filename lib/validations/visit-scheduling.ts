/**
 * Validations pour le système de planification des visites - SOTA 2026
 */
import { z } from "zod";

// ============================================
// TIME REGEX PATTERNS
// ============================================

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ============================================
// AVAILABILITY PATTERN SCHEMAS
// ============================================

/**
 * Schéma de base pour les patterns de disponibilité (sans refinement)
 */
const availabilityPatternBaseSchema = z.object({
  property_id: z.string().uuid().nullable().optional(),
  recurrence_type: z.enum(["daily", "weekly", "monthly", "custom"]).default("weekly"),
  day_of_week: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Sélectionnez au moins un jour")
    .default([6]), // Samedi par défaut
  start_time: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)")
    .default("10:00"),
  end_time: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)")
    .default("18:00"),
  slot_duration_minutes: z
    .number()
    .int()
    .min(15, "Minimum 15 minutes")
    .max(180, "Maximum 3 heures")
    .default(30),
  buffer_minutes: z
    .number()
    .int()
    .min(0, "Le buffer ne peut pas être négatif")
    .max(60, "Maximum 60 minutes de buffer")
    .default(15),
  valid_from: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)")
    .optional(),
  valid_until: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)")
    .nullable()
    .optional(),
  max_bookings_per_slot: z
    .number()
    .int()
    .min(1, "Minimum 1 visiteur")
    .max(10, "Maximum 10 visiteurs par créneau")
    .default(1),
  auto_confirm: z.boolean().default(false),
});

// Fonction de validation des heures (réutilisable)
const validateTimeRange = (data: { start_time?: string; end_time?: string }) => {
  if (!data.start_time || !data.end_time) return true;
  const [startH, startM] = data.start_time.split(":").map(Number);
  const [endH, endM] = data.end_time.split(":").map(Number);
  return endH * 60 + endM > startH * 60 + startM;
};

/**
 * Schéma pour créer un pattern de disponibilité
 */
export const createAvailabilityPatternSchema = availabilityPatternBaseSchema.refine(
  validateTimeRange,
  {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["end_time"],
  }
);

/**
 * Schéma pour mettre à jour un pattern de disponibilité
 * Note: .partial() doit être appelé sur le ZodObject, pas sur ZodEffects
 */
export const updateAvailabilityPatternSchema = availabilityPatternBaseSchema
  .partial()
  .extend({
    is_active: z.boolean().optional(),
  })
  .refine(validateTimeRange, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["end_time"],
  });

// ============================================
// AVAILABILITY EXCEPTION SCHEMAS
// ============================================

/**
 * Schéma pour créer une exception de disponibilité
 */
export const createAvailabilityExceptionSchema = z.object({
  pattern_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  exception_date: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)"),
  exception_type: z.enum(["unavailable", "modified"]),
  modified_start_time: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)")
    .nullable()
    .optional(),
  modified_end_time: z
    .string()
    .regex(timeRegex, "Format d'heure invalide (HH:MM)")
    .nullable()
    .optional(),
  reason: z.string().max(500).nullable().optional(),
}).refine(
  (data) => {
    // Si type=modified, les heures modifiées doivent être présentes
    if (data.exception_type === "modified") {
      return data.modified_start_time && data.modified_end_time;
    }
    return true;
  },
  {
    message: "Les heures modifiées sont requises pour une exception de type 'modified'",
    path: ["modified_start_time"],
  }
);

// ============================================
// VISIT SLOT SCHEMAS
// ============================================

/**
 * Schéma pour les paramètres de recherche de créneaux
 */
export const getVisitSlotsQuerySchema = z.object({
  property_id: z.string().uuid(),
  start_date: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)")
    .optional(),
  end_date: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)")
    .optional(),
  status: z.enum(["available", "booked", "blocked", "cancelled", "completed"]).optional(),
});

/**
 * Schéma pour bloquer/débloquer un créneau
 */
export const updateSlotStatusSchema = z.object({
  status: z.enum(["available", "blocked"]),
  reason: z.string().max(500).optional(),
});

// ============================================
// VISIT BOOKING SCHEMAS
// ============================================

/**
 * Schéma pour créer une réservation de visite
 */
export const createVisitBookingSchema = z.object({
  slot_id: z.string().uuid(),
  tenant_message: z.string().max(1000).nullable().optional(),
  contact_phone: z
    .string()
    .regex(/^\+?[0-9]{9,15}$/, "Format téléphone invalide")
    .optional(),
  contact_email: z.string().email("Email invalide").optional(),
  party_size: z
    .number()
    .int()
    .min(1, "Minimum 1 personne")
    .max(5, "Maximum 5 personnes")
    .default(1),
});

/**
 * Schéma pour confirmer/annuler une réservation (propriétaire)
 */
export const updateVisitBookingSchema = z.object({
  status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
  owner_notes: z.string().max(1000).nullable().optional(),
  cancellation_reason: z.string().max(500).optional(),
});

/**
 * Schéma pour annuler une réservation (locataire)
 */
export const cancelVisitBookingSchema = z.object({
  cancellation_reason: z.string().max(500).optional(),
});

/**
 * Schéma pour le feedback après visite
 */
export const visitFeedbackSchema = z.object({
  feedback_rating: z
    .number()
    .int()
    .min(1, "Note minimum: 1")
    .max(5, "Note maximum: 5"),
  feedback_comment: z.string().max(2000).nullable().optional(),
});

// ============================================
// CALENDAR CONNECTION SCHEMAS
// ============================================

/**
 * Schéma pour créer une connexion calendrier
 */
export const createCalendarConnectionSchema = z.object({
  provider: z.enum(["google", "outlook", "apple", "caldav"]),
  access_token_encrypted: z.string().min(1),
  refresh_token_encrypted: z.string().nullable().optional(),
  token_expires_at: z.string().datetime().nullable().optional(),
  calendar_id: z.string().min(1),
  calendar_name: z.string().max(255).nullable().optional(),
  calendar_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format couleur invalide (hex)")
    .nullable()
    .optional(),
  sync_direction: z.enum(["to_external", "from_external", "both"]).default("both"),
});

/**
 * Schéma pour mettre à jour une connexion calendrier
 */
export const updateCalendarConnectionSchema = z.object({
  sync_enabled: z.boolean().optional(),
  sync_direction: z.enum(["to_external", "from_external", "both"]).optional(),
  calendar_name: z.string().max(255).nullable().optional(),
  calendar_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Format couleur invalide (hex)")
    .nullable()
    .optional(),
});

// ============================================
// GENERATE SLOTS SCHEMA
// ============================================

/**
 * Schéma pour la génération de créneaux
 */
export const generateSlotsSchema = z.object({
  property_id: z.string().uuid(),
  start_date: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)"),
  end_date: z
    .string()
    .regex(isoDateRegex, "Format date invalide (YYYY-MM-DD)"),
}).refine(
  (data) => {
    return new Date(data.end_date) >= new Date(data.start_date);
  },
  {
    message: "La date de fin doit être après la date de début",
    path: ["end_date"],
  }
);

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateAvailabilityPattern = z.infer<typeof createAvailabilityPatternSchema>;
export type UpdateAvailabilityPattern = z.infer<typeof updateAvailabilityPatternSchema>;
export type CreateAvailabilityException = z.infer<typeof createAvailabilityExceptionSchema>;
export type GetVisitSlotsQuery = z.infer<typeof getVisitSlotsQuerySchema>;
export type UpdateSlotStatus = z.infer<typeof updateSlotStatusSchema>;
export type CreateVisitBooking = z.infer<typeof createVisitBookingSchema>;
export type UpdateVisitBooking = z.infer<typeof updateVisitBookingSchema>;
export type CancelVisitBooking = z.infer<typeof cancelVisitBookingSchema>;
export type VisitFeedback = z.infer<typeof visitFeedbackSchema>;
export type CreateCalendarConnection = z.infer<typeof createCalendarConnectionSchema>;
export type UpdateCalendarConnection = z.infer<typeof updateCalendarConnectionSchema>;
export type GenerateSlots = z.infer<typeof generateSlotsSchema>;
