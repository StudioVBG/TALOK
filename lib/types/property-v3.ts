/**
 * Types TypeScript pour le modèle Property V3
 * 
 * Sources :
 * - Modèle détaillé fourni par l'utilisateur
 * - Types existants : lib/types/index.ts
 * - Migration BDD : supabase/migrations/202502150000_property_model_v3.sql
 * 
 * Ce fichier étend/complète les types existants pour le nouveau modèle V3
 */

import { Home } from "lucide-react";
import type {
  HeatingType,
  HeatingEnergy,
  HotWaterType,
  ClimatePresence,
  ClimateType,
} from "./index";

// ============================================
// 1. TYPES DE BIENS (PIVOT)
// ============================================
// Source modèle V3 : liste complète des types
// Source existante : lib/types/index.ts ligne 5-14 (ajout de "studio" et "box")
// Décision : Nouvelle définition alignée avec le modèle V3, remplace celle existante

export type PropertyTypeV3 =
  | "appartement"
  | "maison"
  | "studio"              // Nouveau (modèle V3)
  | "villa"               // Villa / maison de luxe
  | "chambre"             // Chambre (colocation, chez l'habitant)
  | "colocation"
  | "saisonnier"          // Location saisonnière / meublé de tourisme
  | "parking"
  | "box"                 // Nouveau (modèle V3) - distinct de parking
  | "cave_cellier"        // Cave / cellier indépendant
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "fonds_de_commerce"
  | "immeuble"            // SOTA 2026 - Immeuble entier multi-lots
  | "terrain_nu"          // Terrain nu constructible ou non
  | "terrain_agricole"    // Bail rural - terrain agricole
  | "exploitation_agricole" // Bail rural - exploitation agricole (ferme)
  // DOM-TOM spécifiques
  | "case_creole"         // Case créole / maison traditionnelle DOM-TOM
  | "bungalow"            // Bungalow (DOM-TOM)
  | "logement_social";    // Logement social (LLS, LLTS, PLS)

// Note : "saisonnier" retiré du modèle V3 mais conservé dans la BDD pour rétrocompatibilité

// ============================================
// 2. GROUPES VISUELS (ÉTAPE 1)
// ============================================
// Source modèle V3 : blocs pour l'écran de sélection du type
// Permet de structurer l'UI en 3 groupes logiques

export const PROPERTY_TYPE_GROUPS = {
  // SOTA 2026 : Immeuble en premier (featured)
  immeuble: [
    { value: "immeuble" as const, label: "Immeuble entier", icon: "🏢", featured: true, description: "Gérez plusieurs lots d'un coup" },
  ],
  habitation: [
    { value: "appartement" as const, label: "Appartement", icon: "📦" },
    { value: "maison" as const, label: "Maison", icon: "🏡" },
    { value: "villa" as const, label: "Villa", icon: "🏖" },
    { value: "studio" as const, label: "Studio", icon: "🔑" },
    { value: "chambre" as const, label: "Chambre", icon: "🛏" },
    { value: "colocation" as const, label: "Colocation", icon: "🧑‍🤝‍🧑" },
    { value: "saisonnier" as const, label: "Saisonnier / Tourisme", icon: "🏖" },
    { value: "logement_social" as const, label: "Logement social", icon: "🏘" },
  ],
  dom_tom: [
    { value: "case_creole" as const, label: "Case créole", icon: "🌴" },
    { value: "bungalow" as const, label: "Bungalow", icon: "🏕" },
  ],
  parking: [
    { value: "parking" as const, label: "Place de parking", icon: "🚗" },
    { value: "box" as const, label: "Box / Garage", icon: "🚙" },
    { value: "cave_cellier" as const, label: "Cave / Cellier", icon: "🧱" },
  ],
  locaux: [
    { value: "local_commercial" as const, label: "Local commercial / Boutique", icon: "🏬" },
    { value: "bureaux" as const, label: "Bureaux / Tertiaire", icon: "🧑‍💼" },
    { value: "entrepot" as const, label: "Entrepôt / Atelier / Logistique", icon: "🏭" },
    { value: "fonds_de_commerce" as const, label: "Fonds de commerce / Local mixte", icon: "🛍" },
  ],
  terrain: [
    { value: "terrain_nu" as const, label: "Terrain nu", icon: "🏗" },
    { value: "terrain_agricole" as const, label: "Terrain agricole", icon: "🌾" },
    { value: "exploitation_agricole" as const, label: "Exploitation agricole / Ferme", icon: "🏚" },
  ],
} as const;

