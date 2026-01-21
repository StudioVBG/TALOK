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
    "draft",                   // Brouillon
    "sent",                    // Envoyé pour signature
    "pending_signature",       // En attente de signatures
    "partially_signed",        // Partiellement signé
    "pending_owner_signature", // Locataire signé, attente propriétaire
    "fully_signed",            // Entièrement signé (avant entrée/EDL)
    "active",                  // Actif (après EDL d'entrée)
    "notice_given",            // Congé donné (préavis)
    "amended",                 // Avenant
    "terminated",              // Terminé
    "archived"                 // Archivé
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
// UNIFIED SIGNATURE SCHEMAS (P1 SOTA 2026)
// ==========================================

/**
 * Document types that can be signed
 */
export const SignatureDocumentTypeEnum = z.enum([
  "lease",           // Bail
  "edl_entree",      // État des lieux d'entrée
  "edl_sortie",      // État des lieux de sortie
  "amendment",       // Avenant au bail
  "notice",          // Congé (préavis)
  "receipt",         // Quittance de loyer
  "mandate",         // Mandat de gestion
  "inventory",       // Inventaire mobilier
  "other"            // Autre document
]);

/**
 * eIDAS signature levels
 */
export const SignatureLevelEnum = z.enum([
  "SES",  // Simple Electronic Signature
  "AES",  // Advanced Electronic Signature
  "QES"   // Qualified Electronic Signature
]);

/**
 * Signature session status
 */
export const SignatureSessionStatusEnum = z.enum([
  "draft",              // Brouillon, configuration en cours
  "pending",            // En attente de signatures
  "partially_signed",   // Au moins un signataire a signé
  "completed",          // Tous ont signé
  "expired",            // Session expirée
  "cancelled",          // Annulée
  "rejected"            // Refusée par un signataire
]);

/**
 * Participant status in a signature session
 */
export const SignatureParticipantStatusEnum = z.enum([
  "pending",    // En attente
  "notified",   // Notifié par email/SMS
  "viewed",     // A consulté le document
  "signed",     // A signé
  "declined",   // A refusé
  "expired"     // Délai dépassé
]);

/**
 * Roles for signature participants
 */
export const SignatureRoleEnum = z.enum([
  "owner",              // Propriétaire
  "tenant",             // Locataire principal
  "co_tenant",          // Colocataire
  "guarantor",          // Garant
  "manager",            // Gestionnaire/mandataire
  "witness",            // Témoin
  "provider"            // Prestataire
]);

/**
 * Create a new signature session
 */
export const CreateSignatureSessionSchema = z.object({
  document_type: SignatureDocumentTypeEnum,
  entity_id: z.string().uuid("ID de l'entité invalide"),
  entity_type: z.enum(["lease", "edl", "amendment", "notice", "mandate", "other"]),
  signature_level: SignatureLevelEnum.default("SES"),
  document_url: z.string().url().optional(),
  document_hash: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Add a participant to a signature session
 */
export const AddSignatureParticipantSchema = z.object({
  profile_id: z.string().uuid("ID de profil invalide"),
  role: SignatureRoleEnum,
  signing_order: z.number().int().min(1).max(20).default(1),
  is_required: z.boolean().default(true),
  email_notification: z.boolean().default(true),
  sms_notification: z.boolean().default(false),
  phone: z.string().regex(/^\+?\d{10,15}$/, "Numéro de téléphone invalide").optional(),
});

/**
 * Record a signature proof
 */
export const RecordSignatureProofSchema = z.object({
  participant_id: z.string().uuid(),
  signature_level: SignatureLevelEnum,
  signature_data: z.string().min(1, "Données de signature requises"),
  certificate_info: z.object({
    issuer: z.string().optional(),
    subject: z.string().optional(),
    serial_number: z.string().optional(),
    valid_from: z.string().datetime().optional(),
    valid_to: z.string().datetime().optional(),
  }).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().optional(),
  geolocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional(),
  }).optional(),
  timestamp_authority: z.string().optional(),
  timestamp_token: z.string().optional(),
});

