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
  "saisonnier",        // SOTA 2026: Location saisonnière
  "parking",
  "box",
  "local_commercial",
  "bureaux",
  "entrepot",
  "fonds_de_commerce",
  "immeuble",          // SOTA 2026: Immeuble entier multi-lots
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
  // SOTA 2026: Validation code postal France métropole + DOM-TOM
  // Métropole: 01xxx-95xxx (départements 01-95, inclut Corse 20xxx)
  // DOM-TOM: 971xx-976xx (Guadeloupe, Martinique, Guyane, Réunion, Mayotte)
  code_postal: z.string().regex(
    /^((0[1-9]|[1-8]\d|9[0-5])\d{3}|97[1-6]\d{2})$/,
    "Code postal invalide. Métropole : 01000-95999, DOM-TOM : 97100-97699"
  ),
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

// SOTA 2026: DPE classe enum
const dpeClasseEnum = z.enum(["A", "B", "C", "D", "E", "F", "G", "NC"]).optional().nullable();

// SOTA 2026: Zone encadrement loyers (loi ALUR / ELAN)
const zoneEncadrementEnum = z.enum([
  "paris",
  "paris_agglo",
  "lille",
  "lyon",
  "villeurbanne",
  "montpellier",
  "bordeaux",
  "aucune"
]).optional().nullable();

export const habitationSchemaV3Base = basePropertySchemaV3.extend({
  type_bien: z.enum(["appartement", "maison", "studio", "colocation", "saisonnier"]),
  surface_habitable_m2: z.number().positive("La surface habitable doit être strictement positive"),
  // SOTA 2026: Surface Carrez pour copropriete (doit etre <= surface_habitable_m2)
  surface_carrez: z.number().positive().optional().nullable(),
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
  // SOTA 2026: DPE obligatoire pour habitation
  dpe_classe_energie: dpeClasseEnum,
  dpe_classe_climat: dpeClasseEnum,
  dpe_consommation: z.number().min(0).optional().nullable(),
  dpe_emissions: z.number().min(0).optional().nullable(),
  // SOTA 2026: Encadrement des loyers (loi ALUR / ELAN)
  zone_encadrement: zoneEncadrementEnum,
  loyer_reference: z.number().min(0).optional().nullable(),
  loyer_reference_majore: z.number().min(0).optional().nullable(),
  complement_loyer: z.number().min(0).optional().nullable(),
  complement_loyer_justification: z.string().optional().nullable(),
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

  // SOTA 2026: DPE G (passoire energetique) interdit a la location depuis 2025
  // Sauf pour les colocations qui ont des regles differentes
  if (data.dpe_classe_energie === "G" && data.type_bail !== "colocation") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dpe_classe_energie"],
      message: "Les logements classes G (passoires thermiques) sont interdits a la location depuis le 1er janvier 2025. Seules les colocations beneficient d'une derogation temporaire.",
    });
  }

  // SOTA 2026: Surface Carrez ne peut pas depasser la surface habitable
  if (data.surface_carrez && data.surface_habitable_m2 && data.surface_carrez > data.surface_habitable_m2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["surface_carrez"],
      message: "La surface Carrez ne peut pas depasser la surface habitable",
    });
  }

  // SOTA 2026: Surface minimale pour habitation (9m2 loi Carrez / decret decence)
  if (data.surface_habitable_m2 && data.surface_habitable_m2 < 9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["surface_habitable_m2"],
      message: "La surface habitable minimale est de 9m2 pour un logement decent",
    });
  }

  // SOTA 2026: Encadrement des loyers - loyer_reference requis si zone_encadrement definie
  if (data.zone_encadrement && data.zone_encadrement !== "aucune" && !data.loyer_reference) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loyer_reference"],
      message: "Le loyer de reference est obligatoire dans les zones avec encadrement des loyers",
    });
  }

  // SOTA 2026: Complement de loyer - justification requise si complement defini
  if (data.complement_loyer && data.complement_loyer > 0 && !data.complement_loyer_justification) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["complement_loyer_justification"],
      message: "Une justification est requise pour le complement de loyer (caracteristiques exceptionnelles)",
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
// SCHÉMA IMMEUBLE ENTIER (SOTA 2026)
// ============================================
// Source modèle V3 section 3.5 : règles pour immeubles multi-lots
// Décision : Schéma spécifique pour les immeubles avec validation des lots

const buildingUnitSchema = z.object({
  id: z.string(),
  building_id: z.string(),
  floor: z.number().int().min(-5).max(50),
  position: z.string().min(1).max(10),
  type: z.enum(["appartement", "studio", "local_commercial", "parking", "cave", "bureau"]),
  surface: z.number().positive("La surface doit être positive"),
  nb_pieces: z.number().int().min(0),
  loyer_hc: z.number().min(0),
  charges: z.number().min(0),
  depot_garantie: z.number().min(0),
  status: z.enum(["vacant", "occupe", "travaux", "reserve"]),
  template: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// NOTE: immeubleSchemaV3Base is used in discriminatedUnion (requires ZodObject, not ZodEffects)
export const immeubleSchemaV3Base = basePropertySchemaV3.omit({ loyer_hc: true, charges_mensuelles: true, depot_garantie: true }).extend({
  type_bien: z.literal("immeuble"),
  // Configuration de l'immeuble
  building_floors: z.number().int().min(1).max(50),
  building_units: z.array(buildingUnitSchema).min(1, "Un immeuble doit avoir au moins 1 lot"),
  // Parties communes
  has_ascenseur: z.boolean().default(false),
  has_gardien: z.boolean().default(false),
  has_interphone: z.boolean().default(false),
  has_digicode: z.boolean().default(false),
  has_local_velo: z.boolean().default(false),
  has_local_poubelles: z.boolean().default(false),
});

// Version with advanced validations for general use
export const immeubleSchemaV3 = immeubleSchemaV3Base.superRefine((data, ctx) => {
  // SOTA 2026: Validation cohérence lots/étages
  const maxFloorInUnits = Math.max(...data.building_units.map(u => u.floor), 0);
  if (maxFloorInUnits >= data.building_floors) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["building_floors"],
      message: `Le nombre d'étages (${data.building_floors}) doit être supérieur au plus haut étage des lots (${maxFloorInUnits})`,
    });
  }

  // Validation unicité position par étage
  const positionsByFloor = new Map<number, Set<string>>();
  for (const unit of data.building_units) {
    if (!positionsByFloor.has(unit.floor)) {
      positionsByFloor.set(unit.floor, new Set());
    }
    const positions = positionsByFloor.get(unit.floor)!;
    if (positions.has(unit.position)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["building_units"],
        message: `Position "${unit.position}" dupliquée à l'étage ${unit.floor}`,
      });
    }
    positions.add(unit.position);
  }
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
  immeubleSchemaV3Base,  // Use Base version (ZodObject) for discriminatedUnion compatibility
]);

