-- ============================================================================
-- P2: NORMALISATION DU NOMMAGE FR → EN (SOTA 2026)
-- ============================================================================
-- Date: 2026-01-21
-- Description: Migration progressive du nommage français vers anglais
-- Strategy: Add English aliases via views, keep original columns for backward compatibility
-- ============================================================================

-- ============================================================================
-- PHASE 1: CREATE VIEWS WITH ENGLISH COLUMN NAMES
-- These views provide English-named access without breaking existing code
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 PROPERTIES VIEW (biens)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_properties_en AS
SELECT
  id,
  owner_id,
  unique_code,
  type,
  -- Address fields
  adresse_complete AS full_address,
  code_postal AS postal_code,
  ville AS city,
  departement AS department_code,
  pays AS country,
  -- Property details
  surface AS area_sqm,
  nb_pieces AS room_count,
  etage AS floor_number,
  ascenseur AS has_elevator,
  meuble AS is_furnished,
  -- Financial
  loyer_base AS base_rent,
  loyer_hc AS rent_excluding_charges,
  charges_mensuelles AS monthly_charges,
  depot_garantie AS security_deposit,
  -- Energy
  energie AS energy_class,
  ges AS ghg_class,
  dpe_classe_energie AS dpe_energy_class,
  dpe_classe_climat AS dpe_climate_class,
  dpe_date AS dpe_date,
  dpe_numero AS dpe_number,
  -- Rent control
  zone_encadrement AS rent_control_zone,
  loyer_reference AS reference_rent,
  loyer_reference_majore AS max_reference_rent,
  complement_loyer AS rent_supplement,
  encadrement_applicable AS rent_control_applicable,
  -- Building
  annee_construction AS construction_year,
  nom_residence AS residence_name,
  batiment AS building,
  escalier AS staircase,
  numero_lot AS lot_number,
  -- Syndic
  syndic_name AS property_manager_name,
  syndic_email AS property_manager_email,
  syndic_phone AS property_manager_phone,
  -- Status
  etat AS status,
  deleted_at,
  created_at,
  updated_at
FROM properties;

COMMENT ON VIEW v_properties_en IS 'English-named view for properties table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.2 PROFILES VIEW (utilisateurs)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_profiles_en AS
SELECT
  id,
  user_id,
  role,
  -- Identity
  prenom AS first_name,
  nom AS last_name,
  email,
  telephone AS phone,
  -- Birth info
  date_naissance AS birth_date,
  lieu_naissance AS birth_place,
  nationalite AS nationality,
  -- Address
  adresse AS address,
  adresse_complement AS address_line2,
  code_postal AS postal_code,
  ville AS city,
  pays AS country,
  -- Professional
  siret,
  raison_sociale AS company_name,
  -- Account
  avatar_url,
  account_status,
  two_factor_enabled,
  suspended_at,
  suspended_reason,
  -- Timestamps
  created_at,
  updated_at
FROM profiles;

COMMENT ON VIEW v_profiles_en IS 'English-named view for profiles table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.3 LEASES VIEW (baux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_leases_en AS
SELECT
  id,
  property_id,
  unit_id,
  -- Type
  type_bail AS lease_type,
  -- Financial
  loyer AS rent_amount,
  charges_forfaitaires AS fixed_charges,
  charges_type AS charges_type,
  depot_de_garantie AS security_deposit,
  prorata_first_month AS first_month_prorata,
  -- Dates
  date_debut AS start_date,
  date_fin AS end_date,
  date_signature AS signature_date,
  -- Status
  statut AS status,
  -- Indexation
  indexation_enabled AS indexation_enabled,
  dernier_indice_ref AS last_reference_index,
  date_derniere_revision AS last_revision_date,
  -- Rent control
  encadrement_applicable AS rent_control_applicable,
  loyer_reference_majore AS max_reference_rent,
  complement_loyer AS rent_supplement,
  justification_complement AS supplement_justification,
  -- Documents
  pdf_url AS lease_pdf_url,
  pdf_signed_url AS signed_lease_pdf_url,
  -- Colocation
  coloc_config AS shared_housing_config,
  -- Invitation
  invite_token,
  invite_token_expires_at,
  tenant_email_pending AS pending_tenant_email,
  tenant_name_pending AS pending_tenant_name,
  -- Identity verification
  tenant_identity_verified,
  tenant_identity_method,
  tenant_identity_data,
  -- Yousign integration
  yousign_signature_request_id,
  yousign_document_id,
  signature_started_at,
  signature_completed_at,
  signature_status,
  -- Timestamps
  created_at,
  updated_at
FROM leases;

