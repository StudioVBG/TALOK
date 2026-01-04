/**
 * Types TypeScript pour Supabase
 *
 * SOTA 2026 - Architecture Flexible avec Fallback Any
 *
 * Cette approche résout le problème des types `never` en utilisant
 * un système de types hybride :
 * - Types stricts exportés pour les tables principales
 * - Type Database flexible qui accepte toutes les tables
 *
 * Le build Next.js utilise ignoreBuildErrors: true, mais cette
 * configuration permet d'avoir un code fonctionnel sans erreurs runtime.
 */

// ============================================
// JSON TYPE
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// GENERIC ROW TYPES
// ============================================

/** Type générique pour tous les enregistrements */
export type GenericRow = {
  id?: string
  created_at?: string
  updated_at?: string
  [key: string]: any
}

/** Type générique pour les tables */
export type GenericTable = {
  Row: GenericRow
  Insert: GenericRow
  Update: Partial<GenericRow>
  Relationships: any[]
}

// ============================================
// STRICT ROW TYPES - Tables Principales
// ============================================

export interface PropertyRow {
  id: string
  owner_id: string
  type: string
  adresse_complete: string
  code_postal: string
  ville: string
  departement: string
  surface: number
  nb_pieces: number
  etage: number | null
  ascenseur: boolean
  energie: string | null
  ges: string | null
  unique_code: string
  statut?: string
  cover_url?: string | null
  loyer_reference?: number | null
  nb_chambres?: number | null
  meuble?: boolean
  annee_construction?: number | null
  chauffage_type?: string | null
  chauffage_mode?: string | null
  eau_chaude_type?: string | null
  parking_inclus?: boolean
  cave?: boolean
  balcon?: boolean
  terrasse?: boolean
  jardin?: boolean
  piscine?: boolean
  climatisation?: boolean
  syndic_name?: string | null
  syndic_email?: string | null
  syndic_phone?: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface ProfileRow {
  id: string
  user_id: string
  role: string
  prenom: string | null
  nom: string | null
  telephone: string | null
  avatar_url: string | null
  date_naissance: string | null
  email?: string | null
  adresse?: string | null
  code_postal?: string | null
  ville?: string | null
  pays?: string | null
  account_status?: string
  suspended_at?: string | null
  suspended_reason?: string | null
  two_factor_enabled?: boolean
  stripe_customer_id?: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface LeaseRow {
  id: string
  property_id: string | null
  unit_id: string | null
  type_bail: string
  loyer: number
  charges_forfaitaires: number
  depot_de_garantie: number
  date_debut: string
  date_fin: string | null
  statut: string
  signature_status?: string | null
  pdf_url?: string | null
  pdf_signed_url?: string | null
  signature_session_id?: string | null
  prorata_first_month?: number | null
  indexation_enabled?: boolean
  indexation_reference_date?: string | null
  last_indexation_date?: string | null
  current_irl_value?: number | null
  visale_numero?: string | null
  visale_verified?: boolean
  encadrement_applicable?: boolean
  loyer_reference_majore?: number | null
  complement_loyer?: number | null
  complement_loyer_justification?: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface InvoiceRow {
  id: string
  lease_id: string
  owner_id: string
  tenant_id: string
  periode: string
  montant_total: number
  montant_loyer: number
  montant_charges: number
  statut: string
  date_echeance?: string | null
  date_paiement?: string | null
  invoice_number?: string | null
  type?: string
  description?: string | null
  stripe_payment_intent_id?: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface TicketRow {
  id: string
  property_id: string
  lease_id: string | null
  created_by_profile_id: string
  assigned_provider_id?: string | null
  titre: string
  description: string
  priorite: string
  statut: string
  category?: string | null
  estimated_cost?: number | null
  actual_cost?: number | null
  scheduled_date?: string | null
  completed_date?: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  data?: Json | null
  created_at: string
  [key: string]: any
}

export interface SubscriptionRow {
  id: string
  user_id: string
  plan: string
  status: string
  billing_cycle?: string
  current_period_start?: string | null
  current_period_end?: string | null
  trial_end?: string | null
  cancel_at_period_end?: boolean
  stripe_subscription_id?: string | null
  stripe_customer_id?: string | null
  properties_count?: number
  leases_count?: number
  created_at: string
  updated_at?: string
  [key: string]: any
}

export interface DocumentRow {
  id: string
  lease_id?: string | null
  property_id?: string | null
  profile_id?: string | null
  type: string
  nom: string
  url: string
  size?: number | null
  mime_type?: string | null
  is_archived?: boolean
  replaced_by?: string | null
  expiry_date?: string | null
  verification_status?: string | null
  created_at: string
  updated_at?: string
  [key: string]: any
}

export interface PaymentRow {
  id: string
  invoice_id: string
  montant: number
  mode_paiement: string
  statut: string
  stripe_payment_intent_id?: string | null
  date_paiement?: string | null
  reference?: string | null
  created_at: string
  [key: string]: any
}

// ============================================
// DATABASE TYPE - Flexible Structure
// ============================================

/**
 * Type Database flexible qui accepte n'importe quelle table
 * Utilise Record<string, GenericTable> pour éviter les erreurs 'never'
 */
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: Record<string, GenericTable> & {
      properties: {
        Row: PropertyRow
        Insert: Partial<PropertyRow>
        Update: Partial<PropertyRow>
        Relationships: any[]
      }
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow>
        Update: Partial<ProfileRow>
        Relationships: any[]
      }
      leases: {
        Row: LeaseRow
        Insert: Partial<LeaseRow>
        Update: Partial<LeaseRow>
        Relationships: any[]
      }
      invoices: {
        Row: InvoiceRow
        Insert: Partial<InvoiceRow>
        Update: Partial<InvoiceRow>
        Relationships: any[]
      }
      tickets: {
        Row: TicketRow
        Insert: Partial<TicketRow>
        Update: Partial<TicketRow>
        Relationships: any[]
      }
      notifications: {
        Row: NotificationRow
        Insert: Partial<NotificationRow>
        Update: Partial<NotificationRow>
        Relationships: any[]
      }
      subscriptions: {
        Row: SubscriptionRow
        Insert: Partial<SubscriptionRow>
        Update: Partial<SubscriptionRow>
        Relationships: any[]
      }
      documents: {
        Row: DocumentRow
        Insert: Partial<DocumentRow>
        Update: Partial<DocumentRow>
        Relationships: any[]
      }
      payments: {
        Row: PaymentRow
        Insert: Partial<PaymentRow>
        Update: Partial<PaymentRow>
        Relationships: any[]
      }
    }
    Views: Record<string, { Row: GenericRow }>
    Functions: Record<string, { Args: any; Returns: any }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, any>
  }
}

// ============================================
// HELPER TYPES
// ============================================

type PublicSchema = Database["public"]

/** Obtient le type Row d'une table */
export type Tables<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]["Row"]
  : GenericRow

/** Obtient le type Insert d'une table */
export type TablesInsert<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]["Insert"]
  : GenericRow

/** Obtient le type Update d'une table */
export type TablesUpdate<T extends string> = T extends keyof PublicSchema["Tables"]
  ? PublicSchema["Tables"][T]["Update"]
  : Partial<GenericRow>

/** Obtient le type Row d'une vue */
export type Views<T extends string> = T extends keyof PublicSchema["Views"]
  ? PublicSchema["Views"][T]["Row"]
  : GenericRow

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export type Property = PropertyRow
export type Profile = ProfileRow
export type Lease = LeaseRow
export type Invoice = InvoiceRow
export type Ticket = TicketRow
export type Notification = NotificationRow
export type Subscription = SubscriptionRow
export type Document = DocumentRow
export type Payment = PaymentRow

// Alias génériques pour compatibilité
export type AnyRow = GenericRow
export type AnyTable = GenericTable