// ============================================
// 3. STATUT WORKFLOW
// ============================================
// Source modèle V3 : status avec 'pending_review'
// Source existante : lib/types/index.ts ligne 24 (valeur 'en_attente' différente)
// Décision : Nouvelle définition alignée avec la BDD (etat), utilise 'pending_review'

export type PropertyStatusV3 =
  | "draft"
  | "pending_review"      // Renommé depuis 'pending' pour correspondre au modèle V3
  | "published"
  | "rejected"
  | "archived";

// ============================================
// 4. PARKING / BOX
// ============================================
// Source modèle V3 : types structurés pour parking
// Source existante : lib/types/index.ts ligne 47-50 (ParkingPlacementType, etc.)
// Décision : Nouveaux types alignés avec les colonnes BDD structurées (pas JSONB)

export type ParkingTypeV3 =
  | "place_exterieure"
  | "place_couverte"
  | "box"
  | "souterrain";

export type ParkingGabaritV3 =
  | "citadine"
  | "berline"
  | "suv"
  | "utilitaire"
  | "2_roues";

export type ParkingAccesV3 =
  | "badge"
  | "telecommande"
  | "cle"
  | "digicode"
  | "acces_libre";

// Note : Les anciens types ParkingPlacementType, ParkingVehicleProfile, ParkingAccessType
// sont conservés pour compatibilité avec parking_details JSONB, mais les nouveaux types V3
// doivent être utilisés pour les nouvelles colonnes structurées.

// ============================================
// 5. LOCAUX PRO
// ============================================
// Source modèle V3 : types pour locaux commerciaux/professionnels
// Source existante : Aucun type spécifique actuellement
// Décision : Nouveaux types basés sur le modèle V3

export type LocalTypeV3 =
  | "boutique"
  | "restaurant"
  | "bureaux"
  | "atelier"
  | "stockage"
  | "autre";

// ============================================
// 6. TYPES DE BAIL
// ============================================
// Source modèle V3 : types de bail selon le type de bien
// Source existante : lib/types/index.ts ligne 86-96 (LeaseType pour les baux créés)
// Décision : Nouveaux types pour properties.type_bail (conditions préalables au bail)

export type TypeBailHabitationV3 = "vide" | "meuble" | "colocation";
export type TypeBailParkingV3 = "parking_seul" | "accessoire_logement";
export type TypeBailProV3 = "3_6_9" | "derogatoire" | "precaire" | "professionnel" | "autre";

export type TypeBailV3 = TypeBailHabitationV3 | TypeBailParkingV3 | TypeBailProV3;

// ============================================
// 7. ÉQUIPEMENTS
// ============================================
// Source modèle V3 : liste standardisée d'équipements
// Source existante : Aucune liste standardisée actuellement
// Décision : Nouveau type basé sur le modèle V3, liste complète

export type EquipmentV3 =
  | "wifi"
  | "television"
  | "cuisine_equipee"
  | "lave_linge"
  | "lave_vaisselle"
  | "micro_ondes"
  | "machine_a_cafe"
  | "fer_repasser"
  | "seche_cheveux"
  | "balcon"
  | "terrasse"
  | "jardin"
  | "piscine"
  | "salle_sport"
  | "local_velo"
  | "parking_residence"
  | "animaux_acceptes"
  | "equipement_bebe"
  | "climatisation";

// Liste d'équipements pour l'UI (groupe par catégories)
export const HAB_EQUIPMENTS: EquipmentV3[] = [
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
];

// ============================================
// 8. TYPE DE PIÈCE (ROOMS)
// ============================================
// Source modèle V3 : ajout de 'jardin'
// Source existante : lib/types/index.ts ligne 32-43 (RoomType)
// Décision : Extension du type existant avec 'jardin'

