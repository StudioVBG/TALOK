/**
 * Schémas de validation Zod pour Property V3
 * 
 * Sources :
 * - Modèle détaillé fourni par l'utilisateur (règles de validation finales section 3)
 * - Schémas existants : lib/validations/index.ts
 * - Types V3 : lib/types/property-v3.ts
 * - Migration BDD : supabase/migrations/202502150000_property_model_v3.sql
 * 
 * Utilise z.discriminatedUnion pour valider selon le type_bien
 */

import { z } from "zod";
import type {
  PropertyTypeV3,
  ParkingTypeV3,
  ParkingGabaritV3,
  ParkingAccesV3,
  LocalTypeV3,
  TypeBailV3,
  EquipmentV3,
  RoomTypeV3,
  PhotoTagV3,
} from "@/lib/types/property-v3";

// ============================================
// ENUMS & SCHEMAS DE BASE (réutilisables)
// ============================================
// Source existante : lib/validations/index.ts ligne 163-182
// Décision : Réutiliser les enums existants pour chauffage/clim, ajouter les nouveaux

const propertyTypeV3Enum = z.enum([
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
]);

const parkingTypeEnum = z.enum([
  "place_exterieure",
  "place_couverte",
  "box",
  "souterrain",
]);

const parkingGabaritEnum = z.enum([
  "citadine",
  "berline",
  "suv",
  "utilitaire",
  "2_roues",
]);

const parkingAccesEnum = z.enum([
  "badge",
  "telecommande",
  "cle",
  "digicode",
  "acces_libre",
]);

const localTypeEnum = z.enum([
  "boutique",
  "restaurant",
  "bureaux",
  "atelier",
  "stockage",
  "autre",
]);

const typeBailHabitationEnum = z.enum(["vide", "meuble", "colocation"]);
const typeBailParkingEnum = z.enum(["parking_seul", "accessoire_logement"]);
const typeBailProEnum = z.enum(["3_6_9", "derogatoire", "precaire", "professionnel", "autre"]);

const equipmentEnum = z.enum([
  "wifi",
  "television",
  "cuisine_equipee",
  "lave_linge",
  "lave_vaisselle",
  "micro_ondes",
  "machine_a_cafe",
  "fer_repasser",
  "seche_cheveux",
  "balcon",
  "terrasse",
  "jardin",
  "piscine",
  "salle_sport",
  "local_velo",
  "parking_residence",
  "animaux_acceptes",
  "equipement_bebe",
  "climatisation",
]);

const roomTypeV3Enum = z.enum([
  "sejour",
  "chambre",
  "cuisine",
  "salle_de_bain",
  "wc",
  "entree",
  "couloir",
  "balcon",
  "terrasse",
  "jardin",
  "autre",
]);

const photoTagV3Enum = z.enum([
  "vue_generale",
  "plan",
  "detail",
  "exterieur",
  "emplacement",
  "acces",
  "façade",
  "interieur",
  "vitrine",
  "autre",
]);

// ============================================
// SCHÉMA DE BASE (commun à tous les biens)
// ============================================
// Source modèle V3 section 3.1 : règles communes
// Source existante : lib/validations/index.ts ligne 185-242 (base propertySchema)
// Décision : Extraire les champs communs dans un schéma de base
// NOTE : type_bien n'est PAS inclus ici car il doit être défini dans chaque schéma spécifique
// pour que z.discriminatedUnion fonctionne correctement

const basePropertySchemaV3 = z.object({
  // type_bien défini dans chaque schéma spécifique (habitationSchemaV3, parkingSchemaV3, localProSchemaV3)
  adresse_complete: z.string().min(1, "L'adresse complète est requise"),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/, "Le code postal doit contenir 5 chiffres"),
  ville: z.string().min(1, "La ville est requise"),
  departement: z.string().min(2, "Le département doit contenir au moins 2 caractères").max(3, "Le département doit contenir au maximum 3 caractères").optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  loyer_hc: z.number().positive("Le loyer hors charges doit être strictement positif"),
  charges_mensuelles: z.number().min(0, "Les charges ne peuvent pas être négatives"),
  depot_garantie: z.number().min(0, "Le dépôt de garantie ne peut pas être négatif"),
});

