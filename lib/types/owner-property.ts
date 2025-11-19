/**
 * Types pour les propriétés du compte propriétaire
 * Utilisés par /api/owner/properties
 */

import type { PropertyRow } from "@/lib/supabase/typed-client";

/**
 * Propriété enrichie avec les données nécessaires pour l'affichage
 */
export interface OwnerProperty extends PropertyRow {
  // Données de base (depuis PropertyRow)
  id: string;
  owner_id: string;
  type: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  surface: number | null;
  nb_pieces: number | null;
  loyer_hc: number | null;
  etat: string;
  created_at: string;

  // Données enrichies (ajoutées par l'API)
  cover_url: string | null;
  cover_document_id: string | null;
  documents_count: number;
  loyer_base?: number; // Alias pour loyer_hc (compatibilité)

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