/**
 * Update signature session status
 */
export const UpdateSignatureSessionSchema = z.object({
  status: SignatureSessionStatusEnum.optional(),
  expires_at: z.string().datetime().optional(),
  completed_document_url: z.string().url().optional(),
  completed_document_hash: z.string().optional(),
});

/**
 * Bulk invite participants
 */
export const BulkInviteParticipantsSchema = z.object({
  participants: z.array(AddSignatureParticipantSchema).min(1).max(20),
  send_notifications: z.boolean().default(true),
  custom_message: z.string().max(500).optional(),
});

// ==========================================
// EXPANDED EDL SCHEMAS (P3)
// ==========================================

/**
 * Create an EDL room
 */
export const CreateEDLRoomSchema = z.object({
  edl_id: z.string().uuid(),
  nom: z.string().min(1, "Nom de pièce requis"),
  type: z.enum([
    "entree",
    "salon",
    "sejour",
    "cuisine",
    "chambre",
    "sdb",
    "wc",
    "couloir",
    "balcon",
    "terrasse",
    "cave",
    "parking",
    "buanderie",
    "dressing",
    "bureau",
    "autre"
  ]),
  surface: z.number().positive().optional(),
  ordre: z.number().int().min(0).default(0),
});

/**
 * Update an EDL room
 */
export const UpdateEDLRoomSchema = z.object({
  nom: z.string().min(1).optional(),
  type: z.enum([
    "entree", "salon", "sejour", "cuisine", "chambre", "sdb", "wc",
    "couloir", "balcon", "terrasse", "cave", "parking", "buanderie",
    "dressing", "bureau", "autre"
  ]).optional(),
  surface: z.number().positive().optional().nullable(),
  ordre: z.number().int().min(0).optional(),
});

/**
 * Add media (photo/video) to EDL item
 */
