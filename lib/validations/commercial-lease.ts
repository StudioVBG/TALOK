/**
 * Validations Zod pour les baux commerciaux
 * Conforme au Code de commerce (Articles L145-1 à L145-60)
 */

import { z } from "zod";

// =============================================================================
// ENUMS ET CONSTANTES
// =============================================================================

export const CommercialLeaseTypeEnum = z.enum([
  "commercial",
  "commercial_derogatoire",
  "professionnel",
]);

export const CommercialIndexTypeEnum = z.enum(["ILC", "ILAT", "ICC"]);

export const PasDePorteNatureEnum = z.enum(["supplement_loyer", "indemnite"]);

export const GarantieBancaireTypeEnum = z.enum([
  "garantie_premiere_demande",
  "caution_bancaire",
  "lettre_intention",
]);

// =============================================================================
// SCHEMAS DE BASE
// =============================================================================

/**
 * Destination des locaux (clause essentielle)
 */
export const DestinationClauseSchema = z.object({
  activite_principale: z
    .string()
    .min(5, "L'activité principale doit être décrite (min 5 caractères)")
    .max(500, "Description trop longue"),
  activites_connexes: z.string().max(500).optional(),
  clause_tous_commerces: z.boolean().default(false),
  despecialisation_partielle_autorisee: z.boolean().default(true),
  code_ape: z
    .string()
    .regex(/^\d{2}\.\d{2}[A-Z]?$/, "Format code APE invalide (ex: 47.11F)")
    .optional(),
});

/**
 * Indexation du loyer commercial
 */
export const IndexationClauseSchema = z.object({
  indice_type: CommercialIndexTypeEnum,
  indice_base: z.number().positive("L'indice de base doit être positif"),
  indice_trimestre_base: z
    .string()
    .regex(
      /^T[1-4]\s\d{4}$/,
      "Format trimestre invalide (ex: T1 2026)"
    ),
  plafonnement_revision: z.boolean().default(true),
});

/**
 * Pas-de-porte / Droit d'entrée
 */
export const PasDePorteSchema = z.object({
  montant_ht: z
    .number()
    .nonnegative("Le montant ne peut pas être négatif"),
  nature: PasDePorteNatureEnum,
  tva_applicable: z.boolean().default(true),
  tva_montant: z.number().nonnegative().optional(),
  modalites_paiement: z.string().max(500).optional(),
});

/**
 * Garantie bancaire
 */
export const GarantieBancaireSchema = z.object({
  type: GarantieBancaireTypeEnum,
  montant: z.number().positive("Le montant de la garantie doit être positif"),
  etablissement: z.string().min(2, "Nom de l'établissement requis"),
  duree_mois: z
    .number()
    .int()
    .positive("La durée doit être positive"),
  date_emission: z.string().datetime().optional(),
  date_expiration: z.string().datetime().optional(),
});

/**
 * Caution solidaire
 */
export const CautionSolidaireSchema = z.object({
  is_societe: z.boolean(),
  nom: z.string().min(2, "Nom de la caution requis"),
  siret: z
    .string()
    .regex(/^\d{14}$/, "SIRET invalide (14 chiffres)")
    .optional(),
  adresse: z.string().min(10, "Adresse complète requise"),
  montant_engagement: z
    .number()
    .positive("Le montant d'engagement doit être positif"),
  duree_mois: z
    .number()
    .int()
    .positive("La durée doit être positive"),
});

/**
 * Répartition des charges (Loi Pinel)
 */
export const RepartitionChargesSchema = z.object({
  taxe_fonciere_preneur: z.boolean().default(false),
  taxe_bureaux_preneur: z.boolean().default(false),
  charges_copro_fonct_preneur: z.boolean().default(true),
  // Les gros travaux art. 606 sont toujours à la charge du bailleur (non modifiable)
});

// =============================================================================
// SCHEMA PRINCIPAL: BAIL COMMERCIAL 3/6/9
// =============================================================================

export const CommercialLeaseDetailsSchema = z.object({
  // Destination
  destination: DestinationClauseSchema,

  // Durée
  duree_annees: z
    .number()
    .int()
    .min(9, "Un bail commercial doit avoir une durée minimale de 9 ans")
    .default(9),
  renonciation_triennale: z.boolean().default(false),
  renonciation_motif: z
    .string()
    .max(500)
    .optional()
    .refine(
      (val, ctx) => {
        // @ts-ignore
        if (ctx.parent?.renonciation_triennale && !val) {
          return false;
        }
        return true;
      },
      { message: "Le motif de renonciation est requis" }
    ),

  // Loyer
  loyer_annuel_ht: z
    .number()
    .positive("Le loyer annuel HT doit être positif"),
  tva_applicable: z.boolean().default(true),
  tva_taux: z
    .number()
    .min(0)
    .max(100)
    .default(20),

  // Indexation
  indexation: IndexationClauseSchema,

  // Pas-de-porte (optionnel)
  pas_de_porte: PasDePorteSchema.optional(),

  // Droit au bail
  droit_au_bail_valeur: z.number().nonnegative().optional(),

  // Garanties
  garantie_bancaire: GarantieBancaireSchema.optional(),
  caution_solidaire: CautionSolidaireSchema.optional(),

  // Cession et sous-location
  cession_libre: z.boolean().default(false),
  droit_preemption_bailleur: z.boolean().default(false),
  sous_location_autorisee: z.boolean().default(false),
  garantie_solidaire_cedant: z.boolean().default(true),
  garantie_cedant_duree_mois: z
    .number()
    .int()
    .min(0)
    .max(36)
    .default(36),

  // Charges
  repartition_charges: RepartitionChargesSchema,

  // Travaux
  accession_ameliorations: z.boolean().default(true),
  travaux_bailleur_liste: z.string().max(2000).optional(),

  // Clause résolutoire
  clause_resolutoire_delai_jours: z
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30),
});