// ============================================
// SCHÉMA HABITATION
// ============================================
// Source modèle V3 section 3.2 : règles pour habitation
// Source existante : lib/validations/index.ts (chauffage/clim validations)
// Décision : Schéma complet pour appartement, maison, studio, colocation
// NOTE : Créer une version base (sans superRefine) pour discriminatedUnion, puis une version avec validations

export const habitationSchemaV3Base = basePropertySchemaV3.extend({
  type_bien: z.enum(["appartement", "maison", "studio", "colocation"]),
  surface_habitable_m2: z.number().positive("La surface habitable doit être strictement positive"),
  nb_pieces: z.number().int().min(1, "Le nombre de pièces doit être au moins 1"),
  nb_chambres: z.number().int().min(0, "Le nombre de chambres ne peut pas être négatif"),
  etage: z.number().int().optional().nullable(),
  ascenseur: z.boolean(),
  meuble: z.boolean(),
  has_balcon: z.boolean(),
  has_terrasse: z.boolean(),
  has_jardin: z.boolean(),
  has_cave: z.boolean(),
  chauffage_type: z.enum(["individuel", "collectif", "aucun"]),
  chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
  eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]),
  clim_presence: z.enum(["aucune", "mobile", "fixe"]),
  clim_type: z.enum(["split", "gainable"]).optional().nullable(),
  equipments: z.array(equipmentEnum),
  type_bail: typeBailHabitationEnum,
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});

// Version avec validations avancées pour usage général
export const habitationSchemaV3 = habitationSchemaV3Base.superRefine((data, ctx) => {
  // Source modèle V3 : chauffage_energie requis si chauffage_type != 'aucun'
  if (data.chauffage_type !== "aucun" && !data.chauffage_energie) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["chauffage_energie"],
      message: "L'énergie du chauffage est requise si le chauffage n'est pas 'aucun'",
    });
  }
  // Source modèle V3 : clim_type requis si clim_presence = 'fixe'
  if (data.clim_presence === "fixe" && !data.clim_type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clim_type"],
      message: "Le type de climatisation est requis si la climatisation est fixe",
    });
  }
});

// ============================================
// SCHÉMA PARKING / BOX
// ============================================
// Source modèle V3 section 3.3 : règles pour parking/box
// Source existante : lib/validations/index.ts ligne 244-261 (parking validation)
// Décision : Nouveau schéma structuré (pas JSONB)

export const parkingSchemaV3 = basePropertySchemaV3
  .extend({
    type_bien: z.enum(["parking", "box"]),
    parking_type: parkingTypeEnum,
    parking_numero: z.string().max(50).optional().nullable(),
    parking_niveau: z.string().max(20).optional().nullable(), // ex: "SS-1", "RDC", "+1"
    parking_gabarit: parkingGabaritEnum,
    parking_acces: z.array(parkingAccesEnum).min(1, "Au moins un type d'accès doit être sélectionné"),
    parking_portail_securise: z.boolean(),
    parking_video_surveillance: z.boolean(),
    parking_gardien: z.boolean(),
    type_bail: typeBailParkingEnum,
    preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
  });

// ============================================
// SCHÉMA LOCAL PRO
// ============================================
// Source modèle V3 section 3.4 : règles pour locaux commerciaux/professionnels
// Source existante : Aucun schéma spécifique actuellement
// Décision : Nouveau schéma basé sur le modèle V3

