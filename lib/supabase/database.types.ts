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

/** Type générique pour les enregistrements - compatible postgrest-js GenericTable */
export type GenericRow = Record<string, unknown>

/** Type générique pour les tables - compatible postgrest-js GenericSchema */
export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
  Relationships: any[]
}

// ============================================
// STRICT ROW TYPES - Tables Principales
// ============================================

export type PropertyRow = {
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
  etat?: string  // draft | incomplete | ready_to_let | active | archived
  cover_url?: string | null
  loyer_reference?: number | null
  nb_chambres?: number | null
  meuble?: boolean
  annee_construction?: number | null
  chauffage_type?: string | null
  chauffage_mode?: string | null
  chauffage_energie?: string | null
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
  // P0.3: Colonnes financières et réglementaires ajoutées
  loyer_base?: number | null
  loyer_hc?: number | null
  charges_mensuelles?: number | null
  depot_garantie?: number | null
  zone_encadrement?: boolean
  dpe_classe_energie?: string | null
  dpe_classe_climat?: string | null
  dpe_consommation?: number | null
  dpe_emissions?: number | null
  dpe_estimation_conso_min?: number | null
  dpe_estimation_conso_max?: number | null
  permis_louer_requis?: boolean
  permis_louer_numero?: string | null
  permis_louer_date?: string | null
  // P0.3: Colonnes commerciales
  usage_principal?: string | null
  sous_usage?: string | null
  erp_type?: string | null
  plan_url?: string | null
  places_parking?: number | null
  // Caractéristiques détaillées
  has_balcon?: boolean
  has_terrasse?: boolean
  has_jardin?: boolean
  has_cave?: boolean
  clim_presence?: boolean
  clim_type?: string | null
  visite_virtuelle_url?: string | null
  photo_url?: string | null
  equipments?: Json | null
  nb_etages_immeuble?: number | null
  surface_habitable_m2?: number | null
  regime?: string | null
  investment_price?: number | null
  // Parking détaillé
  parking_type?: string | null
  parking_numero?: string | null
  parking_niveau?: string | null
  parking_gabarit?: string | null
  parking_portail_securise?: boolean
  parking_video_surveillance?: boolean
  parking_gardien?: boolean
  // Local professionnel
  local_type?: string | null
  local_surface_totale?: number | null
  local_has_vitrine?: boolean
  local_access_pmr?: boolean
  local_clim?: boolean
  local_fibre?: boolean
  local_alarme?: boolean
  // Soft delete
  deleted_at?: string | null
  // Missing columns discovered by type-level query parser
  rental_status?: string | null
  nom?: string | null
  dpe_date?: string | null
  type_bien?: string | null
  adresse_ligne1?: string | null
  loyer_actuel?: number | null
  legal_entity_id?: string | null
  latitude?: number | null
  longitude?: number | null
  adresse?: string | null
  building_id?: string | null
  created_at: string
  updated_at: string

}

export type ProfileRow = {
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
  // P0.3: Colonnes manquantes ajoutées
  lieu_naissance?: string | null
  nationalite?: string | null
  account_status?: string
  suspended_at?: string | null
  suspended_reason?: string | null
  two_factor_enabled?: boolean
  stripe_customer_id?: string | null
  // Missing columns discovered by type-level query parser
  first_login_at?: string | null
  two_factor_required?: boolean
  welcome_seen_at?: string | null
  organization_id?: string | null
  tour_completed_at?: string | null
  full_name?: string | null
  login_count?: number
  onboarding_completed_at?: string | null
  onboarding_skipped_at?: string | null
  created_at: string
  updated_at: string

}

export type LeaseRow = {
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
  // P0.3: Colonnes de charges et colocation ajoutées
  charges_type?: 'forfaitaires' | 'provisions' | null
  coloc_config?: Json | null  // Configuration colocation (nb_places, split_mode, etc.)
  // P0.3: Colonnes d'invitation ajoutées
  invite_token?: string | null
  invite_token_expires_at?: string | null
  tenant_email_pending?: string | null
  tenant_name_pending?: string | null
  tenant_identity_verified?: boolean
  tenant_identity_method?: string | null
  tenant_identity_data?: Json | null
  // P0.3: Colonnes Yousign ajoutées
  yousign_signature_request_id?: string | null
  yousign_document_id?: string | null
  signature_started_at?: string | null
  signature_completed_at?: string | null
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
  // Missing columns discovered by type-level query parser
  tenant_id?: string | null
  dernier_irl_reference?: number | null
  indice_reference?: string | null
  signed_pdf_path?: string | null
  derniere_revision?: string | null
  owner_id?: string | null
  next_indexation_date?: string | null
  sealed_at?: string | null
  depot_garantie?: number | null
  created_at: string
  updated_at: string

}

export type InvoiceRow = {
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
  // Missing columns discovered by type-level query parser
  reference?: string | null
  paid_at?: string | null
  amount?: number | null
  due_date?: string | null
  created_at: string
  updated_at: string

}

export type TicketRow = {
  id: string
  property_id: string
  lease_id: string | null
  created_by_profile_id: string
  assigned_provider_id?: string | null
  owner_id?: string | null
  titre: string
  description: string
  priorite: string
  statut: string
  category?: string | null
  estimated_cost?: number | null
  actual_cost?: number | null
  scheduled_date?: string | null
  completed_date?: string | null
  ai_summary?: string | null
  created_at: string
  updated_at: string

}

export type NotificationRow = {
  id: string
  user_id: string
  profile_id?: string | null
  type: string
  title: string
  body: string
  message?: string | null
  is_read: boolean
  read?: boolean
  read_at?: string | null
  data?: Json | null
  metadata?: Json | null
  priority?: string | null
  channels?: string[] | null
  action_url?: string | null
  action_label?: string | null
  image_url?: string | null
  expires_at?: string | null
  created_at: string

}

export type SubscriptionRow = {
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
  documents_size_mb?: number | null
  // Missing columns discovered by type-level query parser
  owner_id?: string
  plan_slug?: string | null
  canceled_at?: string | null
  plan_id?: string | null
  grandfathered_until?: string | null
  created_at: string
  updated_at?: string

}

export type DocumentRow = {
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
  // Missing columns discovered by type-level query parser
  storage_path?: string | null
  nom_fichier?: string | null
  owner_id?: string | null
  preview_url?: string | null
  metadata?: Json | null
  tenant_id?: string | null
  renewal_requested_at?: string | null
  created_at: string
  updated_at?: string

}

export type PaymentRow = {
  id: string
  invoice_id: string
  montant: number
  mode_paiement: string
  statut: string
  stripe_payment_intent_id?: string | null
  date_paiement?: string | null
  reference?: string | null
  // Missing columns discovered by type-level query parser
  moyen?: string | null
  provider_ref?: string | null
  created_at: string

}

// ============================================
// EDL (ÉTATS DES LIEUX) TYPES
// ============================================

export type EDLRow = {
  id: string
  lease_id: string
  type: 'entree' | 'sortie'
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'signed' | 'disputed' | 'closed'
  scheduled_date: string | null
  completed_date: string | null
  created_by: string
  // Missing columns discovered by type-level query parser
  scheduled_at?: string | null
  created_at: string
  updated_at: string

}

export type EDLItemRow = {
  id: string
  edl_id: string
  room_name: string
  item_name: string
  condition: 'neuf' | 'bon' | 'moyen' | 'mauvais' | 'tres_mauvais' | null
  notes: string | null
  created_at: string

}

export type EDLMediaRow = {
  id: string
  edl_id: string
  item_id: string | null
  storage_path: string
  media_type: 'photo' | 'video'
  thumbnail_path: string | null
  taken_at: string
  created_at: string

}

export type EDLSignatureRow = {
  id: string
  edl_id: string
  signer_user: string
  signer_role: 'owner' | 'tenant' | 'witness'
  signed_at: string
  signature_image_path: string | null
  ip_inet: string | null
  user_agent: string | null

}

// ============================================
// SIGNATURE TYPES
// ============================================

export type SignatureRow = {
  id: string
  draft_id: string | null
  lease_id: string | null
  signer_user: string
  signer_profile_id: string
  level: 'SES' | 'AES' | 'QES'
  otp_verified: boolean
  otp_code: string | null
  otp_expires_at: string | null
  ip_inet: string | null
  user_agent: string | null
  signed_at: string | null
  signature_image_path: string | null
  evidence_pdf_url: string | null
  doc_hash: string
  provider_ref: string | null
  provider_data: Json | null
  created_at: string
  updated_at: string

}

