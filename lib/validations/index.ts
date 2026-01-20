// Schémas Zod pour la validation
import { z } from "zod";

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)");

// Validation des rôles
export const userRoleSchema = z.enum(["admin", "owner", "tenant", "provider", "guarantor"]);

// Validation des profils
export const profileSchema = z.object({
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  telephone: z.string().regex(/^[0-9]{10}$/, "Le téléphone doit contenir 10 chiffres").optional().nullable(),
  date_naissance: isoDateString.optional().nullable(),
});

export const profileUpdateSchema = z
  .object({
    prenom: z
      .string()
      .min(1, "Le prénom est requis")
      .max(80, "Maximum 80 caractères")
      .optional(),
    nom: z
      .string()
      .min(1, "Le nom est requis")
      .max(80, "Maximum 80 caractères")
      .optional(),
    telephone: z
      .string()
      .regex(/^\+?[0-9]{9,15}$/, "Format téléphone invalide (ex: +33612345678)")
      .nullable()
      .optional(),
    date_naissance: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (YYYY-MM-DD)")
      .nullable()
      .optional(),
    // ✅ SOTA 2026: Ajout du lieu de naissance
    lieu_naissance: z
      .string()
      .max(100, "Maximum 100 caractères")
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.prenom !== undefined ||
      data.nom !== undefined ||
      data.telephone !== undefined ||
      data.date_naissance !== undefined ||
      data.lieu_naissance !== undefined,
    {
      message: "Aucune donnée à mettre à jour.",
      path: ["root"],
    }
  );

// Validation des propriétaires
// Note: Utiliser uniquement les champs de base qui existent dans la table owner_profiles
export const ownerProfileSchema = z.object({
  type: z.enum(["particulier", "societe"]).optional(),
  siret: z.string().regex(/^[0-9]{14}$/, "Le SIRET doit contenir 14 chiffres").optional().nullable(),
  tva: z.string().optional().nullable(),
  iban: z
    .string()
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/, "Format IBAN invalide")
    .optional()
    .nullable()
    .or(z.literal("")),
  bic: z
    .string()
    .regex(/^[A-Z]{6}[A-Z0-9]{2,5}$/, "Format BIC invalide")
    .optional()
    .nullable()
    .or(z.literal("")),
  titulaire_compte: z.string().max(255).optional().nullable(),
  nom_banque: z.string().max(255).optional().nullable(),
  adresse_facturation: z.string().optional().nullable(),
  raison_sociale: z.string().max(255).optional().nullable(),
  adresse_siege: z.string().optional().nullable(),
  forme_juridique: z
    .enum(["SARL", "SAS", "SASU", "SCI", "EURL", "EI", "SA", "SCPI", "autre"])
    .optional()
    .nullable(),
});

// Schéma étendu pour les fonctionnalités avancées (nécessite migration pour ajouter les colonnes)
export const ownerProfileExtendedSchema = ownerProfileSchema.extend({
  usage_strategie: z
    .enum(["habitation_only", "mixte_B2C_B2B", "B2B_only"])
    .default("habitation_only"),
  tva_optionnelle: z.boolean().default(false),
  tva_taux: z
    .number({ invalid_type_error: "Le taux de TVA doit être un nombre" })
    .min(0, "Le taux de TVA ne peut pas être négatif")
    .max(100, "Le taux de TVA ne peut pas dépasser 100%")
    .optional()
    .nullable(),
  notes_fiscales: z.string().optional().nullable(),
});

// Validation des locataires
export const tenantProfileSchema = z.object({
  situation_pro: z.string().optional().nullable(),
  revenus_mensuels: z.number().positive("Les revenus doivent être positifs").optional().nullable(),
  nb_adultes: z.number().int().min(1, "Au moins un adulte requis"),
  nb_enfants: z.number().int().min(0, "Le nombre d'enfants ne peut pas être négatif"),
  garant_required: z.boolean(),
  locataire_type: z
    .enum(["particulier_habitation", "profession_liberale", "commercant_artisan", "entreprise"])
    .default("particulier_habitation"),
  siren: z
    .string()
    .regex(/^[0-9]{9}$/, "Le SIREN doit contenir 9 chiffres")
    .optional()
    .nullable(),
  rcs: z.string().optional().nullable(),
  rm: z.string().optional().nullable(),
  rne: z.string().optional().nullable(),
  activite_ape: z.string().optional().nullable(),
  raison_sociale: z.string().optional().nullable(),
  representant_legal: z.string().optional().nullable(),
});