export const localProSchemaV3 = basePropertySchemaV3
  .extend({
    type_bien: z.enum(["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"]),
    local_surface_totale: z.number().positive("La surface totale doit être strictement positive"),
    local_type: localTypeEnum,
    local_has_vitrine: z.boolean(),
    local_access_pmr: z.boolean(),
    local_clim: z.boolean(),
    local_fibre: z.boolean(),
    local_alarme: z.boolean(),
    local_rideau_metal: z.boolean(),
    local_acces_camion: z.boolean(),
    local_parking_clients: z.boolean(),
    type_bail: typeBailProEnum,
    preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
  });

// ============================================
// SCHÉMA PRINCIPAL DISCRIMINATED UNION
// ============================================
// Source modèle V3 : validation différenciée selon type_bien
// Décision : Utiliser z.discriminatedUnion pour une validation type-safe
// NOTE : Utiliser habitationSchemaV3Base (sans superRefine) car discriminatedUnion nécessite ZodObject

export const propertySchemaV3Base = z.discriminatedUnion("type_bien", [
  habitationSchemaV3Base,
  parkingSchemaV3,
  localProSchemaV3,
]);

// Version avec validations avancées pour habitation (wrapper autour de la base)
export const propertySchemaV3 = propertySchemaV3Base.superRefine((data, ctx) => {
  // Appliquer les validations conditionnelles pour habitation
  if (data.type_bien === "appartement" || data.type_bien === "maison" || data.type_bien === "studio" || data.type_bien === "colocation") {
    const habitation = data as z.infer<typeof habitationSchemaV3Base>;
    // Validation chauffage_energie
    if (habitation.chauffage_type !== "aucun" && !habitation.chauffage_energie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chauffage_energie"],
        message: "L'énergie du chauffage est requise si le chauffage n'est pas 'aucun'",
      });
    }
    // Validation clim_type
    if (habitation.clim_presence === "fixe" && !habitation.clim_type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clim_type"],
        message: "Le type de climatisation est requis si la climatisation est fixe",
      });
    }
  }
});

// ============================================
// SCHÉMAS POUR UPDATE (PARTIELS)
// ============================================
// Source : Besoin pour les PATCH (mise à jour progressive)
// Décision : Schémas définis explicitement pour éviter les problèmes webpack avec .partial()

export const habitationUpdateSchemaV3 = z.object({
  type_bien: z.enum(["appartement", "maison", "studio", "colocation"]).optional(),
  adresse_complete: z.string().min(1).optional(),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().min(2).max(3).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  loyer_hc: z.number().positive().optional(),
  charges_mensuelles: z.number().min(0).optional(),
  depot_garantie: z.number().min(0).optional(),
  surface_habitable_m2: z.number().positive().optional(),
  nb_pieces: z.number().int().min(1).optional(),
  nb_chambres: z.number().int().min(0).optional(),
  etage: z.number().int().optional().nullable(),
  ascenseur: z.boolean().optional(),
  meuble: z.boolean().optional(),
  has_balcon: z.boolean().optional(),
  has_terrasse: z.boolean().optional(),
  has_jardin: z.boolean().optional(),
  has_cave: z.boolean().optional(),
  chauffage_type: z.enum(["individuel", "collectif", "aucun"]).optional(),
  chauffage_energie: z.enum(["electricite", "gaz", "fioul", "bois", "reseau_urbain", "autre"]).optional().nullable(),
  eau_chaude_type: z.enum(["electrique_indiv", "gaz_indiv", "collectif", "solaire", "autre"]).optional(),
  clim_presence: z.enum(["aucune", "mobile", "fixe"]).optional(),
  clim_type: z.enum(["split", "gainable"]).optional().nullable(),
  equipments: z.array(equipmentEnum).optional(),
  type_bail: typeBailHabitationEnum.optional(),
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});

