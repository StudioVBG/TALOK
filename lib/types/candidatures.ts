/**
 * Types pour le workflow candidatures locatives
 * Tables : property_listings, applications
 */

// ============================================
// PROPERTY LISTINGS (Annonces)
// ============================================

export type BailType = 'nu' | 'meuble' | 'colocation' | 'saisonnier' | 'commercial';

export interface PropertyListing {
  id: string;
  property_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  rent_amount_cents: number;
  charges_cents: number;
  available_from: string; // ISO date
  bail_type: BailType;
  photos: ListingPhoto[];
  is_published: boolean;
  public_url_token: string;
  views_count: number;
  created_at: string;
  updated_at: string;
}

export interface ListingPhoto {
  url: string;
  caption?: string;
  order: number;
}

export interface PropertyListingWithProperty extends PropertyListing {
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    surface: number | null;
    nb_pieces: number | null;
    cover_url: string | null;
  };
}

// ============================================
// APPLICATIONS (Candidatures)
// ============================================

export type ApplicationStatus =
  | 'received'
  | 'documents_pending'
  | 'complete'
  | 'scoring'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export interface Application {
  id: string;
  listing_id: string;
  property_id: string;
  owner_id: string;
  applicant_profile_id: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  message: string | null;
  documents: ApplicationDocument[];
  completeness_score: number;
  ai_score: number | null;
  scoring_id: string | null;
  status: ApplicationStatus;
  rejection_reason: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocument {
  type: 'identity' | 'income' | 'tax_notice' | 'employment' | 'address_proof' | 'rent_receipt' | 'other';
  name: string;
  url: string;
  uploaded_at: string;
}

export interface ApplicationWithListing extends Application {
  listing: Pick<PropertyListing, 'id' | 'title' | 'rent_amount_cents' | 'charges_cents' | 'bail_type'>;
}

// ============================================
// API Input/Output types
// ============================================

export interface CreateListingInput {
  property_id: string;
  title: string;
  description?: string;
  rent_amount_cents: number;
  charges_cents?: number;
  available_from: string;
  bail_type: BailType;
  photos?: ListingPhoto[];
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  rent_amount_cents?: number;
  charges_cents?: number;
  available_from?: string;
  bail_type?: BailType;
  photos?: ListingPhoto[];
}

export interface CreateApplicationInput {
  listing_id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  message?: string;
  documents?: ApplicationDocument[];
}

export interface CompareApplicationsResult {
  applications: Application[];
  ranking: Array<{
    application_id: string;
    applicant_name: string;
    completeness_score: number;
    ai_score: number | null;
    total_score: number;
    rank: number;
  }>;
}

// ============================================
// Status labels (FR)
// ============================================

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  received: 'Reçue',
  documents_pending: 'Documents manquants',
  complete: 'Dossier complet',
  scoring: 'Analyse en cours',
  shortlisted: 'Présélectionnée',
  accepted: 'Acceptée',
  rejected: 'Refusée',
  withdrawn: 'Retirée',
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  documents_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  scoring: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  shortlisted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export const BAIL_TYPE_LABELS: Record<BailType, string> = {
  nu: 'Location nue',
  meuble: 'Location meublée',
  colocation: 'Colocation',
  saisonnier: 'Location saisonnière',
  commercial: 'Bail commercial',
};