// Validation des prestataires
export const providerProfileSchema = z.object({
  type_services: z.array(z.string()).min(1, "Au moins un type de service requis"),
  certifications: z.string().optional().nullable(),
  zones_intervention: z.string().optional().nullable(),
});

const parkingDimensionsSchema = z
  .object({
    length: z.number().min(0).max(15).optional().nullable(),
    width: z.number().min(0).max(10).optional().nullable(),
    height: z.number().min(0).max(6).optional().nullable(),
  })
  .optional()
  .nullable();

const parkingManoeuvreSchema = z.object({
  narrow_ramp: z.boolean(),
  sharp_turn: z.boolean(),
  suitable_large_vehicle: z.boolean(),
});

const parkingDetailsSchema = z.object({
  placement_type: z.enum(["outdoor", "covered", "box", "underground"]),
  linked_property_id: z.string().uuid().optional().nullable(),
  reference_label: z.string().max(80).optional().nullable(),
  level: z.string().max(20).optional().nullable(),
  vehicle_profile: z.enum(["city", "berline", "suv", "utility", "two_wheels"]),
  dimensions: parkingDimensionsSchema,
  manoeuvre: parkingManoeuvreSchema,
  surface_type: z.enum(["beton", "asphalte", "gravier", "autre"]).optional().nullable(),
  access_types: z
    .array(z.enum(["badge", "remote", "key", "digicode", "free"]))
    .min(1, "Sélectionnez au moins un type d'accès"),
  access_window: z
    .object({
      mode: z.enum(["24_7", "limited"]),
      open_at: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:mm").optional().nullable(),
      close_at: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:mm").optional().nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.mode === "limited") {
        if (!value.open_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["open_at"],
            message: "Horaires requis",
          });
        }
        if (!value.close_at) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["close_at"],
            message: "Horaires requis",
          });
        }
      }
    }),
  security_features: z
    .array(z.enum(["gate", "camera", "guard", "residence", "lighting"]))
    .optional()
    .default([]),
  description_hint: z.string().max(280).optional().nullable(),
  extra_badge_fees: z.number().min(0).optional().nullable(),
});

const heatingTypeEnum = z.enum(["individuel", "collectif", "aucun"]);
const heatingEnergyEnum = z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]);
const hotWaterTypeEnum = z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]);
const climatePresenceEnum = z.enum(["aucune", "fixe", "mobile"]);
const climateTypeEnum = z.enum(["split", "gainable"]);
const roomTypeEnum = z.enum([
  // Types principaux habitation
  "sejour",
  "chambre",
  "cuisine",
  "salle_de_bain",
  "wc",
  "entree",
  "couloir",
  "balcon",
  "terrasse",
  "cave",
  "autre",
  // Types additionnels V3
  "salon_cuisine",
  "bureau",
  "dressing",
  "suite_parentale",
  "mezzanine",
  "buanderie",
  "cellier",
  "jardin",
  // Types pro/parking
  "stockage",
  "emplacement",
  "box",
]);
const roomEmitterEnum = z.enum(["radiateur", "plancher", "convecteur", "poele"]);
const photoTagEnum = z.enum(["vue_generale", "plan", "detail", "exterieur"]);

// ============================================
// EXPORTS DES SCHÉMAS PARTIELS RÉUTILISABLES
// ============================================
export {
  addressSchema,
  addressUpdateSchema,
  dpeSchema,
  dpeUpdateSchema,
  financialSchema,
  financialUpdateSchema,
  heatingComfortSchema,
  heatingComfortUpdateSchema,
  permisLouerSchema,
  permisLouerUpdateSchema,
  leaseConditionsSchema,
  leaseConditionsUpdateSchema,
} from "./schemas-shared";

