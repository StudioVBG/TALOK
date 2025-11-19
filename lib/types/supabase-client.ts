/**
 * Types pour les clients Supabase
 * 
 * Centralise les types pour éviter les répétitions de `any`
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Type pour le client Supabase avec types de base de données
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Type pour le service client Supabase (bypass RLS)
 */
export type ServiceSupabaseClient = SupabaseClient<Database>;

/**
 * Type pour les réponses Supabase génériques
 */
export type SupabaseResponse<T> = {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null;
};

/**
 * Type pour les réponses Supabase avec count
 */
export type SupabaseResponseWithCount<T> = SupabaseResponse<T> & {
  count: number | null;
};

/**
 * Helper pour typer les erreurs Supabase
 */
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Type pour les données de profil
 */
export interface ProfileData {
  id: string;
  role: "admin" | "owner" | "tenant" | "provider";
  user_id: string;
  prenom?: string | null;
  nom?: string | null;
  telephone?: string | null;
  avatar_url?: string | null;
  date_naissance?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Type pour les données de propriété (base)
 */
export interface PropertyData {
  id: string;
  owner_id: string;
  type: string;
  type_bien?: string | null;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement?: string | null;
  surface?: number | null;
  surface_habitable_m2?: number | null;
  nb_pieces?: number | null;
  nb_chambres?: number | null;
  loyer_base?: number | null;
  loyer_hc?: number | null;
  charges_mensuelles?: number | null;
  depot_garantie?: number | null;
  etat?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Type pour les documents média
 */
export interface MediaDocument {
  id: string;
  property_id: string;
  preview_url?: string | null;
  storage_path?: string | null;
  is_cover?: boolean | null;
  created_at: string;
}