COMMENT ON VIEW v_leases_en IS 'English-named view for leases table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.4 INVOICES VIEW (factures)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_invoices_en AS
SELECT
  id,
  lease_id,
  owner_id,
  tenant_id,
  -- Period
  periode AS period,
  -- Amounts
  montant_loyer AS rent_amount,
  montant_charges AS charges_amount,
  montant_tva AS vat_amount,
  tva_taux AS vat_rate,
  montant_total AS total_amount,
  -- Status
  statut AS status,
  -- Dates
  date_echeance AS due_date,
  date_paiement AS payment_date,
  date_envoi AS sent_date,
  -- Reference
  invoice_number,
  -- Timestamps
  created_at,
  updated_at
FROM invoices;

COMMENT ON VIEW v_invoices_en IS 'English-named view for invoices table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.5 PAYMENTS VIEW (paiements)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_payments_en AS
SELECT
  id,
  invoice_id,
  -- Amount
  montant AS amount,
  -- Method
  moyen AS payment_method,
  -- Status
  statut AS status,
  -- Provider
  provider_ref AS provider_reference,
  -- Dates
  date_paiement AS payment_date,
  -- Reference
  reference,
  -- Timestamps
  created_at
FROM payments;

COMMENT ON VIEW v_payments_en IS 'English-named view for payments table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.6 CHARGES VIEW (charges récurrentes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_charges_en AS
SELECT
  id,
  property_id,
  -- Type and description
  type,
  libelle AS label,
  description,
  -- Amount
  montant AS amount,
  -- Frequency
  periodicite AS frequency,
  jour_prelevement AS billing_day,
  -- Tenant recharge
  refacturable_locataire AS rechargeable_to_tenant,
  pourcentage_refacturable AS rechargeable_percentage,
  -- Dates
  date_debut AS start_date,
  date_fin AS end_date,
  -- Status
  is_active,
  -- Timestamps
  created_at,
  updated_at
FROM charges;

COMMENT ON VIEW v_charges_en IS 'English-named view for charges table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.7 TICKETS VIEW (interventions)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tickets_en AS
SELECT
  id,
  property_id,
  lease_id,
  created_by,
  assigned_to,
  -- Content
  titre AS title,
  description,
  -- Priority and status
  priorite AS priority,
  statut AS status,
  -- Category
  categorie AS category,
  sous_categorie AS subcategory,
  -- Location
  localisation AS location,
  -- Resolution
  date_resolution AS resolution_date,
  resolution_notes,
  -- Timestamps
  created_at,
  updated_at
FROM tickets;

COMMENT ON VIEW v_tickets_en IS 'English-named view for tickets table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.8 EDL VIEW (états des lieux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inspections_en AS
SELECT
  id,
  lease_id,
  -- Type
  type,
  -- Status
  status,
  -- Dates
  scheduled_date,
  completed_date AS completion_date,
  -- Creator
  created_by,
  -- Timestamps
  created_at,
  updated_at
FROM edl;

COMMENT ON VIEW v_inspections_en IS 'English-named view for edl (inspections) table (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 1.9 EDL_ITEMS VIEW (éléments d'état des lieux)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_inspection_items_en AS
SELECT
  id,
  edl_id AS inspection_id,
  -- Location
  room_name,
  item_name,
  -- Assessment
  condition,
  notes AS comments,
  -- Timestamps
  created_at
FROM edl_items;

COMMENT ON VIEW v_inspection_items_en IS 'English-named view for edl_items (inspection_items) table (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 2: CREATE TRANSLATION FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 Status translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_status_fr_to_en(status_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE status_fr
    -- Lease statuses
    WHEN 'brouillon' THEN 'draft'
    WHEN 'en_attente_signature' THEN 'pending_signature'
    WHEN 'partiellement_signe' THEN 'partially_signed'
    WHEN 'signe' THEN 'fully_signed'
    WHEN 'actif' THEN 'active'
    WHEN 'conge_donne' THEN 'notice_given'
    WHEN 'termine' THEN 'terminated'
    WHEN 'archive' THEN 'archived'
    -- Invoice statuses
    WHEN 'envoyee' THEN 'sent'
    WHEN 'payee' THEN 'paid'
    WHEN 'en_retard' THEN 'overdue'
    WHEN 'annulee' THEN 'cancelled'
    -- Payment statuses
    WHEN 'en_attente' THEN 'pending'
    WHEN 'reussi' THEN 'succeeded'
    WHEN 'echoue' THEN 'failed'
    WHEN 'rembourse' THEN 'refunded'
    -- Ticket statuses
    WHEN 'ouvert' THEN 'open'
    WHEN 'en_cours' THEN 'in_progress'
    WHEN 'en_pause' THEN 'paused'
    WHEN 'resolu' THEN 'resolved'
    WHEN 'ferme' THEN 'closed'
    -- Default: return original
    ELSE status_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_status_fr_to_en IS 'Translates French status values to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.2 Property type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_property_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'appartement' THEN 'apartment'
    WHEN 'maison' THEN 'house'
    WHEN 'studio' THEN 'studio'
    WHEN 'colocation' THEN 'shared_housing'
    WHEN 'saisonnier' THEN 'seasonal'
    WHEN 'local_commercial' THEN 'commercial'
    WHEN 'bureaux' THEN 'office'
    WHEN 'parking' THEN 'parking'
    WHEN 'cave' THEN 'cellar'
    WHEN 'garage' THEN 'garage'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_property_type_fr_to_en IS 'Translates French property types to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.3 Lease type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_lease_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'nu' THEN 'unfurnished'
    WHEN 'meuble' THEN 'furnished'
    WHEN 'colocation' THEN 'shared'
    WHEN 'saisonnier' THEN 'seasonal'
    WHEN 'bail_mobilite' THEN 'mobility'
    WHEN 'etudiant' THEN 'student'
    WHEN 'commercial_3_6_9' THEN 'commercial'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_lease_type_fr_to_en IS 'Translates French lease types to English (P2 SOTA 2026)';