// ============================================
// EXPORTS DES MESSAGES D'ERREUR
// ============================================
export { ValidationMessages, getValidationMessage } from "./error-messages";

// ============================================
// EXPORTS DES SCHÉMAS V3
// ============================================
export {
  propertySchemaV3,
  propertySchemaV3Base,
  habitationSchemaV3,
  habitationSchemaV3Base,
  parkingSchemaV3,
  localProSchemaV3,
  habitationUpdateSchemaV3,
  parkingUpdateSchemaV3,
  localProUpdateSchemaV3,
  propertyUpdateSchemaV3,
  roomSchemaV3,
  photoSchemaV3,
  type PropertyV3Input,
  type HabitationV3Input,
  type ParkingV3Input,
  type LocalProV3Input,
  type RoomV3Input,
  type PhotoV3Input,
  type PropertyV3UpdateInput,
  type HabitationV3UpdateInput,
  type ParkingV3UpdateInput,
  type LocalProV3UpdateInput,
} from "./property-v3";

// ============================================
// VALIDATION DES LOGEMENTS - LEGACY
// ============================================
/**
 * @deprecated Utiliser propertySchemaV3 de @/lib/validations/property-v3 pour les nouveaux développements
 * Ce schéma est conservé pour compatibilité avec l'ancien code. Migration progressive vers V3 en cours.
 * 
 * Utilisez validatePropertyData() ou safeValidatePropertyData() pour une détection automatique V3 vs Legacy.
 */
export const propertySchema = z
  .object({
  type: z.enum([
    "appartement",
    "maison",
    "colocation",
    "saisonnier",
    "local_commercial",
    "bureaux",
    "entrepot",
    "parking",
    "fonds_de_commerce",
  ]),
  usage_principal: z.enum([
    "habitation",
    "local_commercial",
    "bureaux",
    "entrepot",
    "parking",
    "fonds_de_commerce",
  ]),
  sous_usage: z.string().optional().nullable(),
  adresse_complete: z.string().min(1, "L'adresse est requise"),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().min(2, "Le département doit contenir au moins 2 caractères").max(3, "Le département doit contenir au maximum 3 caractères"),
  surface: z.number().min(0, "La surface ne peut pas être négative"),
  nb_pieces: z.number().int().min(0, "Le nombre de pièces ne peut pas être négatif"),
  etage: z.number().int().optional().nullable(),
  ascenseur: z.boolean(),
  energie: z.string().optional().nullable(),
  ges: z.string().optional().nullable(),
  erp_type: z.string().optional().nullable(),
  erp_categorie: z.string().optional().nullable(),
  erp_accessibilite: z.boolean().optional(),
  plan_url: z.string().url("URL invalide").optional().nullable(),
  has_irve: z.boolean().optional(),
  places_parking: z.number().int().min(0).optional(),
  parking_badge_count: z.number().int().min(0).optional(),
  commercial_previous_activity: z.string().optional().nullable(),
  loyer_base: z.number().min(0, "Le loyer doit être positif"),
  charges_mensuelles: z.number().min(0, "Les charges doivent être positives"),
  depot_garantie: z.number().min(0, "Le dépôt de garantie doit être positif"),
  zone_encadrement: z.boolean().optional(),
  loyer_reference_majoré: z.number().min(0, "Le loyer de référence doit être positif").optional().nullable(),
  complement_loyer: z.number().min(0, "Le complément ne peut pas être négatif").optional().nullable(),
  complement_justification: z.string().optional().nullable(),
  dpe_classe_energie: z.enum(["A","B","C","D","E","F","G","NC"]).optional().nullable(),
  dpe_classe_climat: z.enum(["A","B","C","D","E","F","G","NC"]).optional().nullable(),
  dpe_consommation: z.number().min(0).optional().nullable(),
  dpe_emissions: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_min: z.number().min(0).optional().nullable(),
  dpe_estimation_conso_max: z.number().min(0).optional().nullable(),
  permis_louer_requis: z.boolean().optional(),
  permis_louer_numero: z.string().optional().nullable(),
  permis_louer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  parking_details: parkingDetailsSchema.optional().nullable(),
})
  .superRefine((data, ctx) => {
    if (data.type === "parking") {
      if (!data.parking_details) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parking_details"],
          message: "Les détails du parking sont requis",
        });
      }
      if ((data.surface ?? 0) === 0) {
        // ok for parking
      }
      if ((data.nb_pieces ?? 0) !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nb_pieces"],
          message: "Un parking ne doit pas avoir de nombre de pièces",
        });
      }
    } else {
      if (data.surface <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["surface"],
          message: "La surface doit être positive",
        });
      }
      if (data.nb_pieces <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nb_pieces"],
          message: "Le nombre de pièces doit être positif",
        });
      }
    }
  });