// Version avec validations avancées pour habitation (wrapper autour de la base)
export const propertySchemaV3 = propertySchemaV3Base.superRefine((data, ctx) => {
  // Appliquer les validations conditionnelles pour habitation
  if (data.type_bien === "appartement" || data.type_bien === "maison" || data.type_bien === "studio" || data.type_bien === "colocation" || data.type_bien === "saisonnier") {
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

    // SOTA 2026: DPE G (passoire energetique) interdit a la location depuis 2025
    if (habitation.dpe_classe_energie === "G" && habitation.type_bail !== "colocation") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dpe_classe_energie"],
        message: "Les logements classes G (passoires thermiques) sont interdits a la location depuis le 1er janvier 2025. Seules les colocations beneficient d'une derogation temporaire.",
      });
    }

    // SOTA 2026: Surface Carrez ne peut pas depasser la surface habitable
    if (habitation.surface_carrez && habitation.surface_habitable_m2 && habitation.surface_carrez > habitation.surface_habitable_m2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["surface_carrez"],
        message: "La surface Carrez ne peut pas depasser la surface habitable",
      });
    }

    // SOTA 2026: Surface minimale pour habitation (9m2 loi Carrez / decret decence)
    if (habitation.surface_habitable_m2 && habitation.surface_habitable_m2 < 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["surface_habitable_m2"],
        message: "La surface habitable minimale est de 9m2 pour un logement decent",
      });
    }
  }

  // Appliquer les validations conditionnelles pour immeuble
  if (data.type_bien === "immeuble") {
    const immeuble = data as z.infer<typeof immeubleSchemaV3Base>;
    // SOTA 2026: Validation cohérence lots/étages
    const maxFloorInUnits = Math.max(...immeuble.building_units.map(u => u.floor), 0);
    if (maxFloorInUnits >= immeuble.building_floors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["building_floors"],
        message: `Le nombre d'étages (${immeuble.building_floors}) doit être supérieur au plus haut étage des lots (${maxFloorInUnits})`,
      });
    }

    // Validation unicité position par étage
    const positionsByFloor = new Map<number, Set<string>>();
    for (const unit of immeuble.building_units) {
      if (!positionsByFloor.has(unit.floor)) {
        positionsByFloor.set(unit.floor, new Set());
      }
      const positions = positionsByFloor.get(unit.floor)!;
      if (positions.has(unit.position)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["building_units"],
          message: `Position "${unit.position}" dupliquée à l'étage ${unit.floor}`,
        });
      }
      positions.add(unit.position);
    }
  }
});

// ============================================
// SCHÉMAS POUR UPDATE (PARTIELS)
// ============================================
// Source : Besoin pour les PATCH (mise à jour progressive)
// Décision : Schémas partiels pour chaque type

export const habitationUpdateSchemaV3 = habitationSchemaV3Base.partial().extend({
  type_bien: z.enum(["appartement", "maison", "studio", "colocation", "saisonnier"]).optional(),
});

export const parkingUpdateSchemaV3 = parkingSchemaV3.partial().extend({
  type_bien: z.enum(["parking", "box"]).optional(),
});

export const localProUpdateSchemaV3 = localProSchemaV3.partial().extend({
  type_bien: z.enum(["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"]).optional(),
});

export const immeubleUpdateSchemaV3 = immeubleSchemaV3Base.partial().extend({
  type_bien: z.literal("immeuble").optional(),
});

export const propertyUpdateSchemaV3 = z.union([
  habitationUpdateSchemaV3,
  parkingUpdateSchemaV3,
  localProUpdateSchemaV3,
  immeubleUpdateSchemaV3,
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
export type ImmeubleV3Input = z.infer<typeof immeubleSchemaV3>;
export type BuildingUnitInput = z.infer<typeof buildingUnitSchema>;
export type RoomV3Input = z.infer<typeof roomSchemaV3>;
export type PhotoV3Input = z.infer<typeof photoSchemaV3>;
export type PropertyV3UpdateInput = z.infer<typeof propertyUpdateSchemaV3>;
export type HabitationV3UpdateInput = z.infer<typeof habitationUpdateSchemaV3>;
export type ParkingV3UpdateInput = z.infer<typeof parkingUpdateSchemaV3>;
export type LocalProV3UpdateInput = z.infer<typeof localProUpdateSchemaV3>;
export type ImmeubleV3UpdateInput = z.infer<typeof immeubleUpdateSchemaV3>;

