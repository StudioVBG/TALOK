// Schémas Zod pour l'onboarding
import { z } from "zod";

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)");

// Validation du mot de passe (12+ caractères, 1 maj/min/chiffre/spécial)
export const passwordSchema = z
  .string()
  .min(12, "Le mot de passe doit contenir au moins 12 caractères")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial");

// Étape 1 : Choix du rôle
export const roleChoiceSchema = z.object({
  role: z.enum(["owner", "tenant", "provider", "guarantor"]),
  property_code: z.string().optional(),
});

// Étape 2 : Création de compte
export const accountCreationSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis").max(80, "Maximum 80 caractères"),
  nom: z.string().min(1, "Le nom est requis").max(80, "Maximum 80 caractères"),
  email: z
    .string()
    .email("Email invalide")
    .transform((val) => val.toLowerCase()),
  password: passwordSchema.optional(),
  useMagicLink: z.boolean().default(false),
  accept_cgu: z
    .boolean()
    .refine((val) => val === true, "Vous devez accepter les conditions d'utilisation"),
  accept_privacy: z
    .boolean()
    .refine((val) => val === true, "Vous devez accepter la politique de confidentialité"),
});

// Étape 3 : Vérification d'email
export const emailVerificationSchema = z.object({
  token: z.string().min(1, "Token requis"),
});

// Étape 4 : Consentements
export const consentsSchema = z.object({
  terms_version: z.string().min(1, "Version des CGU requise"),
  privacy_version: z.string().min(1, "Version de la politique requise"),
  terms_accepted: z.boolean().refine((val) => val === true, "Vous devez accepter les CGU"),
  privacy_accepted: z.boolean().refine((val) => val === true, "Vous devez accepter la politique de confidentialité"),
  cookies_necessary: z.boolean().default(true), // Verrouillé
  cookies_analytics: z.boolean().default(false),
  cookies_ads: z.boolean().default(false),
});

// Étape 5 : Profil minimal
export const minimalProfileSchema = z
  .object({
    prenom: z.string().min(1, "Le prénom est requis"),
    nom: z.string().min(1, "Le nom est requis"),
    country_code: z.enum(["FR", "GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF"]),
    telephone: z.string().optional().nullable(),
  })
  .transform((data) => {
    // Normaliser le téléphone si fourni
    // La détection automatique du pays se fait dans normalizePhoneToE164
    let normalizedPhone: string | null = null;
    
    if (data.telephone && data.telephone.trim() !== "") {
      const { normalizePhoneToE164 } = require("@/lib/utils/phone");
      // Utiliser le country_code fourni pour la normalisation
      // Si le numéro commence déjà par +, le country_code sera ignoré
      normalizedPhone = normalizePhoneToE164(data.telephone, data.country_code);
      
      if (normalizedPhone === null) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: "Format téléphone invalide. Utilisez le format français (ex: 0696614049) ou international (ex: +33696614049 ou +596696614049)",
            path: ["telephone"],
          },
        ]);
      }
    }
    
    return {
      ...data,
      telephone: normalizedPhone,
    };
  })
  .pipe(
    z.object({
      prenom: z.string(),
      nom: z.string(),
      country_code: z.enum(["FR", "GP", "MQ", "GF", "RE", "YT", "PM", "BL", "MF"]),
      telephone: z
        .union([
          z.string().regex(/^\+[1-9]\d{1,14}$/, "Format téléphone invalide (E.164 requis)"),
          z.null(),
        ])
        .optional(),
    })
  );

// ONBOARDING PROPRIÉTAIRE

// Owner-1 : Profil propriétaire
export const ownerProfileOnboardingSchema = z.object({
  type: z.enum(["particulier", "societe"]),
  raison_sociale: z.string().optional(),
  siren: z
    .string()
    .regex(/^[0-9]{9}$/, "Le SIREN doit contenir 9 chiffres")
    .optional()
    .nullable(),
  siret: z
    .string()
    .regex(/^[0-9]{14}$/, "Le SIRET doit contenir 14 chiffres")
    .optional()
    .nullable(),
  tva: z.string().optional().nullable(),
  ubo: z.string().optional().nullable(), // UBO (Ultimate Beneficial Owner)
});