export const propertyGeneralUpdateSchema = z
  .object({
    // Champs de base
    type_bien: z.enum([
      "appartement",
      "maison",
      "studio",
      "colocation",
      "parking",
      "box",
      "local_commercial",
      "bureaux",
      "entrepot",
      "fonds_de_commerce",
    ]).optional(),
    type: z.enum([
      "appartement",
      "maison",
      "studio",
      "colocation",
      "parking",
      "box",
      "local_commercial",
      "bureaux",
      "entrepot",
      "fonds_de_commerce",
    ]).optional(),
    adresse_complete: z.string().min(1).optional(),
    complement_adresse: z.string().optional().nullable(),
    code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres").optional(),
    ville: z.string().min(1).optional(),
    departement: z.string().min(2).max(3).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    // Surface : accepter les deux noms de champs pour compatibilité
    surface: z.number().min(0).optional().nullable(),
    surface_habitable_m2: z.number().min(0).optional().nullable(),
    nb_pieces: z.number().int().min(0).optional().nullable(),
    nb_chambres: z.number().int().min(0).optional().nullable(),
    etage: z.number().int().optional().nullable(),
    ascenseur: z.boolean().optional(),
    meuble: z.boolean().optional(),
    // DPE (Diagnostic de Performance Énergétique)
    dpe_classe_energie: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(),
    dpe_classe_climat: z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable(), // GES
    dpe_date: z.string().optional().nullable(),
    dpe_consommation: z.number().min(0).optional().nullable(),
    dpe_emissions: z.number().min(0).optional().nullable(),
    // Extérieurs V3
    has_balcon: z.boolean().optional(),
    has_terrasse: z.boolean().optional(),
    has_jardin: z.boolean().optional(),
    has_cave: z.boolean().optional(),
    // Équipements V3
    equipments: z.array(z.string()).optional(),
    // Chauffage & confort
    chauffage_type: z.enum(["individuel", "collectif", "aucun"]).optional().nullable(),
    chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
    eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]).optional().nullable(),
    clim_presence: z.enum(["aucune", "mobile", "fixe"]).optional().nullable(),
    clim_type: z.enum(["split", "gainable"]).optional().nullable(),
    // Parking V3
    parking_type: z.enum(["place_exterieure", "place_couverte", "box", "souterrain"]).optional().nullable(),
    parking_numero: z.string().max(50).optional().nullable(),
    parking_niveau: z.string().max(20).optional().nullable(),
    parking_gabarit: z.enum(["citadine", "berline", "suv", "utilitaire", "2_roues"]).optional().nullable(),
    parking_acces: z.array(z.enum(["badge", "telecommande", "cle", "digicode", "acces_libre"])).optional(),
    parking_portail_securise: z.boolean().optional(),
    parking_video_surveillance: z.boolean().optional(),
    parking_gardien: z.boolean().optional(),
    // Locaux pro V3
    local_surface_totale: z.number().min(0).optional().nullable(),
    local_type: z.enum(["boutique", "restaurant", "bureaux", "atelier", "stockage", "autre"]).optional().nullable(),
    local_has_vitrine: z.boolean().optional(),
    local_access_pmr: z.boolean().optional(),
    local_clim: z.boolean().optional(),
    local_fibre: z.boolean().optional(),
    local_alarme: z.boolean().optional(),
    local_rideau_metal: z.boolean().optional(),
    local_acces_camion: z.boolean().optional(),
    local_parking_clients: z.boolean().optional(),
    // Conditions de location V3
    type_bail: z.enum([
      "vide", "meuble", "colocation",
      "parking_seul", "accessoire_logement",
      "3_6_9", "derogatoire", "precaire", "professionnel", "autre"
    ]).optional().nullable(),
    preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
    // Financier
    loyer_hc: z.number().min(0).optional().nullable(),
    charges_mensuelles: z.number().min(0).optional().nullable(),
    depot_garantie: z.number().min(0).optional().nullable(),
    encadrement_loyers: z.boolean().optional().nullable(),
    zone_encadrement: z.boolean().optional(),
    loyer_reference_majoré: z.number().min(0).optional().nullable(),
    complement_loyer: z.number().min(0).optional().nullable(),
    complement_justification: z.string().optional().nullable(),
    // Visite virtuelle (Matterport, Nodalview, etc.)
    visite_virtuelle_url: z.string().url("L'URL de visite virtuelle doit être valide").optional().nullable(),
  })
  .refine(
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

export const propertyHeatingSchema = z
  .object({
    chauffage_type: heatingTypeEnum,
    chauffage_energie: heatingEnergyEnum.optional().nullable(),
    eau_chaude_type: hotWaterTypeEnum.optional().nullable(),
    clim_presence: climatePresenceEnum,
    clim_type: climateTypeEnum.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.chauffage_type === "aucun" && data.chauffage_energie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chauffage_energie"],
        message: "L'énergie doit être vide si aucun chauffage n'est présent.",
      });
    }
    if (data.chauffage_type !== "aucun" && !data.chauffage_energie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chauffage_energie"],
        message: "Sélectionnez une énergie pour le chauffage.",
      });
    }
    if (data.clim_presence === "aucune" && data.clim_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clim_type"],
        message: "Le type de clim doit être vide si aucune clim n'est installée.",
      });
    }
    if (data.clim_presence === "mobile" && data.clim_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clim_type"],
        message: "Le type de clim fixe n'est pas requis pour un équipement mobile.",
      });
    }
    if (data.clim_presence === "fixe" && !data.clim_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clim_type"],
        message: "Précisez le type de climatisation fixe.",
      });
    }
  });

