/**
 * Types partagés pour les composants de visualisation des propriétés
 * Architecture SOTA 2025 - Composition Pattern
 */

// ============================================
// TYPES DE BASE
// ============================================

export type PropertyType = 
  | "appartement" 
  | "maison" 
  | "studio" 
  | "colocation" 
  | "saisonnier"
  | "parking" 
  | "box"
  | "local_commercial" 
  | "bureaux" 
  | "entrepot" 
  | "fonds_de_commerce";

export type PropertyStatus = "vacant" | "loue" | "en_travaux" | "signature_en_cours";

export type LeaseStatus = "draft" | "pending_signature" | "active" | "terminated" | "expired";

// ============================================
// INTERFACES PRINCIPALES
// ============================================

export interface PropertyPhoto {
  id: string;
  url: string;
  type?: string;
  is_main?: boolean;
  created_at?: string;
}

export interface PropertyOwner {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  avatar_url?: string;
}

export interface PropertyTenant {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
}

export interface PropertyLease {
  id: string;
  statut: LeaseStatus;
  type_bail?: string;
  date_debut: string;
  date_fin?: string | null;
  loyer: number;
  charges?: number;
  depot_garantie?: number;
  tenants?: PropertyTenant[];
  lease_signers?: Array<{
    profile_id: string;
    role: string;
    signature_status: string;
    signed_at?: string;
  }>;
}

export interface PropertyMeter {
  id: string;
  type: "electricity" | "gas" | "water";
  meter_number: string;
  last_reading?: number;
  last_reading_date?: string;
}

export interface PropertyData {
  id: string;
  type: PropertyType;
  statut: PropertyStatus;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  
  // Coordonnées GPS
  latitude?: number;
  longitude?: number;
  
  // Caractéristiques communes
  surface?: number;
  nb_pieces?: number;
  nb_chambres?: number;
  nb_salles_de_bain?: number;
  etage?: number;
  ascenseur?: boolean;
  
  // Habitation
  meuble?: boolean;
  dpe_classe_energie?: string;
  dpe_classe_climat?: string;
  chauffage_type?: string;
  chauffage_energie?: string;
  eau_chaude_type?: string;
  clim_presence?: string;
  clim_type?: string;
  
  // Extérieurs
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;
  
  // Parking
  parking_type?: string;
  parking_numero?: string;
  parking_niveau?: string;
  parking_gabarit?: string;
  parking_portail_securise?: boolean;
  parking_video_surveillance?: boolean;
  parking_gardien?: boolean;
  
  // Local pro
  local_type?: string;
  local_surface_totale?: number;
  local_has_vitrine?: boolean;
  local_access_pmr?: boolean;
  local_clim?: boolean;
  local_fibre?: boolean;
  local_alarme?: boolean;
  local_rideau_metal?: boolean;
  local_acces_camion?: boolean;
  local_parking_clients?: boolean;
  
  // Financier
  loyer_hc?: number;
  charges_mensuelles?: number;
  depot_garantie?: number;
  
  // Média
  visite_virtuelle_url?: string;
  
  // Metadata
  created_at: string;
  updated_at?: string;
  unique_code?: string;
}

// ============================================
// PROPS DES COMPOSANTS
// ============================================

export interface PropertyPhotosGalleryProps {
  photos: PropertyPhoto[];
  propertyType?: PropertyType;
  address?: string;
  className?: string;
  onPhotoClick?: (index: number) => void;
  /** Mode édition pour owner */
  editable?: boolean;
  onPhotosChange?: (photos: PropertyPhoto[]) => void;
}

export interface PropertyCharacteristicsProps {
  property: PropertyData;
  className?: string;
  /** Affichage compact (badges) vs détaillé (grille) */
  variant?: "compact" | "detailed";
}

export interface PropertyOccupationProps {
  propertyId: string;
  lease?: PropertyLease | null;
  tenants?: PropertyTenant[];
  className?: string;
  /** Permettre les actions (créer bail, voir bail) */
  allowActions?: boolean;
  /** Lien personnalisé pour "Créer un bail" */
  createLeaseHref?: string;
  /** Lien personnalisé pour "Voir le bail" */
  viewLeaseHref?: (leaseId: string) => string;
}

export interface PropertyFinancialsProps {
  property: Pick<PropertyData, "loyer_hc" | "charges_mensuelles" | "depot_garantie">;
  className?: string;
  /** Mode édition */
  editable?: boolean;
  onChange?: (field: string, value: number) => void;
}

export interface PropertyOwnerInfoProps {
  owner: PropertyOwner;
  className?: string;
  /** Afficher les contacts (email, téléphone) - admin only */
  showContacts?: boolean;
  /** Lien vers le profil */
  profileHref?: string;
}

export interface PropertyLocationMapProps {
  latitude?: number;
  longitude?: number;
  address: string;
  className?: string;
  height?: string;
  zoom?: number;
}

// ============================================
// PROPS DU COMPOSANT PRINCIPAL
// ============================================

export type ViewerRole = "admin" | "owner" | "tenant";

export interface PropertyDetailsViewProps {
  // Données
  property: PropertyData;
  photos?: PropertyPhoto[];
  lease?: PropertyLease | null;
  owner?: PropertyOwner | null;
  meters?: PropertyMeter[];
  
  // Configuration du viewer
  viewerRole: ViewerRole;
  
  // Visibilité des sections
  showPhotos?: boolean;
  showMap?: boolean;
  showCharacteristics?: boolean;
  showOccupation?: boolean;
  showFinancials?: boolean;
  showMeters?: boolean;
  showOwnerInfo?: boolean;
  showVirtualTour?: boolean;
  
  // Permissions
  canEdit?: boolean;
  canDelete?: boolean;
  canCreateLease?: boolean;
  
  // Slots pour actions personnalisées
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  sidebarSlot?: React.ReactNode;
  
  // URLs personnalisées
  backHref?: string;
  backLabel?: string;
  editHref?: string;
  ownerProfileHref?: string;
  createLeaseHref?: string;
  viewLeaseHref?: (leaseId: string) => string;
  
  // Callbacks
  onEdit?: () => void;
  onDelete?: () => void;
  
  className?: string;
}

// ============================================
// HELPERS DE TYPE
// ============================================

export const HABITATION_TYPES: PropertyType[] = [
  "appartement", 
  "maison", 
  "studio", 
  "colocation", 
  "saisonnier"
];

export const PARKING_TYPES: PropertyType[] = ["parking", "box"];

export const PRO_TYPES: PropertyType[] = [
  "local_commercial", 
  "bureaux", 
  "entrepot", 
  "fonds_de_commerce"
];

export function isHabitationType(type: PropertyType): boolean {
  return HABITATION_TYPES.includes(type);
}

export function isParkingType(type: PropertyType): boolean {
  return PARKING_TYPES.includes(type);
}

export function isProType(type: PropertyType): boolean {
  return PRO_TYPES.includes(type);
}

export const STATUS_CONFIG: Record<PropertyStatus, { label: string; color: string }> = {
  vacant: { label: "Vacant", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  loue: { label: "Loué", color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  en_travaux: { label: "En travaux", color: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-400" },
  signature_en_cours: { label: "Signature en cours", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
};

export const TYPE_LABELS: Record<PropertyType, string> = {
  appartement: "Appartement",
  maison: "Maison",
  studio: "Studio",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  parking: "Parking",
  box: "Box",
  local_commercial: "Local commercial",
  bureaux: "Bureaux",
  entrepot: "Entrepôt",
  fonds_de_commerce: "Fonds de commerce",
};