// =============================================================================
// SCHEMA: BAIL DEROGATOIRE
// =============================================================================

export const DerogtoireLeaseDetailsSchema = z.object({
  // Destination
  activite_autorisee: z
    .string()
    .min(5, "L'activité doit être décrite")
    .max(500),
  code_ape: z
    .string()
    .regex(/^\d{2}\.\d{2}[A-Z]?$/)
    .optional(),

  // Durée - CRITIQUE: max 36 mois cumulés
  duree_mois: z
    .number()
    .int()
    .min(1, "La durée minimale est de 1 mois")
    .max(36, "La durée maximale d'un bail dérogatoire est de 36 mois"),

  // Historique des baux antérieurs (pour vérifier le cumul)
  duree_cumulee_anterieure_mois: z
    .number()
    .int()
    .min(0)
    .max(35)
    .default(0),

  // Loyer
  loyer_mensuel_ht: z
    .number()
    .positive("Le loyer mensuel HT doit être positif"),
  tva_applicable: z.boolean().default(true),
  tva_taux: z.number().min(0).max(100).default(20),

  // Révision (souvent pas de révision pour bail court)
  revision_autorisee: z.boolean().default(false),
  indice_type: CommercialIndexTypeEnum.optional(),
  indice_base: z.number().positive().optional(),

  // Dépôt de garantie
  depot_garantie: z.number().nonnegative(),
  depot_nb_mois: z.number().nonnegative(),

  // Résiliation anticipée
  resiliation_anticipee_preneur: z.boolean().default(false),
  preavis_resiliation_mois: z.number().int().min(0).max(6).optional(),

  // Charges
  charges_copro_preneur: z.boolean().default(true),
}).refine(
  (data) => {
    // Vérifier que le cumul ne dépasse pas 36 mois
    const totalMois = data.duree_cumulee_anterieure_mois + data.duree_mois;
    return totalMois <= 36;
  },
  {
    message:
      "La durée cumulée des baux dérogatoires ne peut excéder 36 mois (3 ans)",
    path: ["duree_mois"],
  }
);

// =============================================================================
// SCHEMA: CRÉATION BAIL COMMERCIAL COMPLET
// =============================================================================

export const CreateCommercialLeaseSchema = z.discriminatedUnion("type_bail", [
  z.object({
    type_bail: z.literal("commercial"),
    // Informations générales
    property_id: z.string().uuid(),
    start_date: z.string().datetime(),

    // Parties
    bailleur: z.object({
      is_societe: z.boolean(),
      nom_complet: z.string().min(2),
      raison_sociale: z.string().optional(),
      siret: z.string().regex(/^\d{14}$/).optional(),
      adresse: z.string().min(10),
      tva_intra: z.string().optional(),
    }),
    preneur: z.object({
      is_societe: z.boolean(),
      nom_complet: z.string().min(2),
      raison_sociale: z.string().optional(),
      siret: z.string().regex(/^\d{14}$/).optional(),
      rcs: z.string().optional(),
      adresse: z.string().min(10),
      tva_intra: z.string().optional(),
    }),

    // Locaux
    locaux: z.object({
      adresse: z.string().min(10),
      code_postal: z.string().regex(/^\d{5}$/),
      ville: z.string().min(2),
      nature: z.string().min(5),
      surface_totale: z.number().positive(),
      surface_vente: z.number().nonnegative().optional(),
      surface_reserve: z.number().nonnegative().optional(),
      surface_bureaux: z.number().nonnegative().optional(),
      etage: z.string().optional(),
      lot_copro: z.string().optional(),
    }),

    // Détails spécifiques
    details: CommercialLeaseDetailsSchema,
  }),

  z.object({
    type_bail: z.literal("commercial_derogatoire"),
    property_id: z.string().uuid(),
    start_date: z.string().datetime(),

    bailleur: z.object({
      is_societe: z.boolean(),
      nom_complet: z.string().min(2),
      raison_sociale: z.string().optional(),
      siret: z.string().regex(/^\d{14}$/).optional(),
      adresse: z.string().min(10),
    }),
    preneur: z.object({
      is_societe: z.boolean(),
      nom_complet: z.string().min(2),
      raison_sociale: z.string().optional(),
      siret: z.string().regex(/^\d{14}$/).optional(),
      rcs: z.string().optional(),
      adresse: z.string().min(10),
    }),

    locaux: z.object({
      adresse: z.string().min(10),
      code_postal: z.string().regex(/^\d{5}$/),
      ville: z.string().min(2),
      nature: z.string().min(5),
      surface_totale: z.number().positive(),
      etage: z.string().optional(),
    }),

    details: DerogtoireLeaseDetailsSchema,
  }),
]);