const roomBaseSchema = z.object({
  type_piece: roomTypeEnum,
  label_affiche: z.string().min(1).max(120),
  surface_m2: z.number().min(0).optional().nullable(),
  chauffage_present: z.boolean(),
  chauffage_type_emetteur: roomEmitterEnum.optional().nullable(),
  clim_presente: z.boolean(),
});

const roomRefine = (value: z.infer<typeof roomBaseSchema>, ctx: z.RefinementCtx) => {
  if (!value.chauffage_present && value.chauffage_type_emetteur) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chauffage_type_emetteur"],
      message: "Le type d'émetteur doit être vide si le chauffage est absent.",
    });
  }
};

export const roomSchema = roomBaseSchema.superRefine(roomRefine);
// Version partielle définie explicitement pour éviter les problèmes webpack
export const roomUpdateSchema = z.object({
  type_piece: roomTypeEnum.optional(),
  label_affiche: z.string().min(1).max(120).optional(),
  surface_m2: z.number().min(0).optional().nullable(),
  chauffage_present: z.boolean().optional(),
  chauffage_type_emetteur: roomEmitterEnum.optional().nullable(),
  clim_presente: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.chauffage_present === false && value.chauffage_type_emetteur) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chauffage_type_emetteur"],
      message: "Le type d'émetteur doit être vide si le chauffage est absent.",
    });
  }
});

export const photoUploadRequestSchema = z.object({
  room_id: z.string().uuid().optional().nullable(),
  file_name: z.string().min(1),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  tag: photoTagEnum.optional().nullable(),
});

export const photoUpdateSchema = z.object({
  room_id: z.string().uuid().optional().nullable(),
  is_main: z.boolean().optional(),
  tag: photoTagEnum.optional().nullable(),
  ordre: z.number().int().min(0).optional(),
});

// Validation des unités (colocation)
export const unitSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  capacite_max: z.number().int().min(1).max(10, "Maximum 10 colocataires"),
  surface: z.number().positive().optional().nullable(),
});

