/**
 * Types TypeScript pour le modèle Building (Immeuble) SOTA 2026
 * 
 * Permet la gestion d'immeubles entiers avec plusieurs lots/unités.
 * Intègre visualisation isométrique, duplication rapide, et import cadastre.
 */

// ============================================
// 1. TYPES DE BASE POUR LOTS/UNITÉS
// ============================================

export type BuildingUnitType = 
  | "appartement" 
  | "studio" 
  | "local_commercial" 
  | "parking" 
  | "cave"
  | "bureau";

export type BuildingUnitStatus = 
  | "vacant"      // Libre, disponible à la location
  | "occupe"      // Actuellement loué
  | "travaux"     // En rénovation/travaux
  | "reserve";    // Réservé (promesse de bail)

// Templates prédéfinis pour création rapide
export type UnitTemplate = 
  | "studio" 
  | "t1" 
  | "t2" 
  | "t3" 
  | "t4" 
  | "t5" 
  | "local" 
  | "parking" 
  | "cave";

// ============================================
// 2. INTERFACE BUILDING UNIT (LOT)
// ============================================

export interface BuildingUnit {
  id: string;
  building_id: string;

  // Position dans l'immeuble
  floor: number;              // 0 = RDC, 1 = 1er étage, etc.
  position: string;           // "A", "B", "gauche", "droite", etc.

  // Type et caractéristiques
  type: BuildingUnitType;
  surface: number;
  nb_pieces: number;
  template?: UnitTemplate;
  meuble?: boolean;           // SOTA 2026 — fin du hardcode studio/local

  // Conditions de location
  loyer_hc: number;
  charges: number;
  depot_garantie: number;

  // Statut actuel
  status: BuildingUnitStatus;
  
  // Liaisons (optionnelles, remplies quand occupé)
  current_lease_id?: string | null;
  current_tenant_id?: string | null;
  current_tenant_name?: string | null;
  
  // Métadonnées
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. INTERFACE BUILDING (IMMEUBLE)
// ============================================

export interface Building {
  id: string;
  owner_id: string;
  property_id?: string | null;  // Lien vers property si créé via wizard
  
  // Identification
  name: string;                 // Ex: "Résidence Les Oliviers"
  
  // Adresse
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement?: string;
  latitude?: number | null;
  longitude?: number | null;
  
  // Structure physique
  floors: number;               // Nombre d'étages (1-50)
  construction_year?: number;
  surface_totale?: number;      // Surface totale de l'immeuble
  
  // Parties communes
  has_ascenseur: boolean;
  has_gardien: boolean;
  has_interphone: boolean;
  has_digicode: boolean;
  has_local_velo: boolean;
  has_local_poubelles: boolean;
  
  // Stats calculées (via vue SQL)
  total_units?: number;
  total_parkings?: number;
  total_caves?: number;
  occupancy_rate?: number;
  revenus_potentiels?: number;
  
  // Relations
  units?: BuildingUnit[];
  
  // Métadonnées
  created_at: string;
  updated_at: string;
}

// ============================================
// 4. CONSTANTES UI - TEMPLATES DE LOTS
// ============================================

export interface UnitTemplateConfig {
  id: UnitTemplate;
  label: string;
  surface: number;
  nb_pieces: number;
  icon: string;
  type: BuildingUnitType;
  defaultLoyer?: number;
}

export const UNIT_TEMPLATES: UnitTemplateConfig[] = [
  { id: "studio", label: "Studio", surface: 25, nb_pieces: 1, icon: "🔑", type: "appartement" },
  { id: "t1", label: "T1", surface: 30, nb_pieces: 1, icon: "1️⃣", type: "appartement" },
  { id: "t2", label: "T2", surface: 45, nb_pieces: 2, icon: "2️⃣", type: "appartement" },
  { id: "t3", label: "T3", surface: 65, nb_pieces: 3, icon: "3️⃣", type: "appartement" },
  { id: "t4", label: "T4", surface: 85, nb_pieces: 4, icon: "4️⃣", type: "appartement" },
  { id: "t5", label: "T5+", surface: 100, nb_pieces: 5, icon: "5️⃣", type: "appartement" },
  { id: "local", label: "Local", surface: 50, nb_pieces: 1, icon: "🏪", type: "local_commercial" },
  { id: "parking", label: "Parking", surface: 12, nb_pieces: 0, icon: "🚗", type: "parking" },
  { id: "cave", label: "Cave", surface: 8, nb_pieces: 0, icon: "🪨", type: "cave" },
];

// ============================================
// 5. TYPES POUR FORMULAIRE WIZARD
// ============================================

export interface BuildingFormData {
  // Infos de base
  name: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement?: string;