export const AddEDLMediaSchema = z.object({
  edl_item_id: z.string().uuid(),
  type: z.enum(["photo", "video", "audio", "document"]),
  storage_path: z.string().min(1, "Chemin de stockage requis"),
  file_name: z.string().min(1),
  mime_type: z.string().optional(),
  file_size: z.number().int().positive().optional(),
  metadata: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(),
    geolocation: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
    captured_at: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Complete EDL item assessment
 */
export const UpdateEDLItemSchema = z.object({
  etat: z.enum(["neuf", "tres_bon", "bon", "moyen", "mauvais", "hors_service"]).optional(),
  proprete: z.enum(["propre", "acceptable", "sale"]).optional(),
  fonctionnement: z.enum(["fonctionne", "partiel", "ne_fonctionne_pas", "non_applicable"]).optional(),
  commentaire: z.string().max(1000).optional(),
  quantite: z.number().int().min(0).optional(),
});

/**
 * Sign/validate EDL
 */
export const SignEDLSchema = z.object({
  role: z.enum(["owner", "tenant", "manager", "witness"]),
  signature_data: z.string().min(1, "Signature requise"),
  signature_level: SignatureLevelEnum.default("SES"),
  ip_address: z.string().ip().optional(),
  device_info: z.string().optional(),
});

/**
 * Complete/finalize EDL
 */
export const CompleteEDLSchema = z.object({
  observations_generales: z.string().max(2000).optional(),
  releves_compteurs: z.array(z.object({
    type: z.enum(["electricity", "gas", "water"]),
    meter_id: z.string().uuid().optional(),
    index_value: z.number().nonnegative(),
    photo_path: z.string().optional(),
  })).optional(),
  cles_remises: z.array(z.object({
    type: z.string(),
    quantite: z.number().int().positive(),
    description: z.string().optional(),
  })).optional(),
});

/**
 * Compare entry/exit EDL
 */
export const CompareEDLSchema = z.object({
  edl_entree_id: z.string().uuid(),
  edl_sortie_id: z.string().uuid(),
  auto_calculate_deductions: z.boolean().default(true),
});

// ==========================================
// ROOMMATE / COLOCATION SCHEMAS (P3)
// ==========================================

/**
 * Add a roommate to a unit/colocation
 */
export const CreateRoommateSchema = z.object({
  unit_id: z.string().uuid(),
  profile_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  role: z.enum(["principal", "colocataire", "occupant", "sous_locataire"]).default("colocataire"),
  share_percentage: z.number().min(0).max(100).optional(),
  date_entree: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  date_sortie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
}).refine(
  (data) => data.profile_id || data.email,
  "profile_id ou email requis"
);

/**
 * Update roommate info
 */
export const UpdateRoommateSchema = z.object({
  role: z.enum(["principal", "colocataire", "occupant", "sous_locataire"]).optional(),
  share_percentage: z.number().min(0).max(100).optional(),
  date_sortie: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_active: z.boolean().optional(),
});

/**
 * Define payment share for a roommate
 */
export const CreatePaymentShareSchema = z.object({
  roommate_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  montant: z.number().positive("Montant positif requis"),
  pourcentage: z.number().min(0).max(100).optional(),
});

/**
 * Define deposit share for a roommate
 */
export const CreateDepositShareSchema = z.object({
  roommate_id: z.string().uuid(),
  lease_id: z.string().uuid(),
  montant: z.number().nonnegative(),
  statut: z.enum(["pending", "paid", "refunded", "partial_refund"]).default("pending"),
});

/**
 * Invite roommate by email
 */
export const InviteRoommateSchema = z.object({
  unit_id: z.string().uuid(),
  email: z.string().email("Email invalide"),
  prenom: z.string().min(1).optional(),
  nom: z.string().min(1).optional(),
  role: z.enum(["colocataire", "occupant"]).default("colocataire"),
  share_percentage: z.number().min(0).max(100).optional(),
  message: z.string().max(500).optional(),
});

// ==========================================
// EXPANDED METER SCHEMAS (P3)
// ==========================================

/**
 * Update meter info
 */
export const UpdateMeterSchema = z.object({
  type: z.enum(["electricity", "gas", "water", "heating", "cold_water", "hot_water"]).optional(),
  meter_number: z.string().optional(),
  provider: z.string().optional(),
  location: z.string().optional(),
  is_active: z.boolean().optional(),
  metadata: z.object({
    brand: z.string().optional(),
    model: z.string().optional(),
    installation_date: z.string().datetime().optional(),
    next_verification: z.string().datetime().optional(),
  }).optional(),
});

/**
 * Create meter reading with optional photo
 */
export const CreateMeterReadingWithPhotoSchema = z.object({
  meter_id: z.string().uuid(),
  reading_value: z.number().nonnegative("Valeur positive requise"),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["manual", "api", "ocr", "smart_meter"]).default("manual"),
  photo_path: z.string().optional(),
  notes: z.string().max(500).optional(),
  validated: z.boolean().default(false),
});

/**
 * Bulk meter readings (for EDL)
 */
export const BulkMeterReadingsSchema = z.object({
  readings: z.array(z.object({
    meter_id: z.string().uuid(),
    reading_value: z.number().nonnegative(),
    photo_path: z.string().optional(),
  })).min(1),
  reading_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["manual", "edl_entree", "edl_sortie"]).default("manual"),
});

// ==========================================
// EXPANDED CHARGE SCHEMAS (P3)
// ==========================================

/**
 * Update charge info
 */
