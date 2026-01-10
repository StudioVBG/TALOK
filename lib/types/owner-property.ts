/**
 * Types pour les propriétés du compte propriétaire
 * Utilisés par /api/owner/properties
 */

import type { PropertyRow } from "@/lib/supabase/typed-client";

/**
 * Classes DPE (Diagnostic de Performance Énergétique)
 */
export type DpeClasse = "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;

/**
 * Types de biens
 */
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
  | "fonds_de_commerce"
  | "immeuble";

/**
 * États de publication d'un bien
 */
export type PropertyEtat = "draft" | "pending_review" | "published" | "rejected" | "archived";

/**
 * Propriété enrichie avec les données nécessaires pour l'affichage
 */
export interface OwnerProperty extends Omit<PropertyRow, 'surface' | 'nb_pieces'> {
  // Données de base (depuis PropertyRow)
  id: string;
  owner_id: string;
  type: PropertyType | string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  complement_adresse?: string;
  nom?: string;

  // Coordonnées géographiques
  latitude?: number | null;
  longitude?: number | null;

  // Surface : normalisé depuis surface_habitable_m2 (V3) ou surface (legacy)
  surface: number | null;
  surface_habitable_m2?: number | null; // V3 - source primaire

  // Pièces et chambres
  nb_pieces: number | null;
  nb_chambres?: number | null;
  etage?: number | null;
  ascenseur?: boolean;
  meuble?: boolean;

  // Loyer et charges
  loyer_hc: number | null;
  loyer_base?: number | null;
  charges_mensuelles?: number | null;
  depot_garantie?: number | null;

  // État du bien
  etat: PropertyEtat | string;
  created_at: string;
  updated_at?: string;

  // DPE (Diagnostic de Performance Énergétique)
  dpe_classe_energie?: DpeClasse;
  dpe_classe_climat?: DpeClasse;
  energie?: string;
  ges?: string;

  // Chauffage et climatisation
  chauffage_type?: "individuel" | "collectif" | "aucun" | null;
  chauffage_energie?: "electricite" | "gaz" | "fioul" | "bois" | "reseau_urbain" | "autre" | null;
  eau_chaude_type?: "electrique_indiv" | "gaz_indiv" | "collectif" | "solaire" | "autre" | null;
  clim_presence?: "aucune" | "fixe" | "mobile" | null;
  clim_type?: "split" | "gainable" | null;

  // Extérieurs et annexes
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;

  // Parking (pour type parking/box)
  parking_type?: "place_exterieure" | "place_couverte" | "box" | "souterrain" | null;
  parking_numero?: string | null;
  parking_niveau?: string | null;
  parking_gabarit?: "citadine" | "berline" | "suv" | "utilitaire" | "2_roues" | null;
  parking_acces?: string[];
  parking_portail_securise?: boolean;
  parking_video_surveillance?: boolean;
  parking_gardien?: boolean;

  // Local professionnel
  local_surface_totale?: number | null;
  local_type?: "boutique" | "restaurant" | "bureaux" | "atelier" | "stockage" | "autre" | null;
  local_has_vitrine?: boolean;
  local_access_pmr?: boolean;
  local_clim?: boolean;
  local_fibre?: boolean;
  local_alarme?: boolean;
  local_rideau_metal?: boolean;
  local_acces_camion?: boolean;
  local_parking_clients?: boolean;

  // Visite virtuelle
  visite_virtuelle_url?: string | null;

  // Données enrichies (ajoutées par l'API)
  cover_url: string | null;
  cover_document_id: string | null;
  documents_count: number;

  // Données calculées côté client (optionnel)
  status?: "loue" | "en_preavis" | "vacant";
  currentLease?: LeaseInfo | null;
  monthlyRent?: number;
}

/**
 * Info basique sur un bail (pour l'affichage dans PropertyDetails)
 */
export interface LeaseInfo {
  id: string;
  statut: string;
  date_debut?: string;
  date_fin?: string;
  tenants?: TenantInfo[];
  edls?: EdlInfo[];
}

/**
 * Info basique sur un locataire
 */
export interface TenantInfo {
  id: string;
  role: string;
  profile?: {
    prenom?: string;
    nom?: string;
  };
  invited_name?: string;
}

/**
 * Info basique sur un EDL
 */
export interface EdlInfo {
  id: string;
  type: "entree" | "sortie";
  status: string;
}

/**
 * Photo d'un bien
 */
export interface PropertyPhoto {
  id: string;
  property_id: string;
  room_id?: string | null;
  url: string;
  storage_path?: string;
  is_main: boolean;
  tag?: string;
  ordre: number;
  created_at?: string;
  updated_at?: string;
  // Pour les photos en attente d'upload
  isPending?: boolean;
  pendingIndex?: number;
}

/**
 * Réponse de l'API /api/owner/properties
 */
export interface OwnerPropertiesResponse {
  properties: OwnerProperty[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}