// ✅ SOTA 2026: Tous les statuts de bail légaux
export const leaseStatusSchema = z.enum([
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
  "archived",
]);

// Validation des baux
export const leaseSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  type_bail: z.enum([
    "nu",
    "meuble",
    "colocation",
    "saisonnier",
    "bail_mobilite",
    "commercial_3_6_9",
    "commercial_derogatoire",
    "professionnel",
    "contrat_parking",
    "location_gerance",
  ]),
  loyer: z.number().positive("Le loyer doit être positif"),
  charges_forfaitaires: z.number().min(0, "Les charges ne peuvent pas être négatives"),
  depot_de_garantie: z.number().min(0, "Le dépôt de garantie ne peut pas être négatif"),
  date_debut: isoDateString,
  date_fin: isoDateString.optional().nullable(),
  indice_reference: z.enum(["IRL", "ILC", "ILAT"]).optional().nullable(),
  indice_base: z.number().min(0).optional().nullable(),
  indice_courant: z.number().min(0).optional().nullable(),
  indexation_periodicite: z.enum(["annuelle", "triennale", "quinquennale"]).optional().nullable(),
  indexation_lissage_deplafonnement: z.boolean().optional(),
  tva_applicable: z.boolean().optional(),
  tva_taux: z.number().min(0).max(100).optional().nullable(),
  loyer_ht: z.number().min(0).optional().nullable(),
  loyer_ttc: z.number().min(0).optional().nullable(),
  pinel_travaux_3_derniers: z.array(z.record(z.unknown())).optional(),
  pinel_travaux_3_prochains: z.array(z.record(z.unknown())).optional(),
  pinel_repartition_charges: z.record(z.unknown()).optional(),
  droit_preference_active: z.boolean().optional(),
  last_diagnostic_check: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_indexation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// Lease update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const leaseUpdateSchema = z.object({
  property_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  type_bail: z.enum([
    "nu",
    "meuble",
    "colocation",
    "saisonnier",
    "bail_mobilite",
    "commercial_3_6_9",
    "commercial_derogatoire",
    "professionnel",
    "contrat_parking",
    "location_gerance",
  ]).optional(),
  loyer: z.number().positive("Le loyer doit être positif").optional(),
  charges_forfaitaires: z.number().min(0, "Les charges ne peuvent pas être négatives").optional(),
  depot_de_garantie: z.number().min(0, "Le dépôt de garantie ne peut pas être négatif").optional(),
  date_debut: isoDateString.optional(),
  date_fin: isoDateString.optional().nullable(),
  indice_reference: z.enum(["IRL", "ILC", "ILAT"]).optional().nullable(),
  indice_base: z.number().min(0).optional().nullable(),
  indice_courant: z.number().min(0).optional().nullable(),
  indexation_periodicite: z.enum(["annuelle", "triennale", "quinquennale"]).optional().nullable(),
  indexation_lissage_deplafonnement: z.boolean().optional(),
  tva_applicable: z.boolean().optional(),
  tva_taux: z.number().min(0).max(100).optional().nullable(),
  loyer_ht: z.number().min(0).optional().nullable(),
  loyer_ttc: z.number().min(0).optional().nullable(),
  pinel_travaux_3_derniers: z.array(z.record(z.unknown())).optional(),
  pinel_travaux_3_prochains: z.array(z.record(z.unknown())).optional(),
  pinel_repartition_charges: z.record(z.unknown()).optional(),
  droit_preference_active: z.boolean().optional(),
  last_diagnostic_check: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  next_indexation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  statut: z.enum(["active", "expired", "terminated"]).optional(),
});

// Validation des factures
export const invoiceSchema = z.object({
  lease_id: z.string().uuid(),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format période invalide (YYYY-MM)"),
  montant_loyer: z.number().positive(),
  montant_charges: z.number().min(0),
  montant_ht: z.number().min(0).optional(),
  montant_tva: z.number().min(0).optional(),
  taux_tva: z.number().min(0).max(100).optional(),
  is_professional_lease: z.boolean().optional(),
  statut: z.enum(["draft", "sent", "paid", "late", "cancelled"]).optional(),
});