export type RoomTypeV3 =
  // Espaces de vie
  | "sejour"
  | "salon_cuisine"       // SOTA 2025 : Espace ouvert salon/cuisine
  | "salon_sam"           // SOTA 2025 : Salon/Salle à manger
  | "open_space"          // SOTA 2025 : Séjour + Cuisine + SAM
  // Espaces nuit
  | "chambre"
  | "suite_parentale"     // SOTA 2025 : Chambre + SDB
  | "suite_enfant"        // SOTA 2025 : Chambre enfant + SDB
  | "mezzanine"           // SOTA 2025
  // Pièces fonctionnelles
  | "cuisine"
  | "cuisine_americaine"  // SOTA 2025 : Cuisine ouverte
  | "bureau"              // Nouveau
  | "dressing"            // Nouveau
  | "buanderie"           // Nouveau
  | "cellier"             // Nouveau
  // Sanitaires
  | "salle_de_bain"
  | "salle_eau"           // Douche uniquement
  | "wc"
  // Circulations
  | "entree"
  | "couloir"
  // Extérieurs & annexes
  | "balcon"
  | "terrasse"
  | "jardin"
  | "cave"                // Nouveau
  // Locaux pro
  | "emplacement"         // Parking
  | "box"                 // Parking
  | "stockage"            // Entrepôt
  | "autre";

// ============================================
// 9. TAGS PHOTOS
// ============================================
// Source modèle V3 : tags étendus pour parking/local
// Source existante : lib/types/index.ts ligne 45 (PhotoTag limité)
// Décision : Extension du type pour inclure les nouveaux tags

export type PhotoTagV3 =
  // Habitation
  | "vue_generale"
  | "plan"
  | "detail"
  | "exterieur"
  // Parking
  | "emplacement"
  | "acces"
  // Local pro
  | "façade"
  | "interieur"
  | "vitrine"
  // Générique
  | "autre";

// ============================================
// 9.1. CONSTANTES ROOM_TYPES (pour UI)
// ============================================
// Source : Utilisé dans rooms-photos-step.tsx
// Décision : Extraire dans lib/types pour réutilisation

export const ROOM_TYPES: { value: RoomTypeV3; label: string; icon: typeof Home }[] = [
  // Espaces de vie
  { value: "sejour", label: "Séjour", icon: Home },
  { value: "salon_cuisine", label: "Salon/Cuisine ouverte", icon: Home },
  { value: "salon_sam", label: "Salon/Salle à manger", icon: Home },
  { value: "open_space", label: "Open Space", icon: Home },
  // Espaces nuit
  { value: "chambre", label: "Chambre", icon: Home },
  { value: "suite_parentale", label: "Suite parentale", icon: Home },
  { value: "suite_enfant", label: "Suite enfant", icon: Home },
  { value: "mezzanine", label: "Mezzanine", icon: Home },
  // Pièces fonctionnelles
  { value: "cuisine", label: "Cuisine", icon: Home },
  { value: "cuisine_americaine", label: "Cuisine américaine", icon: Home },
  { value: "bureau", label: "Bureau", icon: Home },
  { value: "dressing", label: "Dressing", icon: Home },
  { value: "buanderie", label: "Buanderie", icon: Home },
  { value: "cellier", label: "Cellier", icon: Home },
  // Sanitaires
  { value: "salle_de_bain", label: "Salle de bain", icon: Home },
  { value: "salle_eau", label: "Salle d'eau", icon: Home },
  { value: "wc", label: "WC", icon: Home },
  // Circulations
  { value: "entree", label: "Entrée", icon: Home },
  { value: "couloir", label: "Couloir", icon: Home },
  // Extérieurs
  { value: "balcon", label: "Balcon", icon: Home },
  { value: "terrasse", label: "Terrasse", icon: Home },
  { value: "jardin", label: "Jardin", icon: Home },
  { value: "cave", label: "Cave", icon: Home },
  // Locaux pro
  { value: "emplacement", label: "Emplacement", icon: Home },
  { value: "box", label: "Box", icon: Home },
  { value: "stockage", label: "Stockage", icon: Home },
  { value: "autre", label: "Autre", icon: Home },
];