-- ----------------------------------------------------------------------------
-- 2.4 Charge type translation function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION translate_charge_type_fr_to_en(type_fr TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE type_fr
    WHEN 'eau' THEN 'water'
    WHEN 'electricite' THEN 'electricity'
    WHEN 'gaz' THEN 'gas'
    WHEN 'copro' THEN 'condo_fees'
    WHEN 'taxe' THEN 'tax'
    WHEN 'ordures' THEN 'waste'
    WHEN 'assurance' THEN 'insurance'
    WHEN 'travaux' THEN 'repairs'
    WHEN 'entretien' THEN 'maintenance'
    WHEN 'autre' THEN 'other'
    ELSE type_fr
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION translate_charge_type_fr_to_en IS 'Translates French charge types to English (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 3: CREATE MAPPING TABLE FOR DOCUMENTATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS _schema_translations (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  column_fr TEXT NOT NULL,
  column_en TEXT NOT NULL,
  data_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(table_name, column_fr)
);

COMMENT ON TABLE _schema_translations IS 'Documentation of FR→EN column name translations (P2 SOTA 2026)';

-- Insert translation mappings
INSERT INTO _schema_translations (table_name, column_fr, column_en, data_type, description) VALUES
  -- Properties
  ('properties', 'adresse_complete', 'full_address', 'TEXT', 'Complete street address'),
  ('properties', 'code_postal', 'postal_code', 'VARCHAR(5)', 'Postal/ZIP code'),
  ('properties', 'ville', 'city', 'TEXT', 'City name'),
  ('properties', 'departement', 'department_code', 'VARCHAR(3)', 'French department code'),
  ('properties', 'surface', 'area_sqm', 'NUMERIC', 'Area in square meters'),
  ('properties', 'nb_pieces', 'room_count', 'INTEGER', 'Number of rooms'),
  ('properties', 'etage', 'floor_number', 'INTEGER', 'Floor number'),
  ('properties', 'ascenseur', 'has_elevator', 'BOOLEAN', 'Building has elevator'),
  ('properties', 'meuble', 'is_furnished', 'BOOLEAN', 'Property is furnished'),
  ('properties', 'loyer_base', 'base_rent', 'NUMERIC', 'Base rent amount'),
  ('properties', 'charges_mensuelles', 'monthly_charges', 'NUMERIC', 'Monthly charges'),
  ('properties', 'depot_garantie', 'security_deposit', 'NUMERIC', 'Security deposit'),
  ('properties', 'etat', 'status', 'TEXT', 'Property status'),
  -- Profiles
  ('profiles', 'prenom', 'first_name', 'TEXT', 'First name'),
  ('profiles', 'nom', 'last_name', 'TEXT', 'Last name'),
  ('profiles', 'telephone', 'phone', 'TEXT', 'Phone number'),
  ('profiles', 'date_naissance', 'birth_date', 'DATE', 'Date of birth'),
  ('profiles', 'lieu_naissance', 'birth_place', 'VARCHAR(255)', 'Place of birth'),
  ('profiles', 'nationalite', 'nationality', 'VARCHAR(100)', 'Nationality'),
  ('profiles', 'adresse', 'address', 'TEXT', 'Street address'),
  ('profiles', 'raison_sociale', 'company_name', 'TEXT', 'Company name'),
  -- Leases
  ('leases', 'type_bail', 'lease_type', 'TEXT', 'Type of lease'),
  ('leases', 'loyer', 'rent_amount', 'NUMERIC', 'Rent amount'),
  ('leases', 'charges_forfaitaires', 'fixed_charges', 'NUMERIC', 'Fixed charges'),
  ('leases', 'depot_de_garantie', 'security_deposit', 'NUMERIC', 'Security deposit'),
  ('leases', 'date_debut', 'start_date', 'DATE', 'Lease start date'),
  ('leases', 'date_fin', 'end_date', 'DATE', 'Lease end date'),
  ('leases', 'statut', 'status', 'TEXT', 'Lease status'),
  -- Invoices
  ('invoices', 'periode', 'period', 'VARCHAR(7)', 'Billing period (YYYY-MM)'),
  ('invoices', 'montant_loyer', 'rent_amount', 'NUMERIC', 'Rent portion'),
  ('invoices', 'montant_charges', 'charges_amount', 'NUMERIC', 'Charges portion'),
  ('invoices', 'montant_total', 'total_amount', 'NUMERIC', 'Total amount'),
  ('invoices', 'statut', 'status', 'TEXT', 'Invoice status'),
  ('invoices', 'date_echeance', 'due_date', 'DATE', 'Payment due date'),
  -- Payments
  ('payments', 'montant', 'amount', 'NUMERIC', 'Payment amount'),
  ('payments', 'moyen', 'payment_method', 'TEXT', 'Payment method'),
  ('payments', 'statut', 'status', 'TEXT', 'Payment status'),
  ('payments', 'date_paiement', 'payment_date', 'TIMESTAMPTZ', 'Payment date'),
  -- Charges
  ('charges', 'libelle', 'label', 'TEXT', 'Charge label'),
  ('charges', 'montant', 'amount', 'NUMERIC', 'Charge amount'),
  ('charges', 'periodicite', 'frequency', 'TEXT', 'Billing frequency'),
  ('charges', 'refacturable_locataire', 'rechargeable_to_tenant', 'BOOLEAN', 'Can be charged to tenant'),
  -- Tickets
  ('tickets', 'titre', 'title', 'TEXT', 'Ticket title'),
  ('tickets', 'priorite', 'priority', 'TEXT', 'Priority level'),
  ('tickets', 'statut', 'status', 'TEXT', 'Ticket status'),
  ('tickets', 'categorie', 'category', 'TEXT', 'Category'),
  ('tickets', 'localisation', 'location', 'TEXT', 'Location in property')