// Owner-2 : Paramètres financiers
export const ownerFinanceSchema = z.object({
  // Encaissements (locataire → propriétaire)
  encaissement_prefere: z.enum(["sepa_sdd", "virement_sct", "virement_inst", "pay_by_bank", "carte_wallet"]),
  encaissement_secondaires: z.array(z.enum(["sepa_sdd", "virement_sct", "virement_inst", "pay_by_bank", "carte_wallet"])).default([]),
  sepa_mandat_type: z.enum(["core", "b2b"]).optional(),
  sepa_rum: z.string().optional(), // RUM (Référence Unique de Mandat)
  
  // Versements (plateforme → propriétaire)
  payout_iban: z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/, "Format IBAN invalide"),
  payout_frequence: z.enum(["immediat", "hebdo", "mensuel", "seuil"]),
  payout_jour: z.number().int().min(1).max(28).optional(), // Pour mensuel
  payout_seuil: z.number().positive().optional(), // Pour seuil
  payout_rail: z.enum(["sct", "sct_inst"]),
});

// Owner-3 : Premier logement
// Utilise les schémas partiels réutilisables pour éviter la duplication
import { addressSchema, financialSchema, dpeSchema, permisLouerSchema } from "./schemas-shared";

export const firstPropertySchema = addressSchema
  .merge(financialSchema.pick({ charges_mensuelles: true, depot_garantie: true, zone_encadrement: true, loyer_reference_majoré: true, complement_loyer: true, complement_justification: true }))
  .merge(dpeSchema)
  .merge(permisLouerSchema)
  .extend({
    // Champs spécifiques à l'onboarding
    loyer_base: z.number().positive("Le loyer hors charges est requis"), // Alias pour loyer_hc
  type: z.enum([
    "appartement",
    "maison",
    "immeuble",
    "local_commercial",
    "bureaux",
    "entrepot",
    "parking",
    "fonds_de_commerce",
  ]),
  surface: z.number().positive("La surface doit être positive"),
  nb_pieces: z.number().int().positive("Le nombre de pièces doit être positif"),
  is_colocation: z.boolean().default(false),
  // Si colocation
  unit_nom: z.string().optional(),
  unit_capacite_max: z.number().int().min(1).max(10).optional(),
  unit_surface: z.number().positive().optional(),
});

// Owner-4 : Niveau d'automatisation
export const ownerAutomationSchema = z.object({
  automation_level: z.enum(["basique", "standard", "pro", "autopilot"]),
  modules_overrides: z
    .object({
      relances: z.boolean().optional(),
      quittances: z.boolean().optional(),
      irl: z.boolean().optional(), // Impôt sur les revenus locatifs
      maintenance: z.boolean().optional(),
      compta: z.boolean().optional(),
    })
    .optional(),
});

// Owner-5 : Invitations
export const ownerInviteSchema = z.object({
  emails: z.array(z.string().email("Email invalide")).min(1, "Au moins un email requis"),
  role: z.enum(["locataire_principal", "colocataire", "garant"]),
  unit_id: z.string().uuid().optional(),
  lease_id: z.string().uuid().optional(),
});

// ONBOARDING LOCATAIRE

// Tenant-1 : Contexte logement
export const tenantContextSchema = z.object({
  code_logement: z.string().min(1, "Code logement requis").optional(),
  invite_token: z.string().optional(),
  role: z.enum(["locataire_principal", "colocataire", "garant"]),
});