export type LeaseSignerRow = {
  id: string
  lease_id: string
  profile_id: string | null
  role: 'proprietaire' | 'locataire_principal' | 'colocataire' | 'garant'
  signature_status: 'pending' | 'signed' | 'refused'
  signed_at: string | null
  invited_email: string | null
  invited_name: string | null
  invited_at: string | null
  signature_image: string | null
  signature_image_path?: string | null
  ip_inet?: string | null
  user_agent?: string | null
  proof_id?: string | null
  document_hash?: string | null
  proof_metadata?: Json | null
  share_percentage?: number | null
  created_at: string
  updated_at: string

}

// ============================================
// COLOCATION TYPES
// ============================================

export type UnitRow = {
  id: string
  property_id: string
  nom: string
  code_unique?: string | null
  capacite_max: number
  surface: number | null
  created_at: string
  updated_at: string

}

export type RoommateRow = {
  id: string
  lease_id: string
  user_id: string
  profile_id: string
  role: 'principal' | 'tenant' | 'occupant' | 'guarantor'
  first_name: string
  last_name: string
  weight: number
  joined_on: string
  left_on: string | null
  invitation_status?: 'pending' | 'accepted' | 'rejected' | 'expired'
  invited_email?: string | null
  created_at: string
  updated_at: string

}

export type PaymentShareRow = {
  id: string
  lease_id: string
  invoice_id: string | null
  month: string
  roommate_id: string
  expected_amount: number
  paid_amount: number
  status: 'pending' | 'partial' | 'paid' | 'late'
  paid_at: string | null
  autopay?: boolean
  created_at: string

}

export type DepositShareRow = {
  id: string
  lease_id: string
  roommate_id: string
  amount: number
  status: 'pending' | 'paid' | 'returned' | 'partial_deduction'
  paid_at: string | null
  returned_at: string | null
  deduction_amount: number | null
  deduction_reason: string | null
  created_at: string
  updated_at: string

}

// ============================================
// METER (COMPTEUR) TYPES
// ============================================

export type MeterRow = {
  id: string
  lease_id: string
  property_id: string | null
  type: 'electricity' | 'gas' | 'water'
  provider: string | null
  provider_meter_id: string | null
  is_connected: boolean
  meter_number: string | null
  unit: 'kwh' | 'm3' | 'l'
  created_at: string
  updated_at: string

}

/**
 * meter_readings table - General meter readings for billing
 * @version 2026-01-22 - Fixed: photo_url (not photo_path)
 */
export type MeterReadingRow = {
  id: string
  meter_id: string
  reading_value: number
  unit: string
  reading_date: string
  source: 'manual' | 'api' | 'ocr'
  photo_url: string | null  // Fixed: was photo_path, but actual column is photo_url
  confidence: number | null
  ocr_provider: string | null
  created_by: string | null
  created_at: string

}

/**
 * edl_meter_readings table - EDL-specific meter readings
 * @version 2026-01-22 - Added for SOTA type safety
 */
export type EDLMeterReadingRow = {
  id: string
  edl_id: string
  meter_id: string | null
  reading_value: number | null
  reading_unit: string
  photo_path: string | null
  photo_taken_at: string | null
  ocr_value: number | null
  ocr_confidence: number | null
  ocr_provider: string | null
  ocr_raw_text: string | null
  is_validated: boolean
  validated_by: string | null
  validated_at: string | null
  validation_comment: string | null
  recorded_by: string | null
  recorded_by_role: 'owner' | 'tenant'
  created_at: string
  updated_at: string

}

// ============================================
// CHARGES & ACCOUNTING TYPES
// ============================================

export type ChargeRow = {
  id: string
  property_id: string
  type: 'eau' | 'electricite' | 'gaz' | 'copro' | 'taxe' | 'ordures' | 'assurance' | 'travaux' | 'autre'
  description: string | null
  montant: number
  periodicite: 'mensuelle' | 'trimestrielle' | 'annuelle' | 'ponctuelle'
  refacturable_locataire: boolean
  date_debut: string | null
  date_fin: string | null
  created_at: string
  updated_at: string

}

export type DepositMovementRow = {
  id: string
  lease_id: string
  roommate_id: string | null
  type: 'encaissement' | 'remboursement' | 'deduction'
  amount: number
  reason: string | null
  status: 'pending' | 'received' | 'returned'
  processed_at: string | null
  processed_by: string | null
  created_at: string

}

// ============================================
// WORK ORDER & PROVIDER TYPES
// ============================================

export type WorkOrderRow = {
  id: string
  ticket_id: string
  provider_id: string
  quote_id: string | null
  statut: string
  scheduled_date: string | null
  completed_date: string | null
  actual_cost: number | null
  notes: string | null
  // Missing columns discovered by type-level query parser
  cout_final?: number | null
  date_intervention_prevue?: string | null
  date_intervention_reelle?: string | null
  date_intervention?: string | null
  cout_estime?: number | null
  scheduled_start_at?: string | null
  actual_start_at?: string | null
  actual_end_at?: string | null
  provider_notes?: string | null
  owner_notes?: string | null
  property_id?: string | null
  created_at: string
  updated_at: string

}

export type QuoteRow = {
  id: string
  ticket_id: string | null
  provider_id: string
  property_id?: string | null
  owner_id?: string | null
  description: string | null
  reference?: string | null
  amount: number
  validity_days?: number
  status: 'draft' | 'pending' | 'sent' | 'accepted' | 'rejected' | 'expired'
  items?: string | null
  subtotal?: number | null
  tax_rate?: number | null
  tax_amount?: number | null
  total?: number | null
  valid_until?: string | null
  notes?: string | null
  submitted_at?: string | null
  sent_at?: string | null
  responded_at: string | null
  created_at: string
  updated_at?: string

}

export type ProviderProfileRow = {
  id: string
  profile_id: string
  company_name: string | null
  siret: string | null
  specialties: string[]
  service_area_km: number | null
  hourly_rate: number | null
  response_time_hours: number | null
  rating_avg: number | null
  rating_count: number | null
  is_verified: boolean
  // Missing columns discovered by type-level query parser
  type_services?: string[]
  certifications?: string[]
  zones_intervention?: string | null
  adresse_siege?: string | null
  status?: string | null
  kyc_status?: string | null
  bio?: string | null
  website?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  insurance_number?: string | null
  insurance_expiry?: string | null
  decennial_number?: string | null
  decennial_expiry?: string | null
  tarif_min?: number | null
  tarif_max?: number | null
  disponibilite?: string | null
  disponibilite_urgence?: boolean | null
  created_at: string
  updated_at: string

}

// ============================================
// IDENTITY 2FA - SOTA 2026
// ============================================

export type Identity2FaRequestRow = {
  id: string
  profile_id: string
  action: "renew" | "initial" | "update"
  lease_id: string | null
  otp_hash: string
  token: string
  verified_at: string | null
  expires_at: string
  ip_address: string | null
  created_at: string
}

export type Identity2FaRequestInsert = {
  id?: string
  profile_id: string
  action: "renew" | "initial" | "update"
  lease_id?: string | null
  otp_hash: string
  token: string
  verified_at?: string | null
  expires_at: string
  ip_address?: string | null
  created_at?: string
}

export type Identity2FaRequestUpdate = {
  profile_id?: string
  action?: "renew" | "initial" | "update"
  lease_id?: string | null
  otp_hash?: string
  token?: string
  verified_at?: string | null
  expires_at?: string
  ip_address?: string | null
}

// ============================================
// UNIFIED SIGNATURE SYSTEM TYPES - P1 SOTA 2026
// ============================================

export type SignatureDocumentType =
  | 'bail'
  | 'avenant'
  | 'edl_entree'
  | 'edl_sortie'
  | 'quittance'
  | 'caution'
  | 'devis'
  | 'facture'
  | 'note_service'
  | 'reglement_interieur'
  | 'autre'

export type SignatureEntityType = 'lease' | 'edl' | 'quote' | 'invoice' | 'internal'

export type SignatureSessionStatus =
  | 'draft'
  | 'pending'
  | 'ongoing'
  | 'done'
  | 'rejected'
  | 'expired'
  | 'canceled'

export type SignatureParticipantStatus =
  | 'pending'
  | 'notified'
  | 'opened'
  | 'signed'
  | 'refused'
  | 'error'

export type SignatureRoleType =
  | 'proprietaire'
  | 'locataire_principal'
  | 'colocataire'
  | 'garant'
  | 'representant_legal'
  | 'temoin'
  | 'autre'

export type SignatureLevelType = 'SES' | 'AES' | 'QES'