// ============================================
// 9.2. CONSTANTES PHOTO_TAGS (pour UI)
// ============================================
// Source : Utilisé dans rooms-photos-step.tsx
// Décision : Extraire dans lib/types pour réutilisation, utiliser PhotoTagV3

export const PHOTO_TAGS: { value: PhotoTagV3; label: string }[] = [
  { value: "vue_generale", label: "Vue générale" },
  { value: "plan", label: "Plan" },
  { value: "detail", label: "Détail" },
  { value: "exterieur", label: "Extérieur" },
  { value: "emplacement", label: "Emplacement" },
  { value: "acces", label: "Accès" },
  { value: "façade", label: "Façade" },
  { value: "interieur", label: "Intérieur" },
  { value: "vitrine", label: "Vitrine" },
  { value: "autre", label: "Autre" },
];

// ============================================
// 10. INTERFACE PROPERTY V3 COMPLÈTE
// ============================================
// Source modèle V3 : toutes les colonnes détaillées
// Source existante : lib/types/index.ts ligne 223-288 (Property interface)
// Décision : Extension de l'interface existante avec les nouvelles colonnes

export interface PropertyV3 {
  // Colonnes existantes (héritées de Property)
  id: string;
  owner_id: string;
  type: PropertyTypeV3;
  etat: PropertyStatusV3;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
  latitude?: number | null;
  longitude?: number | null;
  surface: number;
  surface_habitable_m2?: number | null;
  nb_pieces: number;
  nb_chambres?: number | null;
  etage: number | null;
  ascenseur: boolean;
  meuble?: boolean;
  energie: string | null;
  ges: string | null;
  
  // Nouveautés V3 : Adresse
  complement_adresse?: string | null;
  
  // Nouveautés V3 : Extérieurs
  has_balcon: boolean;
  has_terrasse: boolean;
  has_jardin: boolean;
  has_cave: boolean;
  
  // Nouveautés V3 : Équipements
  equipments: EquipmentV3[];
  
  // Nouveautés V3 : Parking/Box structuré
  parking_type?: ParkingTypeV3 | null;
  parking_numero?: string | null;
  parking_niveau?: string | null;
  parking_gabarit?: ParkingGabaritV3 | null;
  parking_acces: ParkingAccesV3[];
  parking_portail_securise: boolean;
  parking_video_surveillance: boolean;
  parking_gardien: boolean;
  
  // Nouveautés V3 : Locaux pro
  local_surface_totale?: number | null;
  local_type?: LocalTypeV3 | null;
  local_has_vitrine: boolean;
  local_access_pmr: boolean;
  local_clim: boolean;
  local_fibre: boolean;
  local_alarme: boolean;
  local_rideau_metal: boolean;
  local_acces_camion: boolean;
  local_parking_clients: boolean;
  
  // Nouveautés V3 : Conditions de location
  type_bail?: TypeBailV3 | null;
  preavis_mois?: number | null;
  
  // Chauffage & confort (existant)
  chauffage_type?: HeatingType | null;
  chauffage_energie?: HeatingEnergy;
  eau_chaude_type?: HotWaterType;
  clim_presence?: ClimatePresence;
  clim_type?: ClimateType;
  
  // Financier (existant)
  loyer_base: number;
  loyer_hc?: number | null;
  charges_mensuelles: number;
  depot_garantie: number;
  
  // Visite virtuelle (Matterport, Nodalview, etc.)
  visite_virtuelle_url?: string | null;
  
  // Métadonnées (existant)
  unique_code: string;
  status?: string; // Généré par la BDD
  submitted_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  
  // Compatibilité : parking_details JSONB conservé pour migration progressive
  parking_details?: any | null;
}

// ============================================
// 11. INTERFACES ROOM & PHOTO V3
// ============================================
// Source : Extensions de Room et Photo avec types V3
// Décision : Types compatibles avec RoomTypeV3 et PhotoTagV3

