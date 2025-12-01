/**
 * Types pour les propriétés du compte propriétaire
 * Utilisés par /api/owner/properties
 */

import type { PropertyRow } from "@/lib/supabase/typed-client";

/**
 * Propriété enrichie avec les données nécessaires pour l'affichage
 */
export interface OwnerProperty extends Omit<PropertyRow, 'surface' | 'nb_pieces'> {
  // Données de base (depuis PropertyRow)
  id: string;
  owner_id: string;
  type: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  
  // Surface : normalisé depuis surface_habitable_m2 (V3) ou surface (legacy)
  surface: number | null;
  surface_habitable_m2?: number | null; // V3 - source primaire
  
  // Pièces et chambres
  nb_pieces: number | null;
  nb_chambres?: number | null; // Nombre de chambres
  
  // Loyer : normalisé depuis loyer_hc (V3) ou loyer_base (legacy)
  loyer_hc: number | null;
  loyer_base?: number | null; // Legacy - alias pour compatibilité
  
  etat: string;
  created_at: string;

  // DPE (Diagnostic de Performance Énergétique)
  dpe_classe_energie?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_classe_climat?: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;

  // Données enrichies (ajoutées par l'API)
  cover_url: string | null;
  cover_document_id: string | null;
  documents_count: number;

  // Données calculées côté client (optionnel)
  status?: "loue" | "en_preavis" | "vacant";
  currentLease?: any;
  monthlyRent?: number;
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


