import { z } from "zod";

/**
 * Zod schemas for API v1 request/response validation
 */

// ==========================================
// AUTH SCHEMAS
// ==========================================

export const RegisterSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Mot de passe: 8 caractères minimum"),
  role: z.enum(["owner", "tenant", "provider"]),
  prenom: z.string().min(1, "Prénom requis").optional(),
  nom: z.string().min(1, "Nom requis").optional(),
});

export const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const TwoFactorSchema = z.object({
  code: z.string().length(6, "Code à 6 chiffres"),
});

// ==========================================
// PROPERTY SCHEMAS
// ==========================================

export const CreatePropertySchema = z.object({
  type: z.enum([
    "appartement",
    "maison",
    "studio",
    "colocation",
    "saisonnier",
    "local_commercial",
    "bureaux",
    "parking",
  ]),
  adresse_complete: z.string().min(5, "Adresse requise"),
  code_postal: z.string().regex(/^\d{5}$/, "Code postal invalide"),
  ville: z.string().min(1, "Ville requise"),
  departement: z.string().min(1, "Département requis"),
  surface: z.number().positive("Surface positive requise"),
  nb_pieces: z.number().int().positive("Nombre de pièces requis"),
  etage: z.number().int().optional().nullable(),
  ascenseur: z.boolean().default(false),
  meuble: z.boolean().default(false),
  loyer_base: z.number().positive().optional(),
  charges_mensuelles: z.number().nonnegative().default(0),
  depot_garantie: z.number().nonnegative().default(0),
});

export const UpdatePropertySchema = z.object({
  type: z.enum([
    "appartement",
    "maison",
    "studio",
    "colocation",
    "saisonnier",
    "local_commercial",
    "bureaux",
    "parking",
  ]).optional(),
  adresse_complete: z.string().min(5, "Adresse requise").optional(),
  code_postal: z.string().regex(/^\d{5}$/, "Code postal invalide").optional(),
  ville: z.string().min(1, "Ville requise").optional(),
  departement: z.string().min(1, "Département requis").optional(),
  surface: z.number().positive("Surface positive requise").optional(),
  nb_pieces: z.number().int().positive("Nombre de pièces requis").optional(),
  etage: z.number().int().optional().nullable(),
  ascenseur: z.boolean().optional(),
  meuble: z.boolean().optional(),
  loyer_base: z.number().positive().optional(),
  charges_mensuelles: z.number().nonnegative().optional(),
  depot_garantie: z.number().nonnegative().optional(),
});

export const CreateInvitationSchema = z.object({
  role: z.enum(["locataire_principal", "colocataire", "garant"]).default("locataire_principal"),
  email: z.string().email().optional(),
  expires_in_days: z.number().int().min(1).max(30).default(7),
});

// ==========================================
// UNIT SCHEMAS
// ==========================================

export const CreateUnitSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  capacite_max: z.number().int().min(1).max(10, "Maximum 10 colocataires"),
  surface: z.number().positive().optional().nullable(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["principal", "tenant", "occupant", "guarantor"]),
});

// ==========================================
// LEASE SCHEMAS
// ==========================================

export const CreateLeaseSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  type_bail: z.enum(["nu", "meuble", "colocation", "saisonnier", "bail_mobilite", "commercial_3_6_9"]),
  loyer: z.number().positive("Loyer positif requis"),
  charges_forfaitaires: z.number().nonnegative().default(0),
  depot_de_garantie: z.number().nonnegative().default(0),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date: YYYY-MM-DD"),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
}).refine(
  (data) => data.property_id || data.unit_id,
  "property_id ou unit_id requis"
);

export const UpdateLeaseSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  type_bail: z.enum(["nu", "meuble", "colocation", "saisonnier", "bail_mobilite", "commercial_3_6_9"]).optional(),
  loyer: z.number().positive("Loyer positif requis").optional(),
  charges_forfaitaires: z.number().nonnegative().optional(),
  depot_de_garantie: z.number().nonnegative().optional(),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date: YYYY-MM-DD").optional(),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  statut: z.enum([
    "draft",              // Brouillon
    "sent",               // Envoyé pour signature
    "pending_signature",  // En attente de signatures
    "partially_signed",   // Partiellement signé
    "fully_signed",       // Entièrement signé (avant entrée/EDL)
    "active",             // Actif (après EDL d'entrée)
    "amended",            // Avenant
    "terminated",         // Terminé
    "archived"            // Archivé
  ]).optional(),
});

export const CreateSignerSchema = z.object({
  profile_id: z.string().uuid(),
  role: z.enum(["proprietaire", "locataire_principal", "colocataire", "garant"]),
});

export const SignLeaseSchema = z.object({
  level: z.enum(["SES", "AES", "QES"]).default("SES"),
});

// ==========================================
// INVOICE SCHEMAS
// ==========================================