export interface RoomV3 {
  id: string;
  property_id: string;
  type_piece: RoomTypeV3;  // ✅ Utilise RoomTypeV3 au lieu de RoomType
  label_affiche: string;
  surface_m2: number | null;
  chauffage_present: boolean;
  chauffage_type_emetteur?: "radiateur" | "plancher" | "convecteur" | "poele" | null;
  clim_presente: boolean;
  ordre: number;
  created_at?: string;
  updated_at?: string;
}

export interface PhotoV3 {
  id: string;
  property_id: string;
  room_id: string | null;
  url: string;
  is_main: boolean;
  tag: PhotoTagV3 | null;  // ✅ Utilise PhotoTagV3 au lieu de PhotoTag
  ordre: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 12. METER TYPES (Compteurs)
// ============================================

export type MeterTypeV3 = "electricity" | "gas" | "water" | "hot_water" | "heating";

export interface PropertyMeterV3 {
  id: string;
  property_id: string;
  meter_type: MeterTypeV3;
  meter_number: string | null;
  location: string | null;
  is_individual: boolean;
  provider: string | null;
  last_reading_value: number | null;
  last_reading_date: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export const METER_TYPES: { value: MeterTypeV3; label: string; icon: string }[] = [
  { value: "electricity", label: "Électricité", icon: "⚡" },
  { value: "gas", label: "Gaz", icon: "🔥" },
  { value: "water", label: "Eau froide", icon: "💧" },
  { value: "hot_water", label: "Eau chaude", icon: "♨️" },
  { value: "heating", label: "Chauffage", icon: "🌡️" },
];

// ============================================
// 13. DIAGNOSTIC TYPES
// ============================================

export type DiagnosticTypeV3 =
  | "dpe"
  | "amiante"
  | "plomb"
  | "termites"
  | "electricite"
  | "gaz"
  | "erp"
  | "bruit"
  | "assainissement"
  | "merule"
  | "radon"
  | "surface_carrez"
  | "risques_naturels";

export interface PropertyDiagnosticV3 {
  id: string;
  property_id: string;
  diagnostic_type: DiagnosticTypeV3;
  date_performed: string | null;
  expiry_date: string | null;
  result: Record<string, unknown>;
  document_url: string | null;
  document_id: string | null;
  provider_name: string | null;
  provider_certification: string | null;
  is_valid: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export const DIAGNOSTIC_TYPES: { value: DiagnosticTypeV3; label: string; validity_years: number | null; description: string }[] = [
  { value: "dpe", label: "DPE (Diagnostic de Performance Énergétique)", validity_years: 10, description: "Obligatoire pour toute location" },
  { value: "electricite", label: "Diagnostic électricité", validity_years: 6, description: "Obligatoire si installation > 15 ans" },
  { value: "gaz", label: "Diagnostic gaz", validity_years: 6, description: "Obligatoire si installation > 15 ans" },
  { value: "plomb", label: "CREP (Constat de Risque d'Exposition au Plomb)", validity_years: 6, description: "Obligatoire si construit avant 1949" },
  { value: "amiante", label: "Diagnostic amiante", validity_years: null, description: "Obligatoire si permis avant juillet 1997" },
  { value: "termites", label: "État relatif aux termites", validity_years: 0.5, description: "Obligatoire en zone à risque et DOM-TOM" },
  { value: "erp", label: "ERP (État des Risques et Pollutions)", validity_years: 0.5, description: "Obligatoire pour toute location" },
  { value: "bruit", label: "Diagnostic bruit", validity_years: null, description: "Obligatoire si zone d'exposition au bruit aérien" },
  { value: "assainissement", label: "Diagnostic assainissement", validity_years: 3, description: "Obligatoire si assainissement non collectif" },
  { value: "merule", label: "État relatif à la mérule", validity_years: 0.5, description: "Obligatoire en zone à risque" },
  { value: "radon", label: "Information radon", validity_years: null, description: "Zones à potentiel radon significatif" },
  { value: "surface_carrez", label: "Mesurage loi Carrez", validity_years: null, description: "Obligatoire en copropriété" },
  { value: "risques_naturels", label: "Risques naturels (cyclone, séisme, volcan)", validity_years: 0.5, description: "Obligatoire en DOM-TOM" },
];

// ============================================
// 14. EQUIPMENT TYPES (Detailed)
// ============================================

export type EquipmentCategoryV3 =
  | "kitchen"
  | "bathroom"
  | "heating"
  | "security"
  | "outdoor"
  | "furniture"
  | "appliance"
  | "connectivity"
  | "accessibility"
  | "storage"
  | "laundry"
  | "comfort"
  | "other";

export type EquipmentConditionV3 = "new" | "good" | "fair" | "poor" | "broken";

export interface PropertyEquipmentV3 {
  id: string;
  property_id: string;
  category: EquipmentCategoryV3;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  condition: EquipmentConditionV3;
  installation_date: string | null;
  warranty_end: string | null;
  is_included_in_lease: boolean;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export const EQUIPMENT_CATEGORIES: { value: EquipmentCategoryV3; label: string }[] = [
  { value: "kitchen", label: "Cuisine" },
  { value: "bathroom", label: "Salle de bain" },
  { value: "heating", label: "Chauffage / Climatisation" },
  { value: "security", label: "Sécurité" },
  { value: "outdoor", label: "Extérieur" },
  { value: "furniture", label: "Mobilier" },
  { value: "appliance", label: "Électroménager" },
  { value: "connectivity", label: "Connectivité" },
  { value: "accessibility", label: "Accessibilité" },
  { value: "storage", label: "Rangement" },
  { value: "laundry", label: "Buanderie" },
  { value: "comfort", label: "Confort" },
  { value: "other", label: "Autre" },
];

// ============================================
// 15. FURNISHED EQUIPMENT (Décret n°2015-981)
// ============================================
// Liste minimale des équipements obligatoires pour un meublé

export const FURNISHED_MANDATORY_EQUIPMENT = [
  { name: "Literie avec couette ou couverture", category: "furniture" as const },
  { name: "Volets ou rideaux occultants dans les chambres", category: "furniture" as const },
  { name: "Plaques de cuisson", category: "kitchen" as const },
  { name: "Four ou four à micro-ondes", category: "kitchen" as const },
  { name: "Réfrigérateur avec compartiment congélation ou congélateur", category: "kitchen" as const },
  { name: "Vaisselle et ustensiles de cuisine", category: "kitchen" as const },
  { name: "Table et sièges", category: "furniture" as const },
  { name: "Étagères de rangement", category: "storage" as const },
  { name: "Luminaires", category: "comfort" as const },
  { name: "Matériel d'entretien ménager", category: "other" as const },
] as const;

// ============================================
// 16. TAX REGIME TYPES
// ============================================

export type TaxRegimeV3 =
  | "micro_foncier"   // Revenus fonciers < 15 000€
  | "reel"            // Régime réel (revenus fonciers)
  | "micro_bic"       // Micro-BIC (meublé < 77 700€)
  | "lmnp"            // LMNP (Loueur Meublé Non Professionnel)
  | "lmp"             // LMP (Loueur Meublé Professionnel)
  | "sci_ir"          // SCI à l'IR
  | "sci_is";         // SCI à l'IS

export const TAX_REGIMES: { value: TaxRegimeV3; label: string; description: string }[] = [
  { value: "micro_foncier", label: "Micro-foncier", description: "Revenus fonciers < 15 000€/an, abattement 30%" },
  { value: "reel", label: "Régime réel", description: "Déduction des charges réelles (travaux, intérêts...)" },
  { value: "micro_bic", label: "Micro-BIC", description: "Meublé < 77 700€/an, abattement 50%" },
  { value: "lmnp", label: "LMNP", description: "Loueur Meublé Non Professionnel, amortissement possible" },
  { value: "lmp", label: "LMP", description: "Loueur Meublé Professionnel, revenus > 23 000€/an" },
  { value: "sci_ir", label: "SCI à l'IR", description: "Société Civile Immobilière à l'Impôt sur le Revenu" },
  { value: "sci_is", label: "SCI à l'IS", description: "Société Civile Immobilière à l'Impôt sur les Sociétés" },
];

