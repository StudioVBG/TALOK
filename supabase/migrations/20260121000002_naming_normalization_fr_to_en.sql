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
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_properties_en AS
  SELECT
    id,
    owner_id,
    unique_code,
    type,
    adresse_complete AS full_address,
    code_postal AS postal_code,
    ville AS city,
    departement AS department_code,
    surface AS area_sqm,
    nb_pieces AS room_count,
    etage AS floor_number,
    ascenseur AS has_elevator,
    energie AS energy_class,
    ges AS ghg_class,
    created_at,
    updated_at
  FROM properties;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_properties_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.2 PROFILES VIEW (utilisateurs)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_profiles_en AS
  SELECT
    id,
    user_id,
    role,
    prenom AS first_name,
    nom AS last_name,
    email,
    telephone AS phone,
    avatar_url,
    created_at,
    updated_at
  FROM profiles;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_profiles_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.3 LEASES VIEW (baux)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_leases_en AS
  SELECT
    id,
    property_id,
    unit_id,
    type_bail AS lease_type,
    loyer AS rent_amount,
    charges_forfaitaires AS fixed_charges,
    depot_de_garantie AS security_deposit,
    date_debut AS start_date,
    date_fin AS end_date,
    statut AS status,
    created_at,
    updated_at
  FROM leases;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_leases_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.4 INVOICES VIEW (factures)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_invoices_en AS
  SELECT
    id,
    lease_id,
    owner_id,
    tenant_id,
    periode AS period,
    montant_loyer AS rent_amount,
    montant_charges AS charges_amount,
    montant_total AS total_amount,
    statut AS status,
    date_echeance AS due_date,
    created_at,
    updated_at
  FROM invoices;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_invoices_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.5 PAYMENTS VIEW (paiements)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_payments_en AS
  SELECT
    id,
    invoice_id,
    montant AS amount,
    moyen AS payment_method,
    statut AS status,
    provider_ref AS provider_reference,
    date_paiement AS payment_date,
    created_at
  FROM payments;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_payments_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.6 CHARGES VIEW (charges récurrentes)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_charges_en AS
  SELECT
    id,
    property_id,
    type,
    montant AS amount,
    periodicite AS frequency,
    refacturable_locataire AS rechargeable_to_tenant,
    created_at,
    updated_at
  FROM charges;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_charges_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.7 TICKETS VIEW (interventions)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_tickets_en AS
  SELECT
    id,
    property_id,
    lease_id,
    created_by,
    titre AS title,
    description,
    priorite AS priority,
    statut AS status,
    created_at,
    updated_at
  FROM tickets;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_tickets_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.8 EDL VIEW (états des lieux)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_inspections_en AS
  SELECT
    id,
    lease_id,
    type,
    status,
    created_by,
    created_at,
    updated_at
  FROM edl;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_inspections_en: %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- 1.9 EDL_ITEMS VIEW (éléments d'état des lieux)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE OR REPLACE VIEW v_inspection_items_en AS
  SELECT
    id,
    edl_id AS inspection_id,
    room_name,
    item_name,
    created_at
  FROM edl_items;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping v_inspection_items_en: %', SQLERRM;
END $$;

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

DO $$ BEGIN
  GRANT SELECT ON v_properties_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_profiles_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_leases_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_invoices_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_payments_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_charges_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_tickets_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_inspections_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON v_inspection_items_en TO authenticated;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

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
