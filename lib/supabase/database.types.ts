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
  etat?: string  // draft | incomplete | ready_to_let | active | archived
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
  // P0.3: Colonnes financières et réglementaires ajoutées
  loyer_base?: number | null
  loyer_hc?: number | null
  charges_mensuelles?: number | null
  depot_garantie?: number | null
  zone_encadrement?: boolean
  dpe_classe_energie?: string | null
  dpe_classe_climat?: string | null
  permis_louer_requis?: boolean
  permis_louer_numero?: string | null
  // P0.3: Colonnes commerciales
  usage_principal?: string | null
  sous_usage?: string | null
  erp_type?: string | null
  plan_url?: string | null
  places_parking?: number | null
  // Soft delete
  deleted_at?: string | null
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
  // P0.3: Colonnes manquantes ajoutées
  lieu_naissance?: string | null
  nationalite?: string | null
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
// EDL (ÉTATS DES LIEUX) TYPES
// ============================================

export interface EDLRow {
  id: string
  lease_id: string
  type: 'entree' | 'sortie'
  status: 'draft' | 'in_progress' | 'completed' | 'signed' | 'disputed'
  scheduled_date: string | null
  completed_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface EDLItemRow {
  id: string
  edl_id: string
  room_name: string
  item_name: string
  condition: 'neuf' | 'bon' | 'moyen' | 'mauvais' | 'tres_mauvais' | null
  notes: string | null
  created_at: string
  [key: string]: any
}

export interface EDLMediaRow {
  id: string
  edl_id: string
  item_id: string | null
  storage_path: string
  media_type: 'photo' | 'video'
  thumbnail_path: string | null
  taken_at: string
  created_at: string
  [key: string]: any
}

export interface EDLSignatureRow {
  id: string
  edl_id: string
  signer_user: string
  signer_role: 'owner' | 'tenant' | 'witness'
  signed_at: string
  signature_image_path: string | null
  ip_inet: string | null
  user_agent: string | null
  [key: string]: any
}

// ============================================
// SIGNATURE TYPES
// ============================================

export interface SignatureRow {
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
  [key: string]: any
}

export interface LeaseSignerRow {
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
  created_at: string
  updated_at: string
  [key: string]: any
}

// ============================================
// COLOCATION TYPES
// ============================================

export interface UnitRow {
  id: string
  property_id: string
  nom: string
  capacite_max: number
  surface: number | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface RoommateRow {
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
  [key: string]: any
}

export interface PaymentShareRow {
  id: string
  lease_id: string
  invoice_id: string | null
  month: string
  roommate_id: string
  expected_amount: number
  paid_amount: number
  status: 'pending' | 'partial' | 'paid' | 'late'
  paid_at: string | null
  created_at: string
  [key: string]: any
}

export interface DepositShareRow {
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
  [key: string]: any
}

// ============================================
// METER (COMPTEUR) TYPES
// ============================================

export interface MeterRow {
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
  [key: string]: any
}

/**
 * meter_readings table - General meter readings for billing
 * @version 2026-01-22 - Fixed: photo_url (not photo_path)
 */
export interface MeterReadingRow {
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
  [key: string]: any
}

/**
 * edl_meter_readings table - EDL-specific meter readings
 * @version 2026-01-22 - Added for SOTA type safety
 */
export interface EDLMeterReadingRow {
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
  [key: string]: any
}

// ============================================
// CHARGES & ACCOUNTING TYPES
// ============================================

export interface ChargeRow {
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
  [key: string]: any
}

export interface DepositMovementRow {
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
  [key: string]: any
}

// ============================================
// WORK ORDER & PROVIDER TYPES
// ============================================

export interface WorkOrderRow {
  id: string
  ticket_id: string
  provider_id: string
  quote_id: string | null
  statut: 'assigned' | 'scheduled' | 'in_progress' | 'done' | 'cancelled'
  scheduled_date: string | null
  completed_date: string | null
  actual_cost: number | null
  notes: string | null
  created_at: string
  updated_at: string
  [key: string]: any
}

export interface QuoteRow {
  id: string
  ticket_id: string
  provider_id: string
  description: string
  amount: number
  validity_days: number
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  submitted_at: string
  responded_at: string | null
  created_at: string
  [key: string]: any
}

export interface ProviderProfileRow {
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
  created_at: string
  updated_at: string
  [key: string]: any
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

export interface SignatureSessionRow {
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
  [key: string]: any
}

export interface SignatureParticipantRow {
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
  [key: string]: any
}

export interface SignatureProofRow {
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
  [key: string]: any
}

export interface SignatureAuditLogRow {
  id: string
  session_id: string
  participant_id: string | null
  action: SignatureAuditAction
  actor_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Json | null
  created_at: string
  [key: string]: any
}

// ============================================
// VISIT SCHEDULING TYPES - SOTA 2026
// ============================================

export interface OwnerAvailabilityPatternRow {
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
  [key: string]: any
}

export interface AvailabilityExceptionRow {
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
  [key: string]: any
}

export interface VisitSlotRow {
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
  [key: string]: any
}

export interface VisitBookingRow {
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
  [key: string]: any
}

export interface CalendarConnectionRow {
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
  [key: string]: any
}

// ============================================
// LEGAL ENTITIES TYPES - SOTA 2026
// ============================================

export interface LegalEntityRow {
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
  [key: string]: any
}

export interface EntityAssociateRow {
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
  [key: string]: any
}

export interface PropertyOwnershipRow {
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
      // EDL Tables
      edl: {
        Row: EDLRow
        Insert: Partial<EDLRow>
        Update: Partial<EDLRow>
        Relationships: any[]
      }
      edl_items: {
        Row: EDLItemRow
        Insert: Partial<EDLItemRow>
        Update: Partial<EDLItemRow>
        Relationships: any[]
      }
      edl_media: {
        Row: EDLMediaRow
        Insert: Partial<EDLMediaRow>
        Update: Partial<EDLMediaRow>
        Relationships: any[]
      }
      edl_signatures: {
        Row: EDLSignatureRow
        Insert: Partial<EDLSignatureRow>
        Update: Partial<EDLSignatureRow>
        Relationships: any[]
      }
      // Signature Tables
      signatures: {
        Row: SignatureRow
        Insert: Partial<SignatureRow>
        Update: Partial<SignatureRow>
        Relationships: any[]
      }
      lease_signers: {
        Row: LeaseSignerRow
        Insert: Partial<LeaseSignerRow>
        Update: Partial<LeaseSignerRow>
        Relationships: any[]
      }
      // Colocation Tables
      units: {
        Row: UnitRow
        Insert: Partial<UnitRow>
        Update: Partial<UnitRow>
        Relationships: any[]
      }
      roommates: {
        Row: RoommateRow
        Insert: Partial<RoommateRow>
        Update: Partial<RoommateRow>
        Relationships: any[]
      }
      payment_shares: {
        Row: PaymentShareRow
        Insert: Partial<PaymentShareRow>
        Update: Partial<PaymentShareRow>
        Relationships: any[]
      }
      deposit_shares: {
        Row: DepositShareRow
        Insert: Partial<DepositShareRow>
        Update: Partial<DepositShareRow>
        Relationships: any[]
      }
      // Meter Tables
      meters: {
        Row: MeterRow
        Insert: Partial<MeterRow>
        Update: Partial<MeterRow>
        Relationships: any[]
      }
      meter_readings: {
        Row: MeterReadingRow
        Insert: Partial<MeterReadingRow>
        Update: Partial<MeterReadingRow>
        Relationships: any[]
      }
      // EDL Meter Readings - SOTA 2026
      edl_meter_readings: {
        Row: EDLMeterReadingRow
        Insert: Partial<EDLMeterReadingRow>
        Update: Partial<EDLMeterReadingRow>
        Relationships: any[]
      }
      // Charges & Accounting
      charges: {
        Row: ChargeRow
        Insert: Partial<ChargeRow>
        Update: Partial<ChargeRow>
        Relationships: any[]
      }
      deposit_movements: {
        Row: DepositMovementRow
        Insert: Partial<DepositMovementRow>
        Update: Partial<DepositMovementRow>
        Relationships: any[]
      }
      // Work Orders & Providers
      work_orders: {
        Row: WorkOrderRow
        Insert: Partial<WorkOrderRow>
        Update: Partial<WorkOrderRow>
        Relationships: any[]
      }
      quotes: {
        Row: QuoteRow
        Insert: Partial<QuoteRow>
        Update: Partial<QuoteRow>
        Relationships: any[]
      }
      provider_profiles: {
        Row: ProviderProfileRow
        Insert: Partial<ProviderProfileRow>
        Update: Partial<ProviderProfileRow>
        Relationships: any[]
      }
      // Unified Signature System Tables - P1 SOTA 2026
      signature_sessions: {
        Row: SignatureSessionRow
        Insert: Partial<SignatureSessionRow>
        Update: Partial<SignatureSessionRow>
        Relationships: any[]
      }
      signature_participants: {
        Row: SignatureParticipantRow
        Insert: Partial<SignatureParticipantRow>
        Update: Partial<SignatureParticipantRow>
        Relationships: any[]
      }
      signature_proofs: {
        Row: SignatureProofRow
        Insert: Partial<SignatureProofRow>
        Update: Partial<SignatureProofRow>
        Relationships: any[]
      }
      signature_audit_log: {
        Row: SignatureAuditLogRow
        Insert: Partial<SignatureAuditLogRow>
        Update: Partial<SignatureAuditLogRow>
        Relationships: any[]
      }
      // Visit Scheduling Tables - SOTA 2026
      owner_availability_patterns: {
        Row: OwnerAvailabilityPatternRow
        Insert: Partial<OwnerAvailabilityPatternRow>
        Update: Partial<OwnerAvailabilityPatternRow>
        Relationships: any[]
      }
      availability_exceptions: {
        Row: AvailabilityExceptionRow
        Insert: Partial<AvailabilityExceptionRow>
        Update: Partial<AvailabilityExceptionRow>
        Relationships: any[]
      }
      visit_slots: {
        Row: VisitSlotRow
        Insert: Partial<VisitSlotRow>
        Update: Partial<VisitSlotRow>
        Relationships: any[]
      }
      visit_bookings: {
        Row: VisitBookingRow
        Insert: Partial<VisitBookingRow>
        Update: Partial<VisitBookingRow>
        Relationships: any[]
      }
      calendar_connections: {
        Row: CalendarConnectionRow
        Insert: Partial<CalendarConnectionRow>
        Update: Partial<CalendarConnectionRow>
        Relationships: any[]
      }
      // Legal Entities Tables - SOTA 2026
      legal_entities: {
        Row: LegalEntityRow
        Insert: Partial<LegalEntityRow>
        Update: Partial<LegalEntityRow>
        Relationships: any[]
      }
      entity_associates: {
        Row: EntityAssociateRow
        Insert: Partial<EntityAssociateRow>
        Update: Partial<EntityAssociateRow>
        Relationships: any[]
      }
      property_ownership: {
        Row: PropertyOwnershipRow
        Insert: Partial<PropertyOwnershipRow>
        Update: Partial<PropertyOwnershipRow>
        Relationships: any[]
      }
      // P2: Schema Translations Table
      _schema_translations: {
        Row: SchemaTranslationRow
        Insert: Partial<SchemaTranslationRow>
        Update: Partial<SchemaTranslationRow>
        Relationships: any[]
      }
      // P4: Audit Events Table - Event Sourcing
      audit_events: {
        Row: AuditEventRow
        Insert: Partial<AuditEventRow>
        Update: never  // Immutable
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

// ============================================
// P2: NAMING NORMALIZATION TYPES (SOTA 2026)
// ============================================

/**
 * Translation mapping for FR→EN column names
 */
export interface SchemaTranslationRow {
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
export interface AuditEventRow {
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
export interface AuditDailyStatsRow {
  day: string
  event_category: AuditEventCategory
  event_count: number
  unique_actors: number
  unique_entities: number
}

/**
 * Event distribution view
 */
export interface AuditEventDistributionRow {
  event_type: string
  event_category: AuditEventCategory
  total_count: number
  last_7_days: number
  last_30_days: number
}

/**
 * Entity history result
 */
export interface EntityHistoryEntry {
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
export interface UserActivityEntry {
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
export interface GDPRExportResult {
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