export const CreateInvoiceSchema = z.object({
  lease_id: z.string().uuid(),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format période: YYYY-MM"),
  montant_loyer: z.number().positive(),
  montant_charges: z.number().nonnegative().default(0),
});

export const CreatePaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  montant: z.number().positive("Montant positif requis"),
  moyen: z.enum(["cb", "virement", "prelevement"]),
  return_url: z.string().url().optional(),
});

// ==========================================
// CHARGE SCHEMAS
// ==========================================

export const CreateChargeSchema = z.object({
  property_id: z.string().uuid(),
  type: z.enum(["eau", "electricite", "copro", "taxe", "ordures", "assurance", "travaux", "autre"]),
  montant: z.number().positive("Montant positif requis"),
  periodicite: z.enum(["mensuelle", "trimestrielle", "annuelle"]),
  refacturable_locataire: z.boolean().default(false),
});

export const ReconciliationSchema = z.object({
  lease_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ==========================================
// DEPOSIT SCHEMAS
// ==========================================

export const CreateDepositSchema = z.object({
  amount: z.number().positive("Montant positif requis"),
  payment_method: z.enum(["cb", "virement", "cheque"]),
});

export const RefundDepositSchema = z.object({
  amount: z.number().positive("Montant positif requis"),
  reason: z.string().min(1, "Motif requis"),
  deductions: z.array(z.object({
    label: z.string(),
    amount: z.number().positive(),
  })).optional(),
});

// ==========================================
// INSPECTION (EDL) SCHEMAS
// ==========================================

export const CreateInspectionSchema = z.object({
  lease_id: z.string().uuid(),
  type: z.enum(["entree", "sortie"]),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const AddInspectionItemSchema = z.object({
  room_name: z.string().min(1, "Nom de pièce requis"),
  item_name: z.string().min(1, "Nom d'élément requis"),
  condition: z.enum(["neuf", "bon", "moyen", "mauvais", "tres_mauvais"]).optional(),
  notes: z.string().optional(),
});

// ==========================================
// TICKET SCHEMAS
// ==========================================

export const CreateTicketSchema = z.object({
  property_id: z.string().uuid(),
  lease_id: z.string().uuid().optional().nullable(),
  titre: z.string().min(3, "Titre: 3 caractères minimum"),
  description: z.string().min(10, "Description: 10 caractères minimum"),
  priorite: z.enum(["basse", "normale", "haute"]).default("normale"),
});

export const AssignTicketSchema = z.object({
  provider_id: z.string().uuid(),
});

export const UpdateTicketStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "paused", "resolved", "closed"]),
});

export const CreateQuoteSchema = z.object({
  description: z.string().min(1, "Description requise"),
  amount: z.number().positive("Montant positif requis"),
  validity_days: z.number().int().min(1).max(90).default(30),
});

// ==========================================
// METER SCHEMAS
// ==========================================

export const CreateMeterSchema = z.object({
  type: z.enum(["electricity", "gas", "water"]),
  meter_number: z.string().optional(),
  provider: z.string().optional(),
});

export const CreateReadingSchema = z.object({
  reading_value: z.number().nonnegative("Valeur positive requise"),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["manual", "api", "ocr"]).default("manual"),
});

// ==========================================
// MESSAGING SCHEMAS
// ==========================================

export const CreateThreadSchema = z.object({
  lease_id: z.string().uuid(),
  type: z.enum(["owner_tenant", "roommates", "ticket", "announcement"]),
  title: z.string().optional(),
  ticket_id: z.string().uuid().optional(),
});

export const CreateMessageSchema = z.object({
  body: z.string().min(1, "Message requis"),
  attachments: z.array(z.object({
    storage_path: z.string(),
    file_name: z.string(),
    mime_type: z.string().optional(),
  })).optional(),
});

// ==========================================
// ADMIN SCHEMAS
// ==========================================

export const CreateApiKeySchema = z.object({
  provider_id: z.string().uuid(),
  env: z.enum(["dev", "stage", "prod"]),
  scope: z.string().optional(),
});

export const UpdateApiCostsSchema = z.object({
  provider_id: z.string().uuid(),
  feature: z.string(),
  unit_cost_eur: z.number().nonnegative(),
});

export const CreateModerationRuleSchema = z.object({
  type: z.string(),
  condition: z.object({}).passthrough(),
  action: z.enum(["flag", "block", "notify"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

// ==========================================
// PRIVACY / GDPR SCHEMAS
// ==========================================

export const AnonymizeRequestSchema = z.object({
  user_id: z.string().uuid(),
  type: z.enum(["access", "rectification", "erasure", "portability", "objection"]),
  reason: z.string().optional(),
});

// ==========================================
// Type exports
// ==========================================

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type CreateLeaseInput = z.infer<typeof CreateLeaseSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