export type SignatureAuditAction =
  | 'session_created'
  | 'session_sent'
  | 'session_completed'
  | 'session_rejected'
  | 'session_expired'
  | 'session_canceled'
  | 'participant_added'
  | 'participant_notified'
  | 'participant_opened'
  | 'participant_signed'
  | 'participant_refused'
  | 'proof_generated'
  | 'proof_verified'

export type SignatureSessionRow = {
  id: string
  document_type: SignatureDocumentType
  entity_type: SignatureEntityType
  entity_id: string
  source_document_id: string | null
  signed_document_id: string | null
  proof_document_id: string | null
  name: string
  description: string | null
  status: SignatureSessionStatus
  signature_level: SignatureLevelType
  is_ordered_signatures: boolean
  otp_required: boolean
  created_by: string
  owner_id: string
  deadline: string | null
  sent_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string

}

export type SignatureParticipantRow = {
  id: string
  session_id: string
  profile_id: string | null
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: SignatureRoleType
  signing_order: number | null
  status: SignatureParticipantStatus
  signature_image_path: string | null
  signature_timestamp: string | null
  signature_ip: string | null
  signature_user_agent: string | null
  otp_code: string | null
  otp_expires_at: string | null
  otp_verified: boolean
  refused_reason: string | null
  refused_at: string | null
  invitation_token: string | null
  invitation_token_expires_at: string | null
  invitation_sent_at: string | null
  notified_at: string | null
  opened_at: string | null
  created_at: string
  updated_at: string

}

export type SignatureProofRow = {
  id: string
  participant_id: string
  session_id: string
  proof_id: string
  document_hash: string
  signature_hash: string
  proof_hash: string
  metadata: Json
  verified_at: string | null
  verification_errors: string[] | null
  created_at: string

}

export type SignatureAuditLogRow = {
  id: string
  session_id: string
  participant_id: string | null
  action: SignatureAuditAction
  actor_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Json | null
  created_at: string

}

// ============================================
// VISIT SCHEDULING TYPES - SOTA 2026
// ============================================

export type OwnerAvailabilityPatternRow = {
  id: string
  owner_id: string
  property_id: string | null
  recurrence_type: 'daily' | 'weekly' | 'monthly' | 'custom'
  day_of_week: number[] | null
  start_time: string
  end_time: string
  slot_duration_minutes: number
  buffer_minutes: number
  valid_from: string
  valid_until: string | null
  max_bookings_per_slot: number
  auto_confirm: boolean
  is_active: boolean
  created_at: string
  updated_at: string

}

export type AvailabilityExceptionRow = {
  id: string
  pattern_id: string | null
  owner_id: string
  property_id: string | null
  exception_date: string
  exception_type: 'unavailable' | 'modified'
  modified_start_time: string | null
  modified_end_time: string | null
  reason: string | null
  created_at: string

}

export type VisitSlotRow = {
  id: string
  property_id: string
  owner_id: string
  pattern_id: string | null
  slot_date: string
  start_time: string
  end_time: string
  status: 'available' | 'booked' | 'blocked' | 'cancelled' | 'completed'
  max_visitors: number
  current_visitors: number
  created_at: string
  updated_at: string

}

export type VisitBookingRow = {
  id: string
  slot_id: string
  property_id: string
  tenant_id: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  tenant_message: string | null
  owner_notes: string | null
  contact_phone: string | null
  contact_email: string | null
  party_size: number
  reminder_sent_at: string | null
  reminder_24h_sent: boolean
  reminder_1h_sent: boolean
  external_calendar_event_id: string | null
  external_calendar_provider: 'google' | 'outlook' | 'apple' | 'caldav' | null
  feedback_rating: number | null
  feedback_comment: string | null
  booked_at: string
  confirmed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string

}

export type CalendarConnectionRow = {
  id: string
  user_id: string
  provider: 'google' | 'outlook' | 'apple' | 'caldav'
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  calendar_id: string
  calendar_name: string | null
  calendar_color: string | null
  sync_enabled: boolean
  sync_direction: 'to_external' | 'from_external' | 'both'
  last_sync_at: string | null
  last_sync_error: string | null
  created_at: string
  updated_at: string

}

// ============================================
// LEGAL ENTITIES TYPES - SOTA 2026
// ============================================

export type LegalEntityRow = {
  id: string
  owner_profile_id: string
  entity_type: 'particulier' | 'sci_ir' | 'sci_is' | 'sci_construction_vente' | 'sarl' | 'sarl_famille' | 'eurl' | 'sas' | 'sasu' | 'sa' | 'snc' | 'indivision' | 'demembrement_usufruit' | 'demembrement_nue_propriete' | 'holding'
  nom: string
  nom_commercial: string | null
  siren: string | null
  siret: string | null
  rcs_ville: string | null
  rcs_numero: string | null
  numero_tva: string | null
  code_ape: string | null
  adresse_siege: string | null
  complement_adresse: string | null
  code_postal_siege: string | null
  ville_siege: string | null
  pays_siege: string | null
  forme_juridique: string | null
  capital_social: number | null
  capital_variable: boolean
  capital_min: number | null
  capital_max: number | null
  nombre_parts: number | null
  valeur_nominale_part: number | null
  regime_fiscal: 'ir' | 'is' | 'ir_option_is' | 'is_option_ir'
  date_option_fiscale: string | null
  tva_assujetti: boolean
  tva_regime: 'franchise' | 'reel_simplifie' | 'reel_normal' | 'mini_reel' | null
  tva_taux_defaut: number | null
  date_creation: string | null
  date_cloture_exercice: string | null
  duree_exercice_mois: number | null
  premier_exercice_debut: string | null
  premier_exercice_fin: string | null
  iban: string | null
  bic: string | null
  banque_nom: string | null
  titulaire_compte: string | null
  type_gerance: 'gerant_unique' | 'co_gerance' | 'gerance_collegiale' | 'president' | 'directeur_general' | 'conseil_administration' | null
  is_active: boolean
  date_radiation: string | null
  motif_radiation: string | null
  couleur: string | null
  icone: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string

}

export type EntityAssociateRow = {
  id: string
  legal_entity_id: string
  profile_id: string | null
  parent_entity_id: string | null
  civilite: 'M' | 'Mme' | 'Société' | null
  nom: string | null
  prenom: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  denomination_sociale: string | null
  forme_juridique_associe: string | null
  siren_associe: string | null
  representant_legal: string | null
  nombre_parts: number
  pourcentage_capital: number | null
  pourcentage_droits_vote: number | null
  valeur_parts: number | null
  apport_initial: number | null
  type_apport: 'numeraire' | 'nature_immobilier' | 'nature_mobilier' | 'industrie' | null
  date_apport: string | null
  type_detention: 'pleine_propriete' | 'nue_propriete' | 'usufruit' | 'indivision'
  is_gerant: boolean
  is_president: boolean
  is_directeur_general: boolean
  is_associe_fondateur: boolean
  role_autre: string | null
  date_debut_mandat: string | null
  date_fin_mandat: string | null
  duree_mandat_annees: number | null
  pouvoirs: string | null
  limitations_pouvoirs: string | null
  signature_autorisee: boolean
  plafond_engagement: number | null
  is_current: boolean
  date_entree: string | null
  date_sortie: string | null
  motif_sortie: string | null
  piece_identite_document_id: string | null
  justificatif_domicile_document_id: string | null
  created_at: string
  updated_at: string

}

export type PropertyOwnershipRow = {
  id: string
  property_id: string
  legal_entity_id: string | null
  profile_id: string | null
  quote_part_numerateur: number
  quote_part_denominateur: number
  pourcentage_detention: number | null
  detention_type: 'pleine_propriete' | 'nue_propriete' | 'usufruit' | 'usufruit_temporaire' | 'indivision'
  usufruit_duree_annees: number | null
  usufruit_date_fin: string | null
  date_acquisition: string | null
  mode_acquisition: 'achat' | 'apport' | 'donation' | 'succession' | 'echange' | 'construction' | 'licitation' | null
  prix_acquisition: number | null
  frais_acquisition: number | null
  notaire_nom: string | null
  notaire_ville: string | null
  reference_acte: string | null
  date_acte: string | null
  finance_par_emprunt: boolean
  montant_emprunt: number | null
  banque_emprunt: string | null
  date_cession: string | null
  mode_cession: 'vente' | 'donation' | 'apport_societe' | 'succession' | 'echange' | 'expropriation' | null
  prix_cession: number | null
  is_current: boolean
  created_at: string
  updated_at: string

}

// ============================================
// BUILDING & BUILDING UNIT TYPES - SOTA 2026
// ============================================

/**
 * Building types for "Immeuble Entier" feature
 * @version 2026-01-27 - SOTA Property Wizard V3
 */
