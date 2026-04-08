-- Agency Hoguet compliance fields
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_numero TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS carte_g_expiry DATE;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie TEXT;
ALTER TABLE legal_entities ADD COLUMN IF NOT EXISTS caisse_garantie_numero TEXT;
