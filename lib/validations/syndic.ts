import { z } from "zod";

/**
 * Zod schemas for the syndic/copro module API routes.
 * Covers: assemblies, convocations, resolutions, votes, minutes,
 *         mandates, councils, fonds_travaux.
 */

// ============================================
// ASSEMBLIES
// ============================================

export const CreateAssemblySchema = z.object({
  site_id: z.string().uuid(),
  assembly_type: z.enum(["ordinaire", "extraordinaire", "concertation", "consultation_ecrite"]),
  title: z.string().min(3, "Titre requis").max(255),
  reference_number: z.string().max(50).optional(),
  fiscal_year: z.number().int().min(2020).max(2100).optional(),
  scheduled_at: z.string().datetime({ message: "Date ISO 8601 requise" }),
  location: z.string().max(255).optional(),
  location_address: z.string().max(500).optional(),
  online_meeting_url: z.string().url().optional().or(z.literal("")),
  is_hybrid: z.boolean().default(false),
  quorum_required: z.number().int().nonnegative().optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateAssemblySchema = CreateAssemblySchema.partial().omit({ site_id: true });

export const ConveneAssemblySchema = z.object({
  convocation_date: z.string().datetime().optional(), // Défaut = now()
  second_convocation_at: z.string().datetime().optional(),
});

// ============================================
// CONVOCATIONS
// ============================================

export const CreateConvocationsBatchSchema = z.object({
  // Envoyer à toutes les unités du site OU à une liste spécifique
  unit_ids: z.array(z.string().uuid()).optional(),
  delivery_method: z.enum([
    "email",
    "postal_simple",
    "postal_recommande",
    "hand_delivered",
    "lrar",
    "lre_numerique",
  ]),
  convocation_document_url: z.string().url().optional(),
  ordre_du_jour_document_url: z.string().url().optional(),
});

export const UpdateConvocationSchema = z.object({
  status: z.enum(["pending", "sent", "delivered", "read", "returned", "refused", "failed"]).optional(),
  delivered_at: z.string().datetime().optional(),
  read_at: z.string().datetime().optional(),
  tracking_number: z.string().max(100).optional(),
  accuse_reception_url: z.string().url().optional(),
  accuse_reception_at: z.string().datetime().optional(),
  error_message: z.string().max(500).optional(),
});

// ============================================
// RESOLUTIONS
// ============================================

export const CreateResolutionSchema = z.object({
  resolution_number: z.number().int().positive(),
  title: z.string().min(3, "Titre requis").max(255),
  description: z.string().min(3, "Description requise"),
  category: z
    .enum([
      "gestion",
      "budget",
      "travaux",
      "reglement",
      "honoraires",
      "conseil_syndical",
      "assurance",
      "conflits",
      "autre",
    ])
    .default("gestion"),
  majority_rule: z.enum([
    "article_24",
    "article_25",
    "article_25_1",
    "article_26",
    "article_26_1",
    "unanimite",
  ]),
  estimated_amount_cents: z.number().int().nonnegative().optional(),
  contract_partner: z.string().max(255).optional(),
  attached_documents: z.array(z.any()).optional(),
});

export const UpdateResolutionSchema = CreateResolutionSchema.partial().extend({
  status: z
    .enum(["proposed", "voted_for", "voted_against", "abstained", "adjourned", "withdrawn"])
    .optional(),
});

// ============================================
// VOTES
// ============================================

export const CastVoteSchema = z.object({
  unit_id: z.string().uuid(),
  voter_profile_id: z.string().uuid().optional(),
  voter_name: z.string().min(1),
  voter_tantiemes: z.number().int().nonnegative(),
  vote: z.enum(["for", "against", "abstain"]),
  is_proxy: z.boolean().default(false),
  proxy_holder_profile_id: z.string().uuid().optional(),
  proxy_holder_name: z.string().max(255).optional(),
  proxy_document_url: z.string().url().optional(),
  proxy_scope: z.enum(["general", "specific", "limited"]).optional(),
  vote_method: z
    .enum(["in_person", "proxy", "mail_vote", "online_vote", "hand_vote"])
    .default("in_person"),
});

// ============================================
// MINUTES (PV)
// ============================================

export const CreateMinuteSchema = z.object({
  content: z.record(z.any()).default({}),
  content_html: z.string().optional(),
  document_url: z.string().url().optional(),
});

export const SignMinuteSchema = z.object({
  role: z.enum(["president", "secretary", "scrutineer"]),
  profile_id: z.string().uuid().optional(),
  signature_url: z.string().url().optional(),
});

// ============================================
// SYNDIC MANDATES
// ============================================

export const CreateSyndicMandateSchema = z.object({
  site_id: z.string().uuid(),
  syndic_profile_id: z.string().uuid(),
  mandate_number: z.string().max(50).optional(),
  title: z.string().max(255).default("Mandat de syndic"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis"),
  duration_months: z.number().int().min(1).max(36),
  tacit_renewal: z.boolean().default(false),
  notice_period_months: z.number().int().min(0).max(12).default(3),
  honoraires_annuels_cents: z.number().int().nonnegative(),
  honoraires_particuliers: z.record(z.any()).optional(),
  currency: z.string().length(3).default("EUR"),
  voted_in_assembly_id: z.string().uuid().optional(),
  voted_resolution_id: z.string().uuid().optional(),
  mandate_document_url: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const TerminateMandateSchema = z.object({
  termination_reason: z.string().min(3, "Raison requise").max(1000),
  termination_type: z.enum([
    "end_of_term",
    "early_termination",
    "non_renewal",
    "revoked_by_ag",
    "resignation",
  ]),
});

// ============================================
// COPRO COUNCILS
// ============================================

export const CreateCouncilSchema = z.object({
  site_id: z.string().uuid(),
  mandate_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mandate_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  president_profile_id: z.string().uuid().optional(),
  president_unit_id: z.string().uuid().optional(),
  vice_president_profile_id: z.string().uuid().optional(),
  vice_president_unit_id: z.string().uuid().optional(),
  members: z
    .array(
      z.object({
        profile_id: z.string().uuid(),
        unit_id: z.string().uuid().optional(),
        role: z.enum(["member", "president", "vice_president"]).default("member"),
        elected_at: z.string().datetime().optional(),
      })
    )
    .default([]),
  elected_in_assembly_id: z.string().uuid().optional(),
  elected_resolution_id: z.string().uuid().optional(),
  internal_rules_document_url: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

// ============================================
// COPRO FONDS TRAVAUX (Loi ALUR)
// ============================================

export const CreateFondsTravauxSchema = z.object({
  site_id: z.string().uuid(),
  exercise_id: z.string().uuid().optional(),
  fiscal_year: z.number().int().min(2017).max(2100),
  cotisation_taux_percent: z
    .number()
    .min(0, "Taux positif requis")
    .max(100)
    .default(5.0),
  cotisation_montant_annual_cents: z.number().int().nonnegative(),
  budget_reference_cents: z.number().int().nonnegative().optional(),
  solde_initial_cents: z.number().int().nonnegative().default(0),
  dedicated_bank_account: z
    .string()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/, "IBAN invalide")
    .optional(),
  bank_name: z.string().max(100).optional(),
  loi_alur_exempt: z.boolean().default(false),
  exempt_reason: z
    .enum(["copropriete_neuve_moins_5_ans", "unanimite_dispense", "dtg_pas_de_travaux_prevus"])
    .optional(),
  exempt_voted_resolution_id: z.string().uuid().optional(),
});

export const UpdateFondsTravauxSchema = CreateFondsTravauxSchema.partial().omit({ site_id: true });

// ============================================
// Type exports
// ============================================

export type CreateAssemblyInput = z.infer<typeof CreateAssemblySchema>;
export type UpdateAssemblyInput = z.infer<typeof UpdateAssemblySchema>;
export type CreateResolutionInput = z.infer<typeof CreateResolutionSchema>;
export type CastVoteInput = z.infer<typeof CastVoteSchema>;
export type CreateMinuteInput = z.infer<typeof CreateMinuteSchema>;
export type CreateSyndicMandateInput = z.infer<typeof CreateSyndicMandateSchema>;
export type CreateCouncilInput = z.infer<typeof CreateCouncilSchema>;
export type CreateFondsTravauxInput = z.infer<typeof CreateFondsTravauxSchema>;