export type BuildingUnitType =
  | 'appartement'
  | 'studio'
  | 'local_commercial'
  | 'parking'
  | 'cave'
  | 'bureau'

export type BuildingUnitStatus =
  | 'vacant'
  | 'occupe'
  | 'travaux'
  | 'reserve'

export type BuildingUnitTemplate =
  | 'T1'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'studio'
  | 'parking'
  | 'cave'
  | 'bureau'

export type BuildingRow = {
  id: string
  property_id: string
  nom: string | null
  floors: number
  construction_year: number | null
  has_ascenseur: boolean
  has_gardien: boolean
  has_interphone: boolean
  has_digicode: boolean
  has_local_velo: boolean
  has_local_poubelles: boolean
  has_local_ordures: boolean
  has_parking_commun: boolean
  address_complement: string | null
  notes: string | null
  // Missing columns discovered by type-level query parser
  owner_id?: string
  name?: string | null
  is_active?: boolean
  syndic?: Json | null
  created_at: string
  updated_at: string

}

export type BuildingUnitRow = {
  id: string
  building_id: string
  property_id: string | null
  floor: number
  position: string
  type: BuildingUnitType
  template: BuildingUnitTemplate | null
  surface: number
  nb_pieces: number
  loyer_hc: number
  charges: number
  depot_garantie: number
  status: BuildingUnitStatus
  current_lease_id: string | null
  notes: string | null
  created_at: string
  updated_at: string

}

// ============================================
// MISSING TABLE TYPES - Discovered via type-level query parser
// ============================================

