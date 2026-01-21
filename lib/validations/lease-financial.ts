/**
 * SSOT 2026 - Validation financière unifiée des baux
 * 
 * Ce schéma est la SOURCE UNIQUE de vérité pour toutes les validations
 * financières des baux (côté client ET serveur).
 * 
 * Conformité légale :
 * - Art. 22 Loi n°89-462 : Dépôt max 1 mois (location vide)
 * - Art. 25-6 Loi n°89-462 : Dépôt max 2 mois (meublé)
 * - Art. 25-13 Loi ELAN : Dépôt interdit (mobilité)
 */

import { z } from "zod";

// Types de bail supportés
export const BAIL_TYPES = ["nu", "meuble", "colocation", "saisonnier", "mobilite", "etudiant"] as const;
export type BailType = typeof BAIL_TYPES[number];

/**
 * Calcule le dépôt de garantie maximum légal selon le type de bail
 */
export function getMaxDepotLegal(typeBail: BailType | string, loyerHC: number): number {
  switch (typeBail) {
    case "nu":
    case "etudiant": // Bail étudiant = 1 mois max (meublé 9 mois)
      return loyerHC; // 1 mois max
    case "meuble":
    case "colocation":
      return loyerHC * 2; // 2 mois max
    case "mobilite":
      return 0; // Interdit
    case "saisonnier":
      return loyerHC * 2; // 2 mois max (pas de limite légale stricte)
    default:
      return loyerHC; // Par défaut = 1 mois
  }
}

/**
 * Calcule le nombre de mois correspondant au dépôt max
 */
export function getMaxDepotMois(typeBail: BailType | string): number {
  switch (typeBail) {
    case "nu":
    case "etudiant": return 1; // Bail étudiant = 1 mois max
    case "meuble":
    case "colocation":
    case "saisonnier": return 2;
    case "mobilite": return 0;
    default: return 1;
  }
}

/**
 * Schéma de validation des données financières d'un bail
 * À utiliser côté client (formulaires) ET côté serveur (API)
 */
export const LeaseFinancialSchema = z.object({
  loyer: z
    .number({ required_error: "Le loyer est obligatoire" })
    .min(1, "Le loyer doit être supérieur à 0€"),
    // Pas de limite haute - biens de luxe possibles
  
  charges_forfaitaires: z
    .number()
    .min(0, "Les charges ne peuvent pas être négatives")
    .default(0),
  
  depot_de_garantie: z
    .number()
    .min(0, "Le dépôt ne peut pas être négatif")
    .optional(), // Optionnel car calculé automatiquement si non fourni
  
  type_bail: z.enum(BAIL_TYPES, {
    errorMap: () => ({ message: "Type de bail invalide" }),
  }),
}).superRefine((data, ctx) => {
  // Validation du dépôt max légal (seulement si fourni)
  if (data.depot_de_garantie !== undefined && data.depot_de_garantie > 0) {
    const maxDepot = getMaxDepotLegal(data.type_bail, data.loyer);
    const maxMois = getMaxDepotMois(data.type_bail);
    
    if (data.type_bail === "mobilite") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Le dépôt de garantie est interdit pour un bail mobilité (Art. 25-13 Loi ELAN)",
        path: ["depot_de_garantie"],
      });
    } else if (data.depot_de_garantie > maxDepot && maxDepot > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Dépôt de garantie (${data.depot_de_garantie}€) supérieur au maximum légal (${maxMois} mois = ${maxDepot}€)`,
        path: ["depot_de_garantie"],
      });
    }
  }
});

/**
 * Type inféré du schéma de validation
 */
export type LeaseFinancialData = z.infer<typeof LeaseFinancialSchema>;

/**
 * Schéma complet pour la création d'un bail
 */
export const LeaseCreateSchema = z.object({
  property_id: z.string().uuid("ID de bien invalide"),
  type_bail: z.enum(BAIL_TYPES),
  loyer: z.number().min(1, "Loyer obligatoire"),
  charges_forfaitaires: z.number().min(0).default(0),
  depot_de_garantie: z.number().min(0).optional(), // Optionnel - calculé auto si non fourni
  date_debut: z.string().min(1, "Date de début obligatoire"),
  date_fin: z.string().optional().nullable(),
  
  // Locataire (optionnel à la création)
  tenant_email: z.string().email().optional().nullable(),
  tenant_name: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  // Validation dépôt max (seulement si fourni manuellement)
  if (data.depot_de_garantie !== undefined && data.depot_de_garantie > 0) {
    const maxDepot = getMaxDepotLegal(data.type_bail, data.loyer);
    
    if (data.type_bail === "mobilite") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dépôt de garantie interdit pour bail mobilité",
        path: ["depot_de_garantie"],
      });
    } else if (data.depot_de_garantie > maxDepot && maxDepot > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Dépôt (${data.depot_de_garantie}€) > max légal (${maxDepot}€)`,
        path: ["depot_de_garantie"],
      });
    }
  }
  
  // Validation durée bail mobilité (max 10 mois)
  if (data.type_bail === "mobilite" && data.date_debut && data.date_fin) {
    const debut = new Date(data.date_debut);
    const fin = new Date(data.date_fin);
    const diffMois = (fin.getFullYear() - debut.getFullYear()) * 12 + (fin.getMonth() - debut.getMonth());
    
    if (diffMois > 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bail mobilité : durée max 10 mois",
        path: ["date_fin"],
      });
    }
  }
  
  // Validation date fin obligatoire pour saisonnier/mobilité
  if ((data.type_bail === "saisonnier" || data.type_bail === "mobilite") && !data.date_fin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Date de fin obligatoire pour bail ${data.type_bail}`,
      path: ["date_fin"],
    });
  }
});

export type LeaseCreateData = z.infer<typeof LeaseCreateSchema>;

/**
 * Schéma pour la mise à jour d'un bail
 */
export const LeaseUpdateSchema = z.object({
  loyer: z.number().min(1).optional(),
  charges_forfaitaires: z.number().min(0).optional(),
  depot_de_garantie: z.number().min(0).optional(),
  date_debut: z.string().optional(),
  date_fin: z.string().optional().nullable(),
  statut: z.enum([
    "draft",
    "sent",
    "pending_signature",
    "partially_signed",
    "pending_owner_signature",
    "fully_signed",
    "active",
    "notice_given",
    "amended",
    "terminated",
    "archived"
  ]).optional(),
}).passthrough(); // Permet d'autres champs

/**
 * Valide les données financières et retourne un résultat typé
 */
export function validateLeaseFinancials(data: unknown): {
  success: boolean;
  data?: LeaseFinancialData;
  errors?: string[];
} {
  const result = LeaseFinancialSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(e => e.message),
  };
}

/**
 * Helper pour valider et transformer les données de création
 */
export function validateLeaseCreate(data: unknown): {
  success: boolean;
  data?: LeaseCreateData;
  errors?: { field: string; message: string }[];
} {
  const result = LeaseCreateSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(e => ({
      field: e.path.join("."),
      message: e.message,
    })),
  };
}