ON CONFLICT (table_name, column_fr) DO NOTHING;

-- ============================================================================
-- PHASE 4: CREATE TYPE MAPPING FOR TYPESCRIPT GENERATION
-- ============================================================================

-- Create a function to generate TypeScript interface from view
CREATE OR REPLACE FUNCTION generate_typescript_interface(view_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  col RECORD;
  ts_type TEXT;
BEGIN
  result := 'export interface ' || initcap(replace(view_name, 'v_', '')) || 'Row {' || E'\n';

  FOR col IN
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = view_name
    ORDER BY ordinal_position
  LOOP
    -- Map SQL types to TypeScript
    ts_type := CASE
      WHEN col.data_type IN ('uuid', 'text', 'character varying', 'varchar', 'char') THEN 'string'
      WHEN col.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision') THEN 'number'
      WHEN col.data_type = 'boolean' THEN 'boolean'
      WHEN col.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date', 'time') THEN 'string'
      WHEN col.data_type = 'jsonb' OR col.data_type = 'json' THEN 'Record<string, unknown>'
      WHEN col.data_type = 'inet' THEN 'string'
      ELSE 'unknown'
    END;

    -- Add nullable marker
    IF col.is_nullable = 'YES' THEN
      ts_type := ts_type || ' | null';
    END IF;

    result := result || '  ' || col.column_name || ': ' || ts_type || ';' || E'\n';
  END LOOP;

  result := result || '}';

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_typescript_interface IS 'Generates TypeScript interface from view definition (P2 SOTA 2026)';

-- ============================================================================
-- PHASE 5: GRANTS FOR VIEWS
-- ============================================================================

-- Grant select on all views to authenticated users
GRANT SELECT ON v_properties_en TO authenticated;
GRANT SELECT ON v_profiles_en TO authenticated;
GRANT SELECT ON v_leases_en TO authenticated;
GRANT SELECT ON v_invoices_en TO authenticated;
GRANT SELECT ON v_payments_en TO authenticated;
GRANT SELECT ON v_charges_en TO authenticated;
GRANT SELECT ON v_tickets_en TO authenticated;
GRANT SELECT ON v_inspections_en TO authenticated;
GRANT SELECT ON v_inspection_items_en TO authenticated;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON SCHEMA public IS 'P2 SOTA 2026: Added English-named views for all major tables.
Use v_*_en views for English column names while maintaining backward compatibility with original tables.

Views available:
- v_properties_en
- v_profiles_en
- v_leases_en
- v_invoices_en
- v_payments_en
- v_charges_en
- v_tickets_en
- v_inspections_en
- v_inspection_items_en

Translation functions:
- translate_status_fr_to_en(status)
- translate_property_type_fr_to_en(type)
- translate_lease_type_fr_to_en(type)
- translate_charge_type_fr_to_en(type)

See _schema_translations table for complete column mappings.';