export type SubscriptionPlanRow = {
  id: string
  name: string
  slug: string
  description: string | null
  price_monthly: number
  price_yearly: number
  max_properties: number
  max_leases: number
  max_tenants: number
  max_users?: number
  max_documents_gb: number
  features: Json
  signatures_monthly_quota?: number
  stripe_product_id: string | null
  stripe_price_monthly_id: string | null
  stripe_price_yearly_id: string | null
  is_active: boolean
  is_popular: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type PhotoRow = {
  id: string
  property_id: string
  room_id: string | null
  url: string | null
  storage_path: string | null
  is_main: boolean
  tag: string | null
  ordre: number
  created_at: string
  updated_at: string
}

export type ConversationParticipantRow = {
  id: string
  conversation_id: string
  profile_id: string
  participant_role: string | null
  can_write: boolean
  is_admin: boolean
  unread_count: number
  last_read_at: string | null
  joined_at: string
  left_at?: string | null
  muted_until?: string | null
  created_at: string
  updated_at: string
}

export type CoproServiceRow = {
  id: string
  site_id: string
  label: string
  code: string | null
  service_type: string
  scope_type: string | null
  default_allocation_mode: string | null
  is_recurring: boolean
  budget_annual: number
  budget_monthly: number
  is_recuperable_locatif: boolean
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type EdlInspectionItemRow = {
  id: string
  lease_end_process_id: string
  category: string
  item_name: string | null
  status: string
  condition_entree: string | null
  condition_sortie: string | null
  damage_type: string | null
  damage_description: string | null
  photo_urls: string[] | null
  photos?: string[] | null
  estimated_cost: number
  vetusty_rate: number
  tenant_responsibility: number
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrganizationBrandingRow = {
  id: string
  organization_id: string
  company_name: string | null
  tagline: string | null
  logo_url: string | null
  logo_dark_url: string | null
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  favicon_url: string | null
  remove_powered_by: boolean
  custom_css: string | null
  sso_enabled: boolean
  created_at: string
  updated_at: string
}

export type RenovationItemRow = {
  id: string
  lease_end_process_id: string
  work_type: string
  description: string | null
  room: string | null
  priority: number
  estimated_cost: number
  vetusty_deduction: number
  tenant_share: number
  owner_share: number
  payer: string | null
  status: string
  scheduled_date: string | null
  completed_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type RenovationQuoteRow = {
  id: string
  renovation_item_id: string
  lease_end_process_id: string
  provider_id: string | null
  provider_name: string
  provider_email: string
  provider_phone: string | null
  amount: number
  tax_amount: number
  total_amount: number
  status: string
  description: string | null
  created_at: string
  updated_at: string
}

// ============================================
// ADDITIONAL MISSING TABLE TYPES - Source tables from relationship errors
// ============================================

export type ConversationRow = {
  id: string
  property_id: string | null
  lease_id: string | null
  owner_id: string
  tenant_id?: string | null
  type: string | null
  subject: string | null
  status: string
  owner_unread_count?: number
  tenant_unread_count?: number
  owner_profile_id?: string | null
  tenant_profile_id?: string | null
  last_message_at?: string | null
  created_at: string
  updated_at: string
}

export type LeaseEndProcessRow = {
  id: string
  lease_id: string
  status: string
  initiated_by: string | null
  end_date: string | null
  edl_sortie_id?: string | null
  renovation_cost?: number | null
  deposit_retained?: number | null
  deposit_refund?: number | null
  created_at: string
  updated_at: string
}

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  sender_profile_id?: string | null
  sender_role?: string | null
  content: string
  content_type?: string | null
  type: string
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  attachment_size?: number | null
  created_at: string
  updated_at: string
}

export type OrganizationRow = {
  id: string
  name: string
  slug: string | null
  owner_id: string
  plan: string | null
  white_label_level?: string | null
  created_at: string
  updated_at: string
}

export type OwnerProfileRow = {
  id: string
  profile_id: string
  company_name: string | null
  siret: string | null
  business_type: string | null
  type?: string | null
  adresse_facturation?: string | null
  adresse_siege?: string | null
  raison_sociale?: string | null
  forme_juridique?: string | null
  complement_adresse?: string | null
  created_at: string
  updated_at: string
}

export type ProviderInvoiceRow = {
  id: string
  provider_id: string
  provider_profile_id?: string | null
  owner_profile_id?: string | null
  property_id: string | null
  work_order_id: string | null
  amount: number
  total_amount?: number
  status: string
  invoice_number: string | null
  sent_at?: string | null
  sent_to_email?: string | null
  reminder_count?: number
  last_reminder_at?: string | null
  created_at: string
  updated_at: string
}

export type ProviderQuoteRow = {
  id: string
  ticket_id: string | null
  provider_id: string
  provider_profile_id?: string | null
  property_id: string | null
  owner_id?: string | null
  owner_profile_id?: string | null
  description: string | null
  title?: string | null
  reference?: string | null
  amount: number
  total_amount?: number | null
  validity_days?: number
  status: string
  items?: string | null
  subtotal?: number | null
  tax_rate?: number | null
  tax_amount?: number | null
  total?: number | null
  valid_until?: string | null
  notes?: string | null
  submitted_at?: string | null
  sent_at?: string | null
  sent_to_email?: string | null
  responded_at?: string | null
  reminder_count?: number
  last_reminder_at?: string | null
  created_at: string
  updated_at: string
}

export type TenantChargesBaseRow = {
  id: string
  lease_id: string
  copro_service_id: string | null
  label: string | null
  amount: number
  created_at: string
  updated_at: string
}

export type UnifiedConversationRow = {
  id: string
  owner_id: string
  type: string | null
  subject: string | null
  property_id: string | null
  lease_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export type UnifiedMessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  type: string
  created_at: string
  updated_at: string
}

// ============================================
// TENANT PAYMENT METHODS TYPES - SOTA 2026
// ============================================

export type TenantPaymentMethodRow = {
  id: string
  tenant_profile_id: string
  stripe_customer_id: string
  stripe_payment_method_id: string
  type: 'card' | 'sepa_debit' | 'apple_pay' | 'google_pay' | 'link'
  is_default: boolean
  label: string | null
  card_brand: string | null
  card_last4: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  card_fingerprint: string | null
  sepa_last4: string | null
  sepa_bank_code: string | null
  sepa_country: string | null
  sepa_fingerprint: string | null
  sepa_mandate_id: string | null
  status: 'active' | 'expired' | 'revoked' | 'failed'
  last_used_at: string | null
  failure_count: number
  metadata: Json
  created_at: string
  updated_at: string
}

export type PaymentMethodAuditLogRow = {
  id: string
  tenant_profile_id: string
  payment_method_id: string | null
  action: 'created' | 'set_default' | 'revoked' | 'expired' | 'payment_success' | 'payment_failed' | 'prenotification_sent' | 'mandate_created' | 'mandate_cancelled' | 'data_accessed'
  details: Json
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

/** SOTA 2026: Audit PSD3 pour les moyens de paiement propriétaire (abonnement) */
export type OwnerPaymentAuditLogRow = {
  id: string
  owner_id: string
  action: string
  payment_method_type: string | null
  metadata: Json
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type SepaMandateRow = {
  id: string
  mandate_reference: string
  tenant_profile_id: string
  owner_profile_id: string
  lease_id: string
  debtor_name: string
  debtor_iban: string
  creditor_name: string
  creditor_iban: string
  creditor_bic: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  stripe_mandate_id: string | null
  amount: number
  signature_date: string
  signed_at: string | null
  signature_method: 'electronic' | 'paper' | 'api'
  first_collection_date: string | null
  status: 'pending' | 'active' | 'suspended' | 'cancelled' | 'expired' | 'failed'
  last_prenotification_sent_at: string | null
  next_collection_date: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

// ============================================
// Generic Row type for tables not yet fully typed
type GenericRowType = Record<string, unknown> & { id?: string; created_at?: string; updated_at?: string }

// DATABASE TYPE - Flexible Structure
// ============================================

/**
 * Type Database compatible avec GenericSchema de postgrest-js.
 * Les Row types sont des "type aliases" (pas "interface") pour garantir
 * la compatibilité avec Record<string, unknown> via index signatures implicites.
 * Les Functions utilisent Args: Record<string, unknown> (pas 'any') pour éviter
 * que GetComputedFields traite tous les champs comme des fonctions calculées.
 */
export type Database = {
  public: {
    Tables: {
      properties: {
        Row: PropertyRow
        Insert: Partial<PropertyRow>
        Update: Partial<PropertyRow>
        Relationships: [
          { foreignKeyName: "properties_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "properties_building_id_fkey"; columns: ["building_id"]; isOneToOne: false; referencedRelation: "buildings"; referencedColumns: ["id"] }
        ]
      }
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow>
        Update: Partial<ProfileRow>
        Relationships: [
          { foreignKeyName: "profiles_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      leases: {
        Row: LeaseRow
        Insert: Partial<LeaseRow>
        Update: Partial<LeaseRow>
        Relationships: [
          { foreignKeyName: "leases_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "leases_unit_id_fkey"; columns: ["unit_id"]; isOneToOne: false; referencedRelation: "units"; referencedColumns: ["id"] }
        ]
      }
      invoices: {
        Row: InvoiceRow
        Insert: Partial<InvoiceRow>
        Update: Partial<InvoiceRow>
        Relationships: [
          { foreignKeyName: "invoices_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] },
          { foreignKeyName: "invoices_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "invoices_tenant_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      tickets: {
        Row: TicketRow
        Insert: Partial<TicketRow>
        Update: Partial<TicketRow>
        Relationships: [
          { foreignKeyName: "tickets_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "tickets_created_by_fkey"; columns: ["created_by_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      notifications: {
        Row: NotificationRow
        Insert: Partial<NotificationRow>
        Update: Partial<NotificationRow>
        Relationships: []
      }
      subscriptions: {
        Row: SubscriptionRow
        Insert: Partial<SubscriptionRow>
        Update: Partial<SubscriptionRow>
        Relationships: [
          { foreignKeyName: "subscriptions_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "subscription_plans"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      documents: {
        Row: DocumentRow
        Insert: Partial<DocumentRow>
        Update: Partial<DocumentRow>
        Relationships: [
          { foreignKeyName: "documents_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "documents_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      payments: {
        Row: PaymentRow
        Insert: Partial<PaymentRow>
        Update: Partial<PaymentRow>
        Relationships: [
          { foreignKeyName: "payments_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "invoices"; referencedColumns: ["id"] }
        ]
      }
      // EDL Tables
      edl: {
        Row: EDLRow
        Insert: Partial<EDLRow>
        Update: Partial<EDLRow>
        Relationships: [
          { foreignKeyName: "edl_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] }
        ]
      }
      edl_items: {
        Row: EDLItemRow
        Insert: Partial<EDLItemRow>
        Update: Partial<EDLItemRow>
        Relationships: []
      }
      edl_media: {
        Row: EDLMediaRow
        Insert: Partial<EDLMediaRow>
        Update: Partial<EDLMediaRow>
        Relationships: [
          { foreignKeyName: "edl_media_edl_id_fkey"; columns: ["edl_id"]; isOneToOne: false; referencedRelation: "edl"; referencedColumns: ["id"] }
        ]
      }
      edl_signatures: {
        Row: EDLSignatureRow
        Insert: Partial<EDLSignatureRow>
        Update: Partial<EDLSignatureRow>
        Relationships: [
          { foreignKeyName: "edl_signatures_edl_id_fkey"; columns: ["edl_id"]; isOneToOne: false; referencedRelation: "edl"; referencedColumns: ["id"] },
          { foreignKeyName: "edl_signatures_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      // Signature Tables
      signatures: {
        Row: SignatureRow
        Insert: Partial<SignatureRow>
        Update: Partial<SignatureRow>
        Relationships: []
      }
      lease_signers: {
        Row: LeaseSignerRow
        Insert: Partial<LeaseSignerRow>
        Update: Partial<LeaseSignerRow>
        Relationships: [
          { foreignKeyName: "lease_signers_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] },
          { foreignKeyName: "lease_signers_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      // Colocation Tables
      units: {
        Row: UnitRow
        Insert: Partial<UnitRow>
        Update: Partial<UnitRow>
        Relationships: []
      }
      roommates: {
        Row: RoommateRow
        Insert: Partial<RoommateRow>
        Update: Partial<RoommateRow>
        Relationships: [
          { foreignKeyName: "roommates_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] },
          { foreignKeyName: "roommates_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      payment_shares: {
        Row: PaymentShareRow
        Insert: Partial<PaymentShareRow>
        Update: Partial<PaymentShareRow>
        Relationships: []
      }
      deposit_shares: {
        Row: DepositShareRow
        Insert: Partial<DepositShareRow>
        Update: Partial<DepositShareRow>
        Relationships: []
      }
      // Meter Tables
      meters: {
        Row: MeterRow
        Insert: Partial<MeterRow>
        Update: Partial<MeterRow>
        Relationships: []
      }
      meter_readings: {
        Row: MeterReadingRow
        Insert: Partial<MeterReadingRow>
        Update: Partial<MeterReadingRow>
        Relationships: []
      }
      // EDL Meter Readings - SOTA 2026
      edl_meter_readings: {
        Row: EDLMeterReadingRow
        Insert: Partial<EDLMeterReadingRow>
        Update: Partial<EDLMeterReadingRow>
        Relationships: []
      }
      // Charges & Accounting
      charges: {
        Row: ChargeRow
        Insert: Partial<ChargeRow>
        Update: Partial<ChargeRow>
        Relationships: []
      }
      deposit_movements: {
        Row: DepositMovementRow
        Insert: Partial<DepositMovementRow>
        Update: Partial<DepositMovementRow>
        Relationships: []
      }
      // Work Orders & Providers
      work_orders: {
        Row: WorkOrderRow
        Insert: Partial<WorkOrderRow>
        Update: Partial<WorkOrderRow>
        Relationships: [
          { foreignKeyName: "work_orders_ticket_id_fkey"; columns: ["ticket_id"]; isOneToOne: false; referencedRelation: "tickets"; referencedColumns: ["id"] },
          { foreignKeyName: "work_orders_provider_id_fkey"; columns: ["provider_id"]; isOneToOne: false; referencedRelation: "provider_profiles"; referencedColumns: ["id"] }
        ]
      }
      quotes: {
        Row: QuoteRow
        Insert: Partial<QuoteRow>
        Update: Partial<QuoteRow>
        Relationships: [
          { foreignKeyName: "quotes_provider_id_fkey"; columns: ["provider_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "quotes_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      provider_profiles: {
        Row: ProviderProfileRow
        Insert: Partial<ProviderProfileRow>
        Update: Partial<ProviderProfileRow>
        Relationships: []
      }
      // Unified Signature System Tables - P1 SOTA 2026
      signature_sessions: {
        Row: SignatureSessionRow
        Insert: Partial<SignatureSessionRow>
        Update: Partial<SignatureSessionRow>
        Relationships: []
      }
      signature_participants: {
        Row: SignatureParticipantRow
        Insert: Partial<SignatureParticipantRow>
        Update: Partial<SignatureParticipantRow>
        Relationships: []
      }
      signature_proofs: {
        Row: SignatureProofRow
        Insert: Partial<SignatureProofRow>
        Update: Partial<SignatureProofRow>
        Relationships: []
      }
      signature_audit_log: {
        Row: SignatureAuditLogRow
        Insert: Partial<SignatureAuditLogRow>
        Update: Partial<SignatureAuditLogRow>
        Relationships: []
      }
      // Visit Scheduling Tables - SOTA 2026
      owner_availability_patterns: {
        Row: OwnerAvailabilityPatternRow
        Insert: Partial<OwnerAvailabilityPatternRow>
        Update: Partial<OwnerAvailabilityPatternRow>
        Relationships: []
      }
      availability_exceptions: {
        Row: AvailabilityExceptionRow
        Insert: Partial<AvailabilityExceptionRow>
        Update: Partial<AvailabilityExceptionRow>
        Relationships: []
      }
      visit_slots: {
        Row: VisitSlotRow
        Insert: Partial<VisitSlotRow>
        Update: Partial<VisitSlotRow>
        Relationships: []
      }
      visit_bookings: {
        Row: VisitBookingRow
        Insert: Partial<VisitBookingRow>
        Update: Partial<VisitBookingRow>
        Relationships: []
      }
      calendar_connections: {
        Row: CalendarConnectionRow
        Insert: Partial<CalendarConnectionRow>
        Update: Partial<CalendarConnectionRow>
        Relationships: []
      }
      // Legal Entities Tables - SOTA 2026
      legal_entities: {
        Row: LegalEntityRow
        Insert: Partial<LegalEntityRow>
        Update: Partial<LegalEntityRow>
        Relationships: []
      }
      entity_associates: {
        Row: EntityAssociateRow
        Insert: Partial<EntityAssociateRow>
        Update: Partial<EntityAssociateRow>
        Relationships: [
          { foreignKeyName: "entity_associates_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "entity_associates_legal_entity_id_fkey"; columns: ["legal_entity_id"]; isOneToOne: false; referencedRelation: "legal_entities"; referencedColumns: ["id"] }
        ]
      }
      property_ownership: {
        Row: PropertyOwnershipRow
        Insert: Partial<PropertyOwnershipRow>
        Update: Partial<PropertyOwnershipRow>
        Relationships: [
          { foreignKeyName: "property_ownership_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "property_ownership_legal_entity_id_fkey"; columns: ["legal_entity_id"]; isOneToOne: false; referencedRelation: "legal_entities"; referencedColumns: ["id"] },
          { foreignKeyName: "property_ownership_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      // Building Tables - SOTA 2026 (Immeuble Entier)
      buildings: {
        Row: BuildingRow
        Insert: Partial<BuildingRow>
        Update: Partial<BuildingRow>
        Relationships: [
          { foreignKeyName: "buildings_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      building_units: {
        Row: BuildingUnitRow
        Insert: Partial<BuildingUnitRow>
        Update: Partial<BuildingUnitRow>
        Relationships: [
          { foreignKeyName: "building_units_building_id_fkey"; columns: ["building_id"]; isOneToOne: false; referencedRelation: "buildings"; referencedColumns: ["id"] },
          { foreignKeyName: "building_units_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      // P2: Schema Translations Table
      _schema_translations: {
        Row: SchemaTranslationRow
        Insert: Partial<SchemaTranslationRow>
        Update: Partial<SchemaTranslationRow>
        Relationships: []
      }
      // P4: Audit Events Table - Event Sourcing
      audit_events: {
        Row: AuditEventRow
        Insert: Partial<AuditEventRow>
        Update: never  // Immutable
        Relationships: []
      }
      // Missing tables - discovered via type-level query parser
      subscription_plans: {
        Row: SubscriptionPlanRow
        Insert: Partial<SubscriptionPlanRow>
        Update: Partial<SubscriptionPlanRow>
        Relationships: []
      }
      photos: {
        Row: PhotoRow
        Insert: Partial<PhotoRow>
        Update: Partial<PhotoRow>
        Relationships: [
          { foreignKeyName: "photos_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      conversation_participants: {
        Row: ConversationParticipantRow
        Insert: Partial<ConversationParticipantRow>
        Update: Partial<ConversationParticipantRow>
        Relationships: [
          { foreignKeyName: "conversation_participants_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "unified_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "conversation_participants_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      copro_services: {
        Row: CoproServiceRow
        Insert: Partial<CoproServiceRow>
        Update: Partial<CoproServiceRow>
        Relationships: []
      }
      edl_inspection_items: {
        Row: EdlInspectionItemRow
        Insert: Partial<EdlInspectionItemRow>
        Update: Partial<EdlInspectionItemRow>
        Relationships: [
          { foreignKeyName: "edl_inspection_items_process_id_fkey"; columns: ["lease_end_process_id"]; isOneToOne: false; referencedRelation: "lease_end_processes"; referencedColumns: ["id"] }
        ]
      }
      organization_branding: {
        Row: OrganizationBrandingRow
        Insert: Partial<OrganizationBrandingRow>
        Update: Partial<OrganizationBrandingRow>
        Relationships: [
          { foreignKeyName: "organization_branding_org_id_fkey"; columns: ["organization_id"]; isOneToOne: true; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      renovation_items: {
        Row: RenovationItemRow
        Insert: Partial<RenovationItemRow>
        Update: Partial<RenovationItemRow>
        Relationships: [
          { foreignKeyName: "renovation_items_process_id_fkey"; columns: ["lease_end_process_id"]; isOneToOne: false; referencedRelation: "lease_end_processes"; referencedColumns: ["id"] }
        ]
      }
      renovation_quotes: {
        Row: RenovationQuoteRow
        Insert: Partial<RenovationQuoteRow>
        Update: Partial<RenovationQuoteRow>
        Relationships: [
          { foreignKeyName: "renovation_quotes_item_id_fkey"; columns: ["renovation_item_id"]; isOneToOne: false; referencedRelation: "renovation_items"; referencedColumns: ["id"] }
        ]
      }
      conversations: {
        Row: ConversationRow
        Insert: Partial<ConversationRow>
        Update: Partial<ConversationRow>
        Relationships: [
          { foreignKeyName: "conversations_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_owner_profile_id_fkey"; columns: ["owner_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_tenant_profile_id_fkey"; columns: ["tenant_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      lease_end_processes: {
        Row: LeaseEndProcessRow
        Insert: Partial<LeaseEndProcessRow>
        Update: Partial<LeaseEndProcessRow>
        Relationships: [
          { foreignKeyName: "lease_end_processes_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] }
        ]
      }
      messages: {
        Row: MessageRow
        Insert: Partial<MessageRow>
        Update: Partial<MessageRow>
        Relationships: [
          { foreignKeyName: "messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_sender_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_sender_profile_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      organizations: {
        Row: OrganizationRow
        Insert: Partial<OrganizationRow>
        Update: Partial<OrganizationRow>
        Relationships: [
          { foreignKeyName: "organizations_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      owner_profiles: {
        Row: OwnerProfileRow
        Insert: Partial<OwnerProfileRow>
        Update: Partial<OwnerProfileRow>
        Relationships: [
          { foreignKeyName: "owner_profiles_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      provider_invoices: {
        Row: ProviderInvoiceRow
        Insert: Partial<ProviderInvoiceRow>
        Update: Partial<ProviderInvoiceRow>
        Relationships: [
          { foreignKeyName: "provider_invoices_provider_id_fkey"; columns: ["provider_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "provider_invoices_owner_profile_id_fkey"; columns: ["owner_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "provider_invoices_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      provider_quotes: {
        Row: ProviderQuoteRow
        Insert: Partial<ProviderQuoteRow>
        Update: Partial<ProviderQuoteRow>
        Relationships: [
          { foreignKeyName: "provider_quotes_provider_id_fkey"; columns: ["provider_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "provider_quotes_owner_profile_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "provider_quotes_property_id_fkey"; columns: ["property_id"]; isOneToOne: false; referencedRelation: "properties"; referencedColumns: ["id"] }
        ]
      }
      tenant_charges_base: {
        Row: TenantChargesBaseRow
        Insert: Partial<TenantChargesBaseRow>
        Update: Partial<TenantChargesBaseRow>
        Relationships: [
          { foreignKeyName: "tenant_charges_base_copro_service_id_fkey"; columns: ["copro_service_id"]; isOneToOne: false; referencedRelation: "copro_services"; referencedColumns: ["id"] }
        ]
      }
      unified_conversations: {
        Row: UnifiedConversationRow
        Insert: Partial<UnifiedConversationRow>
        Update: Partial<UnifiedConversationRow>
        Relationships: [
          { foreignKeyName: "unified_conversations_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      unified_messages: {
        Row: UnifiedMessageRow
        Insert: Partial<UnifiedMessageRow>
        Update: Partial<UnifiedMessageRow>
        Relationships: [
          { foreignKeyName: "unified_messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "unified_conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "unified_messages_sender_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "unified_messages_sender_profile_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      // Auto-discovered tables — generic Row types (not yet fully typed)
      admin_subscription_actions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      assemblies: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      assembly_attendance: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      assembly_documents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      audit_log: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      branding_assets: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      call_for_funds_items: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      calls_for_funds: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      charges_copro: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      copro_invites: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      copro_payments: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      copro_units: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      custom_domains: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      floors: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      locative_charge_rules: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      motions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      notification_preferences: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      notification_templates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      organization_members: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      ownerships: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      promo_codes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_compliance_documents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_compliance_status: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_invoice_items: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_invoice_payments: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_kyc_requirements: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_payout_accounts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_portfolio_items: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_quote_items: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_reviews: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      proxies: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      service_contracts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      service_expenses: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      sites: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      subscription_events: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      subscription_invoices: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      subscription_usage: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_charge_regularisations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      user_feature_discoveries: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      user_roles: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      vigilance_audit_log: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      votes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      work_order_payments: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      work_order_reports: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      work_order_timeline: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      // Accounting tables
      accounting_entries: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      bank_reconciliations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      team_members: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      signature_requests: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      // Additional auto-discovered tables (Sprint 3)
      account_flags: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      accounting_accounts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      activity_logs: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      admin_logs: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      admin_notes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      admin_user_notes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      agency_commissions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      agency_profiles: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      ai_conversations: {
        Row: {
          id: string
          profile_id: string
          user_query: string
          assistant_response: string | null
          response_time_ms: number | null
          tokens_used: number | null
          model_used: string | null
          rag_docs_retrieved: number
          rag_sources: Json
          thread_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          user_query: string
          assistant_response?: string | null
          response_time_ms?: number | null
          tokens_used?: number | null
          model_used?: string | null
          rag_docs_retrieved?: number
          rag_sources?: Json
          thread_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          user_query?: string
          assistant_response?: string | null
          response_time_ms?: number | null
          tokens_used?: number | null
          model_used?: string | null
          rag_docs_retrieved?: number
          rag_sources?: Json
          thread_id?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "ai_conversations_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "ai_conversations_thread_id_fkey"; columns: ["thread_id"]; isOneToOne: false; referencedRelation: "assistant_threads"; referencedColumns: ["id"] }
        ]
      }
      analytics_aggregates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      analytics_dashboards: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      analytics_widgets: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      api_credentials: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      api_providers: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      api_usage_logs: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      application_files: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      assistant_messages: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      assistant_threads: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      avatars: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      bank_connections: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      bank_transactions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      blog_posts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      building_stats: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      cash_receipts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      charge_provisions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      charge_reconciliations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      charge_regularizations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      chat_messages: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      chat_threads: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      chore_schedule: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      claims: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      cni_expiry_notifications: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      consumption_estimates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      deposit_balance: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      deposit_operations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      deposit_refunds: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      deposits: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      dg_settlements: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      document_links: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      dpe_deliverables: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      dpe_requests: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      export_jobs: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      extracted_fields: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      features: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      guarantor_documents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      guarantor_engagements: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      guarantor_profiles: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      guarantors: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      house_rule_versions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      idempotency_keys: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      identity_2fa_requests: { Row: Identity2FaRequestRow; Insert: Identity2FaRequestInsert; Update: Identity2FaRequestUpdate; Relationships: [] }
      impersonation_sessions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      insurance_policies: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      invitations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      invoice_reminders: {
        Row: {
          id: string
          invoice_id: string
          sent_at: string
          method: "email" | "sms" | "courrier"
          status: "sent" | "delivered" | "failed" | "bounced"
          recipient_email: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          sent_at?: string
          method?: "email" | "sms" | "courrier"
          status?: "sent" | "delivered" | "failed" | "bounced"
          recipient_email?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          sent_at?: string
          method?: "email" | "sms" | "courrier"
          status?: "sent" | "delivered" | "failed" | "bounced"
          recipient_email?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "invoice_reminders_invoice_id_fkey"; columns: ["invoice_id"]; isOneToOne: false; referencedRelation: "invoices"; referencedColumns: ["id"] }
        ]
      }
      lease_drafts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      lease_end_timeline: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      lease_indexations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      lease_notices: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      lease_pending_updates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      lease_templates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      mandant_accounts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      mandates: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      moderation_actions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      moderation_queue: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      moderation_rules: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      notification_settings: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      onboarding_analytics: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      onboarding_drafts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      onboarding_progress: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      onboarding_reminders: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      otp_codes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      outbox: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      passkey_challenges: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      passkey_credentials: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      payment_intents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      payment_schedules: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      plan_pricing_history: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      promo_code_uses: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      property_photos: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      property_share_tokens: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      provider_stats: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      providers: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      push_subscriptions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      repair_cost_grid: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      rooms: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      rule_acceptances: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      sepa_mandates: {
        Row: SepaMandateRow
        Insert: Partial<SepaMandateRow>
        Update: Partial<SepaMandateRow>
        Relationships: [
          { foreignKeyName: "sepa_mandates_tenant_profile_id_fkey"; columns: ["tenant_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "sepa_mandates_owner_profile_id_fkey"; columns: ["owner_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "sepa_mandates_lease_id_fkey"; columns: ["lease_id"]; isOneToOne: false; referencedRelation: "leases"; referencedColumns: ["id"] }
        ]
      }
      signature_request_signers: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      signature_tokens: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      signature_validations: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      sms_messages: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      stripe_connect_accounts: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      stripe_transfers: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      subscription_addon_subscriptions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      subscription_addons: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tax_verification_logs: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_applications: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_documents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_identity_documents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_profiles: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      tenant_payment_methods: {
        Row: TenantPaymentMethodRow
        Insert: Partial<TenantPaymentMethodRow>
        Update: Partial<TenantPaymentMethodRow>
        Relationships: [
          { foreignKeyName: "tenant_payment_methods_tenant_profile_id_fkey"; columns: ["tenant_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "fk_tpm_sepa_mandate"; columns: ["sepa_mandate_id"]; isOneToOne: false; referencedRelation: "sepa_mandates"; referencedColumns: ["id"] }
        ]
      }
      payment_method_audit_log: {
        Row: PaymentMethodAuditLogRow
        Insert: Partial<PaymentMethodAuditLogRow>
        Update: Partial<PaymentMethodAuditLogRow>
        Relationships: [
          { foreignKeyName: "payment_method_audit_log_tenant_profile_id_fkey"; columns: ["tenant_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "payment_method_audit_log_payment_method_id_fkey"; columns: ["payment_method_id"]; isOneToOne: false; referencedRelation: "tenant_payment_methods"; referencedColumns: ["id"] }
        ]
      }
      owner_payment_audit_log: {
        Row: OwnerPaymentAuditLogRow
        Insert: Partial<OwnerPaymentAuditLogRow>
        Update: Partial<OwnerPaymentAuditLogRow>
        Relationships: [
          { foreignKeyName: "owner_payment_audit_log_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      tenant_rewards: {
        Row: {
          id: string
          profile_id: string
          points: number
          action_type: "rent_paid_on_time" | "energy_saving" | "profile_completed" | "document_uploaded" | "on_time_streak" | "referral"
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          points: number
          action_type: "rent_paid_on_time" | "energy_saving" | "profile_completed" | "document_uploaded" | "on_time_streak" | "referral"
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          points?: number
          action_type?: "rent_paid_on_time" | "energy_saving" | "profile_completed" | "document_uploaded" | "on_time_streak" | "referral"
          description?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "tenant_rewards_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      ticket_messages: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      two_factor_sessions: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      two_factor_settings: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      unit_access_codes: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      user_2fa: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      user_consents: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      user_notifications: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      vetusty_grid: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      vetusty_items: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      vetusty_reports: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      webhook_logs: {
        Row: {
          id: string
          provider: string
          event_type: string
          event_id: string | null
          payload: Json | null
          error: string | null
          processed_at: string | null
          status: "success" | "error" | "skipped"
          created_at: string
        }
        Insert: {
          id?: string
          provider?: string
          event_type: string
          event_id?: string | null
          payload?: Json | null
          error?: string | null
          processed_at?: string | null
          status?: "success" | "error" | "skipped"
          created_at?: string
        }
        Update: {
          id?: string
          provider?: string
          event_type?: string
          event_id?: string | null
          payload?: Json | null
          error?: string | null
          processed_at?: string | null
          status?: "success" | "error" | "skipped"
          created_at?: string
        }
        Relationships: []
      }
      webhook_queue: { Row: GenericRowType; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }
      legal_embeddings: {
        Row: {
          id: string
          content: string
          category: "loi_alur" | "decret_decence" | "bail_type" | "charges" | "depot_garantie" | "conge" | "travaux" | "assurance" | "fiscalite" | "copropriete" | "edl" | "indexation"
          source_title: string | null
          source_url: string | null
          source_date: string | null
          article_reference: string | null
          metadata: Json
          embedding: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          category: "loi_alur" | "decret_decence" | "bail_type" | "charges" | "depot_garantie" | "conge" | "travaux" | "assurance" | "fiscalite" | "copropriete" | "edl" | "indexation"
          source_title?: string | null
          source_url?: string | null
          source_date?: string | null
          article_reference?: string | null
          metadata?: Json
          embedding?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          category?: "loi_alur" | "decret_decence" | "bail_type" | "charges" | "depot_garantie" | "conge" | "travaux" | "assurance" | "fiscalite" | "copropriete" | "edl" | "indexation"
          source_title?: string | null
          source_url?: string | null
          source_date?: string | null
          article_reference?: string | null
          metadata?: Json
          embedding?: unknown | null
          created_at?: string
        }
        Relationships: []
      }
      platform_knowledge: {
        Row: {
          id: string
          title: string
          content: string
          knowledge_type: "faq" | "tutorial" | "best_practice" | "template" | "glossary" | "workflow"
          target_roles: string[]
          slug: string | null
          priority: number
          metadata: Json
          embedding: unknown | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          knowledge_type: "faq" | "tutorial" | "best_practice" | "template" | "glossary" | "workflow"
          target_roles?: string[]
          slug?: string | null
          priority?: number
          metadata?: Json
          embedding?: unknown | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          knowledge_type?: "faq" | "tutorial" | "best_practice" | "template" | "glossary" | "workflow"
          target_roles?: string[]
          slug?: string | null
          priority?: number
          metadata?: Json
          embedding?: unknown | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_context_embeddings: {
        Row: {
          id: string
          profile_id: string
          entity_type: "property" | "lease" | "tenant" | "invoice" | "ticket" | "document"
          entity_id: string
          content: string
          summary: string | null
          embedding: unknown | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          entity_type: "property" | "lease" | "tenant" | "invoice" | "ticket" | "document"
          entity_id: string
          content: string
          summary?: string | null
          embedding?: unknown | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          entity_type?: "property" | "lease" | "tenant" | "invoice" | "ticket" | "document"
          entity_id?: string
          content?: string
          summary?: string | null
          embedding?: unknown | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "user_context_embeddings_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: Array<{ foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] }> }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, unknown>
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

// EDL - P0.2 SOTA 2026
export type EDL = EDLRow
export type EDLItem = EDLItemRow
export type EDLMedia = EDLMediaRow
export type EDLSignature = EDLSignatureRow

// Signatures - P0.2 SOTA 2026
export type Signature = SignatureRow
export type LeaseSigner = LeaseSignerRow

// Colocation - P0.2 SOTA 2026
export type Unit = UnitRow
export type Roommate = RoommateRow
export type PaymentShare = PaymentShareRow
export type DepositShare = DepositShareRow

// Meters - P0.2 SOTA 2026
export type Meter = MeterRow
export type MeterReading = MeterReadingRow
export type EDLMeterReading = EDLMeterReadingRow

// Charges & Accounting - P0.2 SOTA 2026
export type Charge = ChargeRow
export type DepositMovement = DepositMovementRow

// Work Orders & Providers - P0.2 SOTA 2026
export type WorkOrder = WorkOrderRow
export type Quote = QuoteRow
export type ProviderProfile = ProviderProfileRow

// Unified Signature System - P1 SOTA 2026
export type SignatureSession = SignatureSessionRow
export type SignatureParticipant = SignatureParticipantRow
export type SignatureProof = SignatureProofRow
export type SignatureAuditLog = SignatureAuditLogRow

// Visit Scheduling - SOTA 2026
export type OwnerAvailabilityPattern = OwnerAvailabilityPatternRow
export type AvailabilityException = AvailabilityExceptionRow
export type VisitSlot = VisitSlotRow
export type VisitBooking = VisitBookingRow
export type CalendarConnection = CalendarConnectionRow

// Legal Entities - SOTA 2026
export type LegalEntity = LegalEntityRow
export type EntityAssociate = EntityAssociateRow
export type PropertyOwnership = PropertyOwnershipRow

// Building & Building Units - SOTA 2026 (Immeuble Entier)
export type Building = BuildingRow
export type BuildingUnit = BuildingUnitRow

// Tenant Payment Methods - SOTA 2026
export type TenantPaymentMethod = TenantPaymentMethodRow
export type PaymentMethodAuditLog = PaymentMethodAuditLogRow
export type SepaMandate = SepaMandateRow

// ============================================
// P2: NAMING NORMALIZATION TYPES (SOTA 2026)
// ============================================

/**
 * Translation mapping for FR→EN column names
 */
export type SchemaTranslationRow = {
  id: number
  table_name: string
  column_fr: string
  column_en: string
  data_type: string | null
  description: string | null
  created_at: string
}

// ============================================
// P4: EVENT SOURCING & AUDIT TYPES (SOTA 2026)
// ============================================

/**
 * Actor types for audit events
 */
export type AuditActorType =
  | 'user'        // Authenticated user action
  | 'system'      // System/application action
  | 'webhook'     // External webhook callback
  | 'cron'        // Scheduled job
  | 'migration'   // Database migration
  | 'admin'       // Admin override
  | 'anonymous'   // Unauthenticated action

/**
 * Event categories for audit grouping
 */
export type AuditEventCategory =
  | 'auth'          // Authentication events
  | 'property'      // Property management
  | 'lease'         // Lease lifecycle
  | 'signature'     // Signature events
  | 'inspection'    // EDL events
  | 'financial'     // Invoices, payments
  | 'tenant'        // Tenant management
  | 'ticket'        // Support tickets
  | 'document'      // Document operations
  | 'communication' // Messages, notifications
  | 'admin'         // Admin operations
  | 'gdpr'          // Privacy/GDPR events
  | 'system'        // System events

/**
 * Audit event row - immutable event log
 */
export type AuditEventRow = {
  id: string

  // Event identification
  event_type: string              // e.g., 'lease.created', 'payment.received'
  event_category: AuditEventCategory
  event_version: number

  // Actor information
  actor_type: AuditActorType
  actor_id: string | null         // Profile ID if user
  actor_email: string | null      // For audit trail
  actor_role: string | null       // Role at time of action

  // Target entity
  entity_type: string             // e.g., 'lease', 'invoice', 'property'
  entity_id: string
  entity_name: string | null      // Human-readable identifier

  // Parent entity (for nested resources)
  parent_entity_type: string | null
  parent_entity_id: string | null

  // Payload
  payload: Json
  old_values: Json | null         // Previous state (for updates)
  new_values: Json | null         // New state (for creates/updates)

  // Context
  request_id: string | null       // Correlation ID
  session_id: string | null       // User session
  ip_address: string | null
  user_agent: string | null
  origin: string | null           // 'web', 'mobile', 'api'

  // Geolocation
  geo_country: string | null
  geo_city: string | null

  // Timestamps (immutable)
  occurred_at: string
  server_time: string
  created_at: string
}

/**
 * Daily audit statistics view
 */
export type AuditDailyStatsRow = {
  day: string
  event_category: AuditEventCategory
  event_count: number
  unique_actors: number
  unique_entities: number
}

/**
 * Event distribution view
 */
export type AuditEventDistributionRow = {
  event_type: string
  event_category: AuditEventCategory
  total_count: number
  last_7_days: number
  last_30_days: number
}

/**
 * Entity history result
 */
export type EntityHistoryEntry = {
  event_id: string
  event_type: string
  event_category: AuditEventCategory
  actor_email: string | null
  actor_role: string | null
  payload: Json
  old_values: Json | null
  new_values: Json | null
  occurred_at: string
}

/**
 * User activity result
 */
export type UserActivityEntry = {
  event_id: string
  event_type: string
  event_category: AuditEventCategory
  entity_type: string
  entity_id: string
  entity_name: string | null
  occurred_at: string
}

/**
 * GDPR export result
 */
export type GDPRExportResult = {
  user_id: string
  exported_at: string
  events: Array<{
    event_type: string
    entity_type: string
    entity_id: string
    payload: Json
    occurred_at: string
  }>
}

// Convenience exports for P4
export type AuditEvent = AuditEventRow
export type AuditDailyStats = AuditDailyStatsRow
export type AuditEventDistribution = AuditEventDistributionRow
export type SchemaTranslation = SchemaTranslationRow

// Alias génériques pour compatibilité
export type AnyRow = GenericRow
export type AnyTable = GenericTable