// =============================================================================
// SCHEMA: RÉVISION DE LOYER
// =============================================================================

export const RentRevisionSchema = z.object({
  lease_id: z.string().uuid(),
  nouvel_indice: z.number().positive("Le nouvel indice doit être positif"),
  date_effet: z.string().datetime(),
  commentaire: z.string().max(500).optional(),
});

// =============================================================================
// SCHEMA: PÉRIODE TRIENNALE
// =============================================================================

export const TriennialPeriodSchema = z.object({
  lease_id: z.string().uuid(),
  period_number: z.number().int().min(1).max(3),
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  resignation_deadline: z.string().datetime(),
  loyer_annuel_ht: z.number().positive().optional(),
});

// =============================================================================
// SCHEMA: HISTORIQUE BAIL DÉROGATOIRE
// =============================================================================

export const DerogtoireHistoryEntrySchema = z.object({
  property_id: z.string().uuid(),
  preneur_type: z.enum(["personne_physique", "personne_morale"]),
  preneur_nom: z.string().min(2),
  preneur_siret: z.string().regex(/^\d{14}$/).optional(),
  lease_id: z.string().uuid().optional(),
  date_debut: z.string().datetime(),
  date_fin: z.string().datetime(),
  duree_mois: z.number().int().positive(),
});

// =============================================================================
// TYPES EXPORTÉS
// =============================================================================

export type CommercialLeaseType = z.infer<typeof CommercialLeaseTypeEnum>;
export type CommercialIndexType = z.infer<typeof CommercialIndexTypeEnum>;
export type DestinationClause = z.infer<typeof DestinationClauseSchema>;
export type IndexationClause = z.infer<typeof IndexationClauseSchema>;
export type PasDePorte = z.infer<typeof PasDePorteSchema>;
export type GarantieBancaire = z.infer<typeof GarantieBancaireSchema>;
export type CautionSolidaire = z.infer<typeof CautionSolidaireSchema>;
export type RepartitionCharges = z.infer<typeof RepartitionChargesSchema>;
export type CommercialLeaseDetails = z.infer<typeof CommercialLeaseDetailsSchema>;
export type DerogtoireLeaseDetails = z.infer<typeof DerogtoireLeaseDetailsSchema>;
export type CreateCommercialLease = z.infer<typeof CreateCommercialLeaseSchema>;
export type RentRevision = z.infer<typeof RentRevisionSchema>;
export type TriennialPeriod = z.infer<typeof TriennialPeriodSchema>;
export type DerogtoireHistoryEntry = z.infer<typeof DerogtoireHistoryEntrySchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Valide que la durée cumulée des baux dérogatoires ne dépasse pas 3 ans
 */
export function validateDerogtoireCumulativeDuration(
  existingMonths: number,
  newDurationMonths: number
): { valid: boolean; remainingMonths: number; error?: string } {
  const total = existingMonths + newDurationMonths;
  const remaining = 36 - total;

  if (total > 36) {
    return {
      valid: false,
      remainingMonths: 36 - existingMonths,
      error: `La durée cumulée (${total} mois) dépasse la limite légale de 36 mois. Il reste ${36 - existingMonths} mois disponibles.`,
    };
  }

  return {
    valid: true,
    remainingMonths: remaining,
  };
}

/**
 * Calcule les dates des périodes triennales
 */
export function calculateTriennialPeriods(startDate: Date): TriennialPeriod[] {
  const periods: Omit<TriennialPeriod, "lease_id" | "loyer_annuel_ht">[] = [];

  for (let i = 1; i <= 3; i++) {
    const periodStart = new Date(startDate);
    periodStart.setFullYear(periodStart.getFullYear() + (i - 1) * 3);

    const periodEnd = new Date(startDate);
    periodEnd.setFullYear(periodEnd.getFullYear() + i * 3);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const resignationDeadline = new Date(periodEnd);
    resignationDeadline.setMonth(resignationDeadline.getMonth() - 6);

    periods.push({
      period_number: i,
      start_date: periodStart.toISOString(),
      end_date: periodEnd.toISOString(),
      resignation_deadline: resignationDeadline.toISOString(),
    });
  }

  return periods as TriennialPeriod[];
}

/**
 * Calcule la révision de loyer selon l'indice
 */
export function calculateRentRevision(
  currentRent: number,
  baseIndex: number,
  newIndex: number
): { newRent: number; variationPercent: number } {
  const newRent = currentRent * (newIndex / baseIndex);
  const variationPercent = ((newIndex - baseIndex) / baseIndex) * 100;

  return {
    newRent: Math.round(newRent * 100) / 100,
    variationPercent: Math.round(variationPercent * 100) / 100,
  };
}