  // Structure
  building_floors: number;
  construction_year?: number;
  surface_totale?: number;

  // Mode de possession (SOTA 2026)
  ownership_type?: 'full' | 'partial';
  total_lots_in_building?: number;

  // Parties communes
  has_ascenseur: boolean;
  has_gardien: boolean;
  has_interphone: boolean;
  has_digicode: boolean;
  has_local_velo: boolean;
  has_local_poubelles: boolean;
  has_parking_commun?: boolean;
  has_jardin_commun?: boolean;

  // Lots (état temporaire du wizard)
  building_units: BuildingUnit[];
}

export type BuildingOwnershipType = 'full' | 'partial';

// ============================================
// 6. TYPES POUR ACTIONS/API
// ============================================

export interface CreateBuildingPayload {
  name: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement?: string;
  floors: number;
  construction_year?: number;
  has_ascenseur?: boolean;
  has_gardien?: boolean;
  has_interphone?: boolean;
  has_digicode?: boolean;
  has_local_velo?: boolean;
  has_local_poubelles?: boolean;
}

export interface CreateBuildingUnitPayload {
  building_id: string;
  floor: number;
  position: string;
  type: BuildingUnitType;
  surface: number;
  nb_pieces: number;
  template?: UnitTemplate;
  loyer_hc?: number;
  charges?: number;
  depot_garantie?: number;
}

export interface BulkCreateUnitsPayload {
  building_id: string;
  units: Omit<CreateBuildingUnitPayload, 'building_id'>[];
}

// ============================================
// 7. TYPES POUR STATISTIQUES
// ============================================

export interface BuildingStats {
  id: string;
  name: string;
  owner_id: string;
  total_units: number;
  total_parkings: number;
  total_caves: number;
  surface_totale: number;
  revenus_potentiels: number;
  occupancy_rate: number;
  vacant_units: number;
  occupied_units: number;
}

// ============================================
// 8. HELPERS
// ============================================

/**
 * Retourne le label français pour un type de lot
 */
export function getUnitTypeLabel(type: BuildingUnitType): string {
  const labels: Record<BuildingUnitType, string> = {
    appartement: "Appartement",
    studio: "Studio",
    local_commercial: "Local commercial",
    parking: "Parking",
    cave: "Cave",
    bureau: "Bureau",
  };
  return labels[type] || type;
}

/**
 * Retourne le label français pour un statut de lot
 */
export function getUnitStatusLabel(status: BuildingUnitStatus): string {
  const labels: Record<BuildingUnitStatus, string> = {
    vacant: "Vacant",
    occupe: "Occupé",
    travaux: "Travaux",
    reserve: "Réservé",
  };
  return labels[status] || status;
}

/**
 * Retourne la couleur associée à un statut
 */
export function getUnitStatusColor(status: BuildingUnitStatus): string {
  const colors: Record<BuildingUnitStatus, string> = {
    vacant: "blue",
    occupe: "emerald",
    travaux: "amber",
    reserve: "purple",
  };
  return colors[status] || "slate";
}

/**
 * Génère un ID unique pour un nouveau lot
 */
export function generateUnitId(): string {
  return crypto.randomUUID();
}

/**
 * Calcule le prochain nom de position disponible pour un étage
 */
export function getNextPosition(units: BuildingUnit[], floor: number): string {
  const floorUnits = units.filter(u => u.floor === floor);
  const usedPositions = new Set(floorUnits.map(u => u.position));
  
  // Essayer A, B, C, D, etc.
  for (let i = 0; i < 26; i++) {
    const pos = String.fromCharCode(65 + i);
    if (!usedPositions.has(pos)) {
      return pos;
    }
  }
  
  // Fallback: numéro
  return String(floorUnits.length + 1);
}