export const UpdateChargeSchema = z.object({
  type: z.enum(["eau", "electricite", "gaz", "copro", "taxe", "ordures", "assurance", "travaux", "entretien", "autre"]).optional(),
  montant: z.number().positive().optional(),
  periodicite: z.enum(["mensuelle", "trimestrielle", "semestrielle", "annuelle", "ponctuelle"]).optional(),
  refacturable_locataire: z.boolean().optional(),
  description: z.string().max(500).optional(),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/**
 * Record charge payment
 */
export const ChargePaymentSchema = z.object({
  charge_id: z.string().uuid(),
  montant: z.number().positive("Montant positif requis"),
  date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moyen: z.enum(["cb", "virement", "prelevement", "cheque", "especes"]),
  reference: z.string().optional(),
});

/**
 * Create recurring charge
 */
export const CreateRecurringChargeSchema = z.object({
  property_id: z.string().uuid(),
  type: z.enum(["eau", "electricite", "gaz", "copro", "taxe", "ordures", "assurance", "travaux", "entretien", "autre"]),
  libelle: z.string().min(1, "Libellé requis"),
  montant: z.number().positive("Montant positif requis"),
  periodicite: z.enum(["mensuelle", "trimestrielle", "semestrielle", "annuelle"]),
  jour_prelevement: z.number().int().min(1).max(28).default(5),
  refacturable_locataire: z.boolean().default(false),
  pourcentage_refacturable: z.number().min(0).max(100).default(100),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/**
 * Charge regularization (régularisation annuelle)
 */
export const ChargeRegularizationSchema = z.object({
  lease_id: z.string().uuid(),
  periode_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periode_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  charges_reelles: z.number().nonnegative(),
  provisions_versees: z.number().nonnegative(),
  detail_charges: z.array(z.object({
    type: z.string(),
    montant_reel: z.number().nonnegative(),
    quote_part: z.number().min(0).max(100),
  })).optional(),
});

// ==========================================
// WORK ORDER SCHEMAS (P3)
// ==========================================

/**
 * Create work order from ticket
 */
export const CreateWorkOrderSchema = z.object({
  ticket_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  description: z.string().min(10, "Description: 10 caractères minimum"),
  budget_max: z.number().positive().optional(),
  date_intervention: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  urgence: z.enum(["normale", "urgente", "tres_urgente"]).default("normale"),
});

/**
 * Update work order status
 */
export const UpdateWorkOrderSchema = z.object({
  status: z.enum(["pending", "accepted", "scheduled", "in_progress", "completed", "cancelled"]).optional(),
  date_intervention: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
  completion_report: z.string().optional(),
  actual_cost: z.number().nonnegative().optional(),
});

/**
 * Accept/reject quote
 */
export const QuoteResponseSchema = z.object({
  accepted: z.boolean(),
  rejection_reason: z.string().max(500).optional(),
  negotiated_amount: z.number().positive().optional(),
});

// ==========================================
// P4: EVENT SOURCING & AUDIT SCHEMAS (SOTA 2026)
// ==========================================

/**
 * Actor types for audit events
 */
export const AuditActorTypeEnum = z.enum([
  "user",        // Authenticated user action
  "system",      // System/application action
  "webhook",     // External webhook callback
  "cron",        // Scheduled job
  "migration",   // Database migration
  "admin",       // Admin override
  "anonymous"    // Unauthenticated action
]);

/**
 * Event categories for audit grouping
 */
export const AuditEventCategoryEnum = z.enum([
  "auth",          // Authentication events
  "property",      // Property management
  "lease",         // Lease lifecycle
  "signature",     // Signature events
  "inspection",    // EDL events
  "financial",     // Invoices, payments
  "tenant",        // Tenant management
  "ticket",        // Support tickets
  "document",      // Document operations
  "communication", // Messages, notifications
  "admin",         // Admin operations
  "gdpr",          // Privacy/GDPR events
  "system"         // System events
]);

/**
 * Record an audit event
 */
export const RecordAuditEventSchema = z.object({
  event_type: z.string().min(3).max(100).regex(/^[a-z_]+\.[a-z_]+$/, "Format: entity.action"),
  event_category: AuditEventCategoryEnum,
  entity_type: z.string().min(1).max(50),
  entity_id: z.string().uuid(),
  entity_name: z.string().max(255).optional(),
  parent_entity_type: z.string().max(50).optional(),
  parent_entity_id: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
  old_values: z.record(z.unknown()).optional(),
  new_values: z.record(z.unknown()).optional(),
});

/**
 * Query entity history
 */
export const GetEntityHistorySchema = z.object({
  entity_type: z.string().min(1).max(50),
  entity_id: z.string().uuid(),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0),
});

/**
 * Query user activity
 */
export const GetUserActivitySchema = z.object({
  user_id: z.string().uuid(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

/**
 * Query audit events with filters
 */
export const QueryAuditEventsSchema = z.object({
  event_type: z.string().optional(),
  event_category: AuditEventCategoryEnum.optional(),
  entity_type: z.string().optional(),
  entity_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  order_by: z.enum(["occurred_at", "created_at", "event_type"]).default("occurred_at"),
  order_dir: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GDPR data export request
 */
export const GDPRExportRequestSchema = z.object({
  user_id: z.string().uuid(),
  include_audit_events: z.boolean().default(true),
  include_profile_data: z.boolean().default(true),
  include_documents: z.boolean().default(false),
  format: z.enum(["json", "csv"]).default("json"),
});

/**
 * GDPR data erasure request
 */
export const GDPREraseRequestSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(10).max(500),
  confirm_erasure: z.literal(true, {
    errorMap: () => ({ message: "Vous devez confirmer la suppression" }),
  }),
  preserve_legal_required: z.boolean().default(true),
});

/**
 * Audit dashboard date range
 */
export const AuditDashboardQuerySchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  categories: z.array(AuditEventCategoryEnum).optional(),
  group_by: z.enum(["day", "week", "month"]).default("day"),
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

// P3 Signature types
export type CreateSignatureSessionInput = z.infer<typeof CreateSignatureSessionSchema>;
export type AddSignatureParticipantInput = z.infer<typeof AddSignatureParticipantSchema>;
export type RecordSignatureProofInput = z.infer<typeof RecordSignatureProofSchema>;

// P3 EDL types
export type CreateEDLRoomInput = z.infer<typeof CreateEDLRoomSchema>;
export type AddEDLMediaInput = z.infer<typeof AddEDLMediaSchema>;
export type SignEDLInput = z.infer<typeof SignEDLSchema>;
export type CompleteEDLInput = z.infer<typeof CompleteEDLSchema>;

// P3 Roommate types
export type CreateRoommateInput = z.infer<typeof CreateRoommateSchema>;
export type UpdateRoommateInput = z.infer<typeof UpdateRoommateSchema>;
export type InviteRoommateInput = z.infer<typeof InviteRoommateSchema>;

// P3 Meter types
export type CreateMeterReadingWithPhotoInput = z.infer<typeof CreateMeterReadingWithPhotoSchema>;
export type BulkMeterReadingsInput = z.infer<typeof BulkMeterReadingsSchema>;

// P3 Charge types
export type CreateRecurringChargeInput = z.infer<typeof CreateRecurringChargeSchema>;
export type ChargeRegularizationInput = z.infer<typeof ChargeRegularizationSchema>;

// P3 Work Order types
export type CreateWorkOrderInput = z.infer<typeof CreateWorkOrderSchema>;
export type QuoteResponseInput = z.infer<typeof QuoteResponseSchema>;

// P4 Audit types
export type RecordAuditEventInput = z.infer<typeof RecordAuditEventSchema>;
export type GetEntityHistoryInput = z.infer<typeof GetEntityHistorySchema>;
export type GetUserActivityInput = z.infer<typeof GetUserActivitySchema>;
export type QueryAuditEventsInput = z.infer<typeof QueryAuditEventsSchema>;
export type GDPRExportRequestInput = z.infer<typeof GDPRExportRequestSchema>;
export type GDPREraseRequestInput = z.infer<typeof GDPREraseRequestSchema>;
export type AuditDashboardQueryInput = z.infer<typeof AuditDashboardQuerySchema>;