export const parkingUpdateSchemaV3 = z.object({
  type_bien: z.enum(["parking", "box"]).optional(),
  adresse_complete: z.string().min(1).optional(),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().min(2).max(3).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  loyer_hc: z.number().positive().optional(),
  charges_mensuelles: z.number().min(0).optional(),
  depot_garantie: z.number().min(0).optional(),
  parking_type: parkingTypeEnum.optional(),
  parking_numero: z.string().max(50).optional().nullable(),
  parking_niveau: z.string().max(20).optional().nullable(),
  parking_gabarit: parkingGabaritEnum.optional(),
  parking_acces: z.array(parkingAccesEnum).optional(),
  parking_portail_securise: z.boolean().optional(),
  parking_video_surveillance: z.boolean().optional(),
  parking_gardien: z.boolean().optional(),
  type_bail: typeBailParkingEnum.optional(),
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});

export const localProUpdateSchemaV3 = z.object({
  type_bien: z.enum(["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"]).optional(),
  adresse_complete: z.string().min(1).optional(),
  complement_adresse: z.string().optional().nullable(),
  code_postal: z.string().regex(/^[0-9]{5}$/).optional(),
  ville: z.string().min(1).optional(),
  departement: z.string().min(2).max(3).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  loyer_hc: z.number().positive().optional(),
  charges_mensuelles: z.number().min(0).optional(),
  depot_garantie: z.number().min(0).optional(),
  local_surface_totale: z.number().positive().optional(),
  local_type: localTypeEnum.optional(),
  local_has_vitrine: z.boolean().optional(),
  local_access_pmr: z.boolean().optional(),
  local_clim: z.boolean().optional(),
  local_fibre: z.boolean().optional(),
  local_alarme: z.boolean().optional(),
  local_rideau_metal: z.boolean().optional(),
  local_acces_camion: z.boolean().optional(),
  local_parking_clients: z.boolean().optional(),
  type_bail: typeBailProEnum.optional(),
  preavis_mois: z.number().int().min(1).max(12).optional().nullable(),
});

export const propertyUpdateSchemaV3 = z.union([
  habitationUpdateSchemaV3,
  parkingUpdateSchemaV3,
  localProUpdateSchemaV3,
]);

// ============================================
// SCHÉMAS POUR ROOMS & PHOTOS
// ============================================
// Source modèle V3 : validation des pièces et photos
// Source existante : lib/validations/index.ts (si existant)

export const roomSchemaV3 = z.object({
  id: z.string().uuid().optional(),
  property_id: z.string().uuid(),
  type_piece: roomTypeV3Enum,
  label_affiche: z.string().min(1, "Le label affiché est requis"),
  surface_m2: z.number().min(0).optional().nullable(),
  chauffage_present: z.boolean().default(true),
  clim_presente: z.boolean().default(false),
  ordre: z.number().int().min(0).default(0),
});

export const photoSchemaV3 = z.object({
  id: z.string().uuid().optional(),
  property_id: z.string().uuid(),
  room_id: z.string().uuid().optional().nullable(),
  url: z.string().url("URL invalide"),
  tag: photoTagV3Enum.optional().nullable(),
  is_main: z.boolean().default(false),
  ordre: z.number().int().min(0).default(0),
});

// ============================================
// TYPE INFERENCE (pour TypeScript)
// ============================================
// Permet d'inférer les types TypeScript depuis les schémas Zod

export type PropertyV3Input = z.infer<typeof propertySchemaV3>;
export type HabitationV3Input = z.infer<typeof habitationSchemaV3>;
export type ParkingV3Input = z.infer<typeof parkingSchemaV3>;
export type LocalProV3Input = z.infer<typeof localProSchemaV3>;
export type RoomV3Input = z.infer<typeof roomSchemaV3>;
export type PhotoV3Input = z.infer<typeof photoSchemaV3>;
export type PropertyV3UpdateInput = z.infer<typeof propertyUpdateSchemaV3>;
export type HabitationV3UpdateInput = z.infer<typeof habitationUpdateSchemaV3>;
export type ParkingV3UpdateInput = z.infer<typeof parkingUpdateSchemaV3>;
export type LocalProV3UpdateInput = z.infer<typeof localProUpdateSchemaV3>;

