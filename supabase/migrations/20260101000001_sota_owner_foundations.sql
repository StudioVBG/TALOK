-- Migration: 20260101000001_sota_owner_foundations.sql
-- Description: Foundations for Security, Taxation, and Audit for Owners

-- 1. Ensure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create DROM tax configuration table
CREATE TABLE IF NOT EXISTS drom_tax_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_name TEXT NOT NULL,
    zip_prefix TEXT NOT NULL UNIQUE, -- '971', '972', etc.
    tva_rate DECIMAL(5, 3) NOT NULL, -- 0.085 for DROM
    has_crl BOOLEAN DEFAULT false, -- Contribution sur les Revenus Locatifs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed DROM data
INSERT INTO drom_tax_config (region_name, zip_prefix, tva_rate)
VALUES 
    ('Guadeloupe', '971', 0.085),
    ('Martinique', '972', 0.085),
    ('Guyane', '973', 0.000), 
    ('La Réunion', '974', 0.085),
    ('Mayotte', '976', 0.000)
ON CONFLICT (zip_prefix) DO NOTHING;

-- 3. Prepare owner_profiles for encryption
ALTER TABLE owner_profiles 
ADD COLUMN IF NOT EXISTS iban_encrypted TEXT,
ADD COLUMN IF NOT EXISTS iban_last4 TEXT;

-- 4. Extend invoices for taxation
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS montant_tva DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tva_taux DECIMAL(5, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_drom BOOLEAN DEFAULT false;

-- 5. Create a function to log data access (GDPR)
CREATE OR REPLACE FUNCTION log_data_access(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS for drom_tax_config
ALTER TABLE drom_tax_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tax config" ON drom_tax_config FOR SELECT USING (true);

-- 6. Trigger for updated_at on drom_tax_config
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drom_tax_config_updated_at
    BEFORE UPDATE ON drom_tax_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