// Tenant-2 : Dossier locataire
export const tenantFileSchema = z.object({
  situation_pro: z.string().optional().nullable(),
  revenus_mensuels: z.number().positive("Les revenus doivent être positifs").optional().nullable(),
  nb_adultes: z.number().int().min(1, "Au moins un adulte requis"),
  nb_enfants: z.number().int().min(0, "Le nombre d'enfants ne peut pas être négatif"),
  garant_required: z.boolean(),
  // Uploads (gérés séparément via Storage)
  piece_identite_path: z.string().optional(),
  justificatif_revenus_path: z.string().optional(),
  visale_path: z.string().optional(),
});

// Tenant-3 : Paiement & parts (coloc)
export const tenantPaymentSchema = z.object({
  moyen_encaissement: z.enum(["sepa_sdd", "virement_sct", "virement_inst", "pay_by_bank", "carte_wallet"]),
  sepa_mandat_accepte: z.boolean().optional(),
  stripe_payment_method_id: z.string().optional(),
  // Pour colocation
  part_percentage: z.number().min(0).max(100).optional(),
  part_montant: z.number().positive().optional(),
});

// Tenant-4 : Signature du bail
export const tenantSignLeaseSchema = z.object({
  lease_id: z.string().uuid(),
  signature_payload: z.string().min(1, "Signature requise"), // Signature eIDAS/SES
  depot_garantie_moyen: z.enum(["carte", "pay_by_bank", "virement"]).optional(),
  edl_entree_date: isoDateString.optional(),
  edl_entree_heure: z.string().optional(),
});

// ONBOARDING GARANT

// Guarantor-1 : Contexte & identité
export const guarantorContextSchema = z.object({
  invite_token: z.string().min(1, "Token d'invitation requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  date_naissance: isoDateString,
  piece_identite_path: z.string().optional(),
});

// Guarantor-2 : Capacité financière
export const guarantorFinancialSchema = z.object({
  revenus_mensuels: z.number().positive("Les revenus doivent être positifs"),
  type_garantie: z.enum(["personnelle", "visale", "depot_bancaire"]),
  justificatif_revenus_path: z.string().optional(),
  visale_path: z.string().optional(),
  depot_bancaire_montant: z.number().positive().optional(),
});

// Guarantor-3 : Signature de l'acte
export const guarantorSignSchema = z.object({
  lease_id: z.string().uuid(),
  signature_payload: z.string().min(1, "Signature requise"),
});

// ONBOARDING PRESTATAIRE

// Provider-1 : Profil pro
export const providerProfileOnboardingSchema = z.object({
  type: z.enum(["entreprise", "independant"]),
  raison_sociale: z.string().min(1, "La raison sociale est requise"),
  siren: z
    .string()
    .regex(/^[0-9]{9}$/, "Le SIREN doit contenir 9 chiffres")
    .optional()
    .nullable(),
  siret: z
    .string()
    .regex(/^[0-9]{14}$/, "Le SIRET doit contenir 14 chiffres")
    .optional()
    .nullable(),
  rc_pro_path: z.string().optional(), // Upload RC Pro
});

// Provider-2 : Services & zones
export const providerServicesSchema = z.object({
  specialites: z.array(z.string()).min(1, "Au moins une spécialité requise"),
  zones_cp: z.array(z.string().regex(/^[0-9]{5}$/)).optional(),
  zones_ville: z.array(z.string()).optional(),
  zones_rayon: z.number().positive().optional(), // Rayon en km
  tarifs: z
    .record(
      z.object({
        type: z.enum(["horaire", "forfait", "devis"]),
        montant: z.number().positive(),
      })
    )
    .optional(),
});

// Provider-3 : Dispos & paiements
export const providerOpsSchema = z.object({
  jours_disponibles: z.array(z.enum(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"])),
  horaires_debut: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  horaires_fin: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  sla_souhaite: z.enum(["24h", "48h", "72h", "semaine"]),
  payout_iban: z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/, "Format IBAN invalide"),
  kyc_complete: z.boolean().default(false),
});

// Schéma pour le brouillon d'onboarding
export const onboardingDraftSchema = z.object({
  step: z.string(),
  data: z.record(z.unknown()),
  role: z.enum(["owner", "tenant", "provider", "guarantor"]).optional(),
});

