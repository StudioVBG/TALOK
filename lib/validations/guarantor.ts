/**
 * Schémas de validation Zod pour le module Garant
 */

import { z } from "zod";

// ============================================
// ENUMS
// ============================================

export const guarantorRelationEnum = z.enum([
  "parent",
  "grand_parent",
  "oncle_tante",
  "frere_soeur",
  "employeur",
  "ami",
  "autre",
]);

export const guarantorSituationProEnum = z.enum([
  "cdi",
  "cdd",
  "fonctionnaire",
  "independant",
  "retraite",
  "profession_liberale",
  "chef_entreprise",
  "autre",
]);

export const cautionTypeEnum = z.enum(["simple", "solidaire"]);

export const engagementStatusEnum = z.enum([
  "pending_signature",
  "active",
  "terminated",
  "called",
  "released",
]);

export const guarantorDocumentTypeEnum = z.enum([
  "piece_identite",
  "justificatif_domicile",
  "avis_imposition",
  "bulletins_salaire",
  "contrat_travail",
  "attestation_employeur",
  "releve_bancaire",
  "titre_propriete",
  "acte_caution_signe",
  "autre",
]);

export const paymentIncidentTypeEnum = z.enum([
  "late_payment",
  "unpaid",
  "partial_payment",
  "call_caution",
]);

// ============================================
// PROFIL GARANT
// ============================================

export const createGuarantorProfileSchema = z.object({
  relation_to_tenant: guarantorRelationEnum,
  relation_details: z.string().max(255).optional().nullable(),
  
  // Situation professionnelle
  situation_pro: guarantorSituationProEnum.optional().nullable(),
  employeur_nom: z.string().max(255).optional().nullable(),
  employeur_adresse: z.string().max(500).optional().nullable(),
  anciennete_mois: z.number().int().min(0).max(600).optional().nullable(),
  
  // Informations financières
  revenus_mensuels_nets: z
    .number()
    .min(0, "Les revenus ne peuvent pas être négatifs")
    .max(1000000, "Montant maximum dépassé")
    .optional()
    .nullable(),
  revenus_fonciers: z.number().min(0).default(0),
  autres_revenus: z.number().min(0).default(0),
  charges_mensuelles: z.number().min(0).default(0),
  credits_en_cours: z.number().min(0).default(0),
  
  // Patrimoine
  est_proprietaire: z.boolean().default(false),
  valeur_patrimoine_immobilier: z.number().min(0).optional().nullable(),
  
  // Adresse
  adresse_complete: z.string().max(500).optional().nullable(),
  code_postal: z
    .string()
    .regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres")
    .optional()
    .nullable(),
  ville: z.string().max(255).optional().nullable(),
});

// Schéma update défini explicitement pour éviter les problèmes webpack avec .partial()
export const updateGuarantorProfileSchema = z.object({
  relation_to_tenant: guarantorRelationEnum.optional(),
  relation_details: z.string().max(255).optional().nullable(),
  situation_pro: guarantorSituationProEnum.optional().nullable(),
  employeur_nom: z.string().max(255).optional().nullable(),
  employeur_adresse: z.string().max(500).optional().nullable(),
  anciennete_mois: z.number().int().min(0).max(600).optional().nullable(),
  revenus_mensuels_nets: z.number().min(0).max(1000000).optional().nullable(),
  revenus_fonciers: z.number().min(0).optional(),
  autres_revenus: z.number().min(0).optional(),
  charges_mensuelles: z.number().min(0).optional(),
  credits_en_cours: z.number().min(0).optional(),
  est_proprietaire: z.boolean().optional(),
  valeur_patrimoine_immobilier: z.number().min(0).optional().nullable(),
  adresse_complete: z.string().max(500).optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/).optional().nullable(),
  ville: z.string().max(255).optional().nullable(),
  consent_garant: z.boolean().optional(),
  consent_data_processing: z.boolean().optional(),
});

export type CreateGuarantorProfileInput = z.infer<typeof createGuarantorProfileSchema>;
export type UpdateGuarantorProfileInput = z.infer<typeof updateGuarantorProfileSchema>;