// Invoice update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const invoiceUpdateSchema = z.object({
  lease_id: z.string().uuid().optional(),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format période invalide (YYYY-MM)").optional(),
  montant_loyer: z.number().positive().optional(),
  montant_charges: z.number().min(0).optional(),
  montant_ht: z.number().min(0).optional(),
  montant_tva: z.number().min(0).optional(),
  taux_tva: z.number().min(0).max(100).optional(),
  is_professional_lease: z.boolean().optional(),
  statut: z.enum(["draft", "sent", "paid", "late", "cancelled"]).optional(),
});

// Validation des paiements
export const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  montant: z.number().positive(),
  moyen: z.enum(["cb", "virement", "prelevement"]),
  montant_ht: z.number().min(0).optional(),
  montant_tva: z.number().min(0).optional(),
  montant_ttc: z.number().min(0).optional(),
});

// Validation des charges
export const chargeSchema = z.object({
  property_id: z.string().uuid(),
  type: z.enum([
    "eau",
    "electricite",
    "copro",
    "taxe",
    "ordures",
    "assurance",
    "travaux",
    "energie",
    "autre",
  ]),
  montant: z.number().positive(),
  periodicite: z.enum(["mensuelle", "trimestrielle", "annuelle"]),
  refacturable_locataire: z.boolean(),
  categorie_charge: z
    .enum([
      "charges_locatives",
      "charges_non_recuperables",
      "taxes",
      "travaux_proprietaire",
      "travaux_locataire",
      "assurances",
      "energie",
    ])
    .optional(),
  eligible_pinel: z.boolean().optional(),
});

// Partial schema for charge updates (defined explicitly to avoid runtime .partial() issues with webpack)
export const chargeUpdateSchema = z.object({
  property_id: z.string().uuid().optional(),
  type: z.enum([
    "eau",
    "electricite",
    "copro",
    "taxe",
    "ordures",
    "assurance",
    "travaux",
    "energie",
    "autre",
  ]).optional(),
  montant: z.number().positive().optional(),
  periodicite: z.enum(["mensuelle", "trimestrielle", "annuelle"]).optional(),
  refacturable_locataire: z.boolean().optional(),
  categorie_charge: z
    .enum([
      "charges_locatives",
      "charges_non_recuperables",
      "taxes",
      "travaux_proprietaire",
      "travaux_locataire",
      "assurances",
      "energie",
    ])
    .optional(),
  eligible_pinel: z.boolean().optional(),
});

// Validation des tickets
export const ticketSchema = z.object({
  property_id: z.string().uuid(),
  lease_id: z.string().uuid().optional().nullable(),
  titre: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  priorite: z.enum(["basse", "normale", "haute"]),
  statut: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

// Ticket update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const ticketUpdateSchema = z.object({
  property_id: z.string().uuid().optional(),
  lease_id: z.string().uuid().optional().nullable(),
  titre: z.string().min(1, "Le titre est requis").optional(),
  description: z.string().min(1, "La description est requise").optional(),
  priorite: z.enum(["basse", "normale", "haute"]).optional(),
  statut: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
});

// Validation des ordres de travail
export const workOrderSchema = z.object({
  ticket_id: z.string().uuid(),
  provider_id: z.string().uuid(),
  date_intervention_prevue: isoDateString.optional().nullable(),
  cout_estime: z.number().positive().optional().nullable(),
  statut: z.enum(["pending", "scheduled", "in_progress", "done", "cancelled"]).optional(),
});

// Work order update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const workOrderUpdateSchema = z.object({
  ticket_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  date_intervention_prevue: isoDateString.optional().nullable(),
  cout_estime: z.number().positive().optional().nullable(),
  statut: z.enum(["pending", "scheduled", "in_progress", "done", "cancelled"]).optional(),
});

