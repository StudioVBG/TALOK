/**
 * Schémas Zod partiels réutilisables pour les validations
 *
 * Ces schémas peuvent être combinés pour créer des schémas complets
 * et éviter la duplication de code.
 *
 * NOTE: Les schémas "Update" sont définis explicitement (sans .partial())
 * pour éviter les problèmes de bundling webpack avec Zod.
 */

import { z } from "zod";

// ============================================
// SCHÉMA ADRESSE (réutilisable)
// ============================================

export const addressSchema = z.object({
  adresse_complete: z.string().min(1, "L'adresse complète est requise"),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().min(2, "Le département doit contenir au moins 2 caractères").max(3, "Le département doit contenir au maximum 3 caractères").optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

// Version partielle pour les mises à jour (définie explicitement)
export const addressUpdateSchema = z.object({
  adresse_complete: z.string().min(1, "L'adresse complète est requise").optional(),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres").optional(),
  ville: z.string().min(1, "La ville est requise").optional(),
  departement: z.string().min(2).max(3).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

// ============================================
// SCHÉMA DPE (Diagnostic de Performance Énergétique)
// ============================================

export const dpeSchema = z.object({
  dpe_classe_energie: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_classe_climat: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_consommation: z.number().min(0).optional().nullable(),
  dpe_emissions: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_min: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_max: z.number().min(0).optional().nullable(),
});

// Version partielle pour les mises à jour (définie explicitement - identique car tous les champs sont déjà optionnels)
export const dpeUpdateSchema = z.object({
  dpe_classe_energie: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_classe_climat: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
  dpe_consommation: z.number().min(0).optional().nullable(),
  dpe_emissions: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_min: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_max: z.number().min(0).optional().nullable(),
});

// ============================================
// SCHÉMA FINANCIER (réutilisable)
// ============================================

export const financialSchema = z.object({
  loyer_hc: z.number().positive("Le loyer hors charges doit être strictement positif"),
  charges_mensuelles: z.number().min(0, "Les charges ne peuvent pas être négatives"),
  depot_garantie: z.number().min(0, "Le dépôt de garantie ne peut pas être négatif"),
  zone_encadrement: z.boolean().optional(),
  encadrement_loyers: z.boolean().optional().nullable(),
  loyer_reference_majoré: z.number().min(0, "Le loyer de référence doit être positif").optional().nullable(),
  complement_loyer: z.number().min(0, "Le complément ne peut pas être négatif").optional().nullable(),
  complement_justification: z.string().optional().nullable(),
});

// Version partielle pour les mises à jour (définie explicitement)
export const financialUpdateSchema = z.object({
  loyer_hc: z.number().positive("Le loyer hors charges doit être strictement positif").optional(),
  charges_mensuelles: z.number().min(0, "Les charges ne peuvent pas être négatives").optional(),
  depot_garantie: z.number().min(0, "Le dépôt de garantie ne peut pas être négatif").optional(),
  zone_encadrement: z.boolean().optional(),
  encadrement_loyers: z.boolean().optional().nullable(),
  loyer_reference_majoré: z.number().min(0, "Le loyer de référence doit être positif").optional().nullable(),
  complement_loyer: z.number().min(0, "Le complément ne peut pas être négatif").optional().nullable(),
  complement_justification: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.encadrement_loyers && data.loyer_reference_majoré === undefined) {
      return false;
    }
    return true;
  },
  {
    message: "Le loyer de référence majoré est requis en cas d'encadrement.",
    path: ["loyer_reference_majoré"],
  }
);

// ============================================
// SCHÉMA CHAUFFAGE & CONFORT (réutilisable)
// ============================================

// Schéma de base (sans superRefine) pour permettre réutilisation
const heatingComfortBaseSchema = z.object({
  chauffage_type: z.enum(["individuel", "collectif", "aucun"]),
  chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
  eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]),
  clim_presence: z.enum(["aucune", "mobile", "fixe"]),
  clim_type: z.enum(["split", "gainable"]).optional().nullable(),
});

// Version complète avec validations
export const heatingComfortSchema = heatingComfortBaseSchema.superRefine((data, ctx) => {
  // Validation chauffage_energie requis si chauffage_type != 'aucun'
  if (data.chauffage_type !== "aucun" && !data.chauffage_energie) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chauffage_energie"],
      message: "L'énergie du chauffage est requise si le chauffage n'est pas 'aucun'",
    });
  }
  // Validation clim_type requis si clim_presence = 'fixe'
  if (data.clim_presence === "fixe" && !data.clim_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clim_type"],
      message: "Le type de climatisation est requis si la climatisation est fixe",
    });
  }
  // Validation clim_type vide si clim_presence = 'aucune' ou 'mobile'
  if (data.clim_presence === "aucune" && data.clim_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clim_type"],
      message: "Le type de clim doit être vide si aucune clim n'est installée",
    });
  }
  if (data.clim_presence === "mobile" && data.clim_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clim_type"],
      message: "Le type de clim fixe n'est pas requis pour un équipement mobile",
    });
  }
});

// Version partielle pour les mises à jour (définie explicitement)
export const heatingComfortUpdateSchema = z.object({
  chauffage_type: z.enum(["individuel", "collectif", "aucun"]).optional(),
  chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
  eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]).optional(),
  clim_presence: z.enum(["aucune", "mobile", "fixe"]).optional(),
  clim_type: z.enum(["split", "gainable"]).optional().nullable(),
}).superRefine((data, ctx) => {
  // Appliquer les mêmes validations si les champs sont présents
  if (data.chauffage_type !== undefined && data.chauffage_type !== "aucun" && !data.chauffage_energie) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chauffage_energie"],
      message: "L'énergie du chauffage est requise si le chauffage n'est pas 'aucun'",
    });
  }
  if (data.clim_presence === "fixe" && !data.clim_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clim_type"],
      message: "Le type de climatisation est requis si la climatisation est fixe",
    });
  }
});

// ============================================
// SCHÉMA PERMIS DE LOUER (réutilisable)
// ============================================

export const permisLouerSchema = z.object({
  permis_louer_requis: z.boolean().optional(),
  permis_louer_numero: z.string().optional().nullable(),
  permis_louer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)").optional().nullable(),
});

// Version partielle pour les mises à jour (identique car tous les champs sont déjà optionnels)
export const permisLouerUpdateSchema = z.object({
  permis_louer_requis: z.boolean().optional(),
  permis_louer_numero: z.string().optional().nullable(),
  permis_louer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)").optional().nullable(),
});

// ============================================
// SCHÉMA CONDITIONS DE LOCATION (réutilisable)
// ============================================

export const leaseConditionsSchema = z.object({
  type_bail: z.enum([
    // Habitation
    "vide", "meuble", "colocation",
    // Parking
    "parking_seul", "accessoire_logement",
    // Pro
    "3_6_9", "derogatoire", "precaire", "professionnel", "autre"
  ]).optional().nullable(),
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});

// Version partielle pour les mises à jour (identique car tous les champs sont déjà optionnels)
export const leaseConditionsUpdateSchema = z.object({
  type_bail: z.enum([
    "vide", "meuble", "colocation",
    "parking_seul", "accessoire_logement",
    "3_6_9", "derogatoire", "precaire", "professionnel", "autre"
  ]).optional().nullable(),
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});