// ============================================
// ENGAGEMENT / CAUTION
// ============================================

export const createEngagementSchema = z.object({
  guarantor_profile_id: z.string().uuid("ID garant invalide"),
  lease_id: z.string().uuid("ID bail invalide"),
  tenant_profile_id: z.string().uuid("ID locataire invalide"),
  caution_type: cautionTypeEnum.default("solidaire"),
  montant_garanti: z
    .number()
    .min(0, "Le montant ne peut pas être négatif")
    .optional()
    .nullable(),
  duree_engagement_mois: z
    .number()
    .int()
    .min(1, "La durée minimum est de 1 mois")
    .max(120, "La durée maximum est de 10 ans")
    .optional()
    .nullable(),
});

export const updateEngagementSchema = z.object({
  status: engagementStatusEnum.optional(),
  montant_garanti: z.number().min(0).optional().nullable(),
  called_amount: z.number().min(0).optional().nullable(),
  called_reason: z.string().max(1000).optional().nullable(),
  released_reason: z.string().max(1000).optional().nullable(),
});

export type CreateEngagementInput = z.infer<typeof createEngagementSchema>;
export type UpdateEngagementInput = z.infer<typeof updateEngagementSchema>;

// ============================================
// DOCUMENTS
// ============================================

export const uploadGuarantorDocumentSchema = z.object({
  document_type: guarantorDocumentTypeEnum,
  original_filename: z.string().min(1).max(255),
  mime_type: z.string().optional(),
  file_size: z.number().int().min(1).max(10 * 1024 * 1024), // Max 10MB
});

export const verifyDocumentSchema = z.object({
  is_verified: z.boolean(),
  rejection_reason: z.string().max(500).optional().nullable(),
});

export type UploadGuarantorDocumentInput = z.infer<typeof uploadGuarantorDocumentSchema>;
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;

// ============================================
// INCIDENTS DE PAIEMENT
// ============================================

export const createPaymentIncidentSchema = z.object({
  engagement_id: z.string().uuid("ID engagement invalide"),
  invoice_id: z.string().uuid("ID facture invalide"),
  incident_type: paymentIncidentTypeEnum,
  amount_due: z.number().min(0, "Le montant doit être positif"),
  days_late: z.number().int().min(0).optional().nullable(),
});

export const resolveIncidentSchema = z.object({
  resolved_by: z.enum(["tenant", "guarantor", "owner"]),
  resolution_notes: z.string().max(1000).optional().nullable(),
});

export type CreatePaymentIncidentInput = z.infer<typeof createPaymentIncidentSchema>;
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;

// ============================================
// VALIDATION COMPLÈTE PROFIL
// ============================================

/**
 * Schéma pour valider un profil garant complet (avec tous les documents requis)
 */
export const completeGuarantorProfileSchema = createGuarantorProfileSchema.extend({
  revenus_mensuels_nets: z
    .number()
    .min(1, "Les revenus sont requis pour un profil complet"),
  situation_pro: guarantorSituationProEnum,
  adresse_complete: z.string().min(1, "L'adresse est requise"),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Code postal invalide"),
  ville: z.string().min(1, "La ville est requise"),
}).refine(
  (data) => {
    // Vérifier que les revenus totaux sont suffisants (au moins 1000€)
    const totalIncome = 
      (data.revenus_mensuels_nets || 0) + 
      (data.revenus_fonciers || 0) + 
      (data.autres_revenus || 0);
    return totalIncome >= 1000;
  },
  {
    message: "Les revenus totaux doivent être d'au moins 1000€/mois",
    path: ["revenus_mensuels_nets"],
  }
);

// ============================================
// MESSAGES D'ERREUR PERSONNALISÉS
// ============================================

export const GUARANTOR_VALIDATION_MESSAGES = {
  relation_required: "La relation avec le locataire est requise",
  income_required: "Les revenus mensuels sont requis",
  income_insufficient: "Les revenus sont insuffisants pour se porter garant",
  documents_incomplete: "Tous les documents requis doivent être fournis",
  consent_required: "Vous devez accepter les conditions de cautionnement",
  address_required: "L'adresse complète est requise",
};