// Validation des documents
export const documentSchema = z.object({
  type: z.enum([
    "bail",
    "EDL_entree",
    "EDL_sortie",
    "quittance",
    "attestation_assurance",
    "attestation_loyer",
    "justificatif_revenus",
    "piece_identite",
    "cni_recto",      // CNI recto (propriétaire ou locataire)
    "cni_verso",      // CNI verso (propriétaire ou locataire)
    "annexe_pinel",
    "etat_travaux",
    "diagnostic_amiante",
    "diagnostic_tertiaire",
    "diagnostic_performance",
    "publication_jal",
    "autre",
  ]),
  property_id: z.string().uuid().optional().nullable(),
  lease_id: z.string().uuid().optional().nullable(),
  collection: z
    .string()
    .max(120, "La collection ne peut pas dépasser 120 caractères")
    .optional()
    .nullable(),
  position: z.number().int().min(1).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  is_cover: z.boolean().optional(),
});

// Document update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const documentUpdateSchema = z.object({
  type: z.enum([
    "bail",
    "EDL_entree",
    "EDL_sortie",
    "quittance",
    "attestation_assurance",
    "attestation_loyer",
    "justificatif_revenus",
    "piece_identite",
    "cni_recto",
    "cni_verso",
    "annexe_pinel",
    "etat_travaux",
    "diagnostic_amiante",
    "diagnostic_tertiaire",
    "diagnostic_performance",
    "publication_jal",
    "autre",
  ]).optional(),
  property_id: z.string().uuid().optional().nullable(),
  lease_id: z.string().uuid().optional().nullable(),
  collection: z
    .string()
    .max(120, "La collection ne peut pas dépasser 120 caractères")
    .optional()
    .nullable(),
  position: z.number().int().min(1).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  is_cover: z.boolean().optional(),
});

// Validation des articles de blog
export const blogPostSchema = z.object({
  slug: z.string().min(1, "Le slug est requis"),
  titre: z.string().min(1, "Le titre est requis"),
  contenu: z.string().min(1, "Le contenu est requis"),
  tags: z.array(z.string()),
  is_published: z.boolean(),
});

// Blog post update schema (defined explicitly to avoid runtime .partial() issues with webpack)
export const blogPostUpdateSchema = z.object({
  slug: z.string().min(1, "Le slug est requis").optional(),
  titre: z.string().min(1, "Le titre est requis").optional(),
  contenu: z.string().min(1, "Le contenu est requis").optional(),
  tags: z.array(z.string()).optional(),
  is_published: z.boolean().optional(),
});

// ============================================
// Validation des relevés de compteurs EDL
// ============================================
export {
  meterTypeSchema,
  meterUnitSchema,
  ocrProviderSchema,
  recorderRoleSchema,
  createEDLMeterReadingSchema,
  validateEDLMeterReadingSchema,
  ocrResultSchema,
  edlMeterReadingSchema,
  meterInfoSchema,
  meterConsumptionSchema,
  validateMeterValueProgression,
  validateMeterPhotoFile,
} from "./edl-meters";

// ============================================
// RE-EXPORTS PROPERTY VALIDATORS
// ============================================
// Helpers de validation pour les propriétés (déjà exportés: propertySchemaV3, etc.)

export {
  validatePropertyData,
  safeValidatePropertyData,
  isPropertyV3,
} from "./property-validator";

export {
  validateProperty,
  validateHabitation,
  validateParking,
  validateCommercial,
} from "./property-validation";

// ============================================
// VISIT SCHEDULING VALIDATORS - SOTA 2026
// ============================================

export {
  createAvailabilityPatternSchema,
  updateAvailabilityPatternSchema,
  createAvailabilityExceptionSchema,
  getVisitSlotsQuerySchema,
  updateSlotStatusSchema,
  createVisitBookingSchema,
  updateVisitBookingSchema,
  cancelVisitBookingSchema,
  visitFeedbackSchema,
  createCalendarConnectionSchema,
  updateCalendarConnectionSchema,
  generateSlotsSchema,
} from "./visit-scheduling";

export type {
  CreateAvailabilityPattern,
  UpdateAvailabilityPattern,
  CreateAvailabilityException,
  GetVisitSlotsQuery,
  UpdateSlotStatus,
  CreateVisitBooking,
  UpdateVisitBooking,
  CancelVisitBooking,
  VisitFeedback,
  CreateCalendarConnection,
  UpdateCalendarConnection,
  GenerateSlots,
} from "./visit-scheduling";

